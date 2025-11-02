import cv2
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from uuid import uuid4
import numpy as np
from functools import lru_cache
from urllib.parse import parse_qs, urlparse

from faster_whisper import WhisperModel
from yt_dlp import YoutubeDL

def safe_float(x):
    if x is None or math.isnan(x) or math.isinf(x):
        return 0.0
    return float(x)

BASE_DIR = Path(__file__).resolve().parent.parent
VIDEOS_DIR = BASE_DIR / "videos"
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)


def _resolve_cookie_path(cookies_path: Optional[str]) -> Optional[str]:
    if not cookies_path:
        return None

    candidates = [Path(cookies_path), BASE_DIR / (cookies_path or "")]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)

    # 파일이 없어도 yt-dlp가 경로 문자열을 그대로 사용하도록 반환
    return str(Path(cookies_path))


def _resolve_cached_path(candidate: Path) -> Path:
    if candidate.suffix.lower() == ".mp4":
        return candidate
    return candidate.with_suffix(".mp4")


def extract_youtube_video_id(url: str) -> Optional[str]:
    try:
        parsed = urlparse(url)
    except ValueError:
        return None

    if parsed.netloc in {"youtu.be"}:
        return parsed.path.lstrip("/") or None

    hostname = parsed.netloc.lower()
    path = parsed.path

    if hostname.endswith("youtube.com"):
        if path == "/watch":
            query = parse_qs(parsed.query)
            values = query.get("v", [])
            if values:
                return values[0]
        if path.startswith("/embed/"):
            return path.split("/")[2] if len(path.split("/")) > 2 else None
        if path.startswith("/shorts/"):
            return path.split("/")[2] if len(path.split("/")) > 2 else None

    return None


def canonicalize_youtube_url(url: str) -> tuple[str, Optional[str]]:
    video_id = extract_youtube_video_id(url)
    if video_id:
        return f"https://www.youtube.com/watch?v={video_id}", video_id
    return url.strip(), None


@dataclass(frozen=True)
class VideoDownloadResult:
    original_url: str
    url: str
    path: Path
    video_id: str
    title: Optional[str]
    duration: Optional[float]


def download_youtube_video(url: str, cookies_path: str = "cookies.txt") -> VideoDownloadResult:
    """
    Download a YouTube video into the project-level videos directory.

    If the video was previously downloaded, reuse the cached file instead of
    downloading it again. The file name is derived from the YouTube video ID to
    ensure stability across repeated requests.
    """
    normalized_url, parsed_video_id = canonicalize_youtube_url(url)
    target_url = normalized_url or url

    cookie_file = _resolve_cookie_path(cookies_path)
    out_template = str(VIDEOS_DIR / "%(id)s.%(ext)s")

    ydl_opts = {
        "format": "b[ext=mp4]/b",  # 단일 MP4 스트림 우선 (기존 동작 유지)
        "outtmpl": out_template,
        "force_ipv4": True,
        "noplaylist": True,
        "quiet": False,
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
    }

    if cookie_file:
        ydl_opts["cookiefile"] = cookie_file

    with YoutubeDL(ydl_opts) as ydl:
        # Fetch metadata without downloading to determine the cache path.
        info = ydl.extract_info(target_url, download=False) or {}
        if "id" not in info or not info["id"]:
            info["id"] = parsed_video_id or str(uuid4())
        if "ext" not in info or not info["ext"]:
            info["ext"] = "mp4"

        prepared_path = Path(ydl.prepare_filename(info))
        cached_path = _resolve_cached_path(prepared_path)

        if cached_path.exists():
            return VideoDownloadResult(
                original_url=url,
                url=normalized_url or url,
                path=cached_path,
                video_id=info["id"],
                title=info.get("title"),
                duration=info.get("duration"),
            )

        # Perform the actual download since it is not cached.
        info = ydl.extract_info(target_url, download=True)
        if "id" not in info or not info["id"]:
            info["id"] = parsed_video_id or str(uuid4())
        if "ext" not in info or not info["ext"]:
            info["ext"] = "mp4"

        actual_path = _resolve_cached_path(Path(ydl.prepare_filename(info)))

        return VideoDownloadResult(
            original_url=url,
            url=normalized_url or url,
            path=actual_path,
            video_id=info["id"],
            title=info.get("title"),
            duration=info.get("duration"),
        )


WHISPER_MODEL_NAME = "base"
WHISPER_CPU_THREADS = 16
WHISPER_NUM_WORKERS = 1
WHISPER_COMPUTE_TYPE = "int8"


@dataclass(frozen=True)
class TranscriptionResult:
    text: str
    srt: str
    duration: float


@lru_cache(maxsize=1)
def _get_whisper_model() -> WhisperModel:
    return WhisperModel(
        WHISPER_MODEL_NAME,
        device="cpu",
        compute_type=WHISPER_COMPUTE_TYPE,
        cpu_threads=WHISPER_CPU_THREADS,
        num_workers=WHISPER_NUM_WORKERS,
    )


def transcribe_video_audio(video_path: str) -> TranscriptionResult:
    """
    Transcribe the given video file to text using faster-whisper with the
    predefined CPU-friendly configuration. Returns both the raw transcript and
    SRT-formatted caption text.
    """
    model = _get_whisper_model()
    segments, info = model.transcribe(
        video_path,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=400),
        beam_size=1,
        temperature=0.0,
    )

    transcript_lines: list[str] = []
    srt_entries: list[str] = []

    for index, segment in enumerate(segments, start=1):
        text = (segment.text or "").strip()
        if not text:
            continue

        start_time = float(segment.start or 0.0)
        end_time = float(segment.end or start_time)

        transcript_lines.append(text)
        srt_entries.append(
            f"{index}\n{to_srt_time(start_time)} --> {to_srt_time(end_time)}\n{text}\n"
        )

    transcript_text = "\n".join(transcript_lines).strip()
    srt_text = "\n".join(entry.strip() for entry in srt_entries if entry).strip()
    duration = float(getattr(info, "duration", 0.0) or 0.0)

    return TranscriptionResult(
        text=transcript_text,
        srt=srt_text,
        duration=duration,
    )


def to_srt_time(seconds: float) -> str:
    """Convert seconds float to SRT timestamp (HH:MM:SS,mmm)."""
    total_ms = max(0, int(round(seconds * 1000)))
    hours, remainder = divmod(total_ms, 3600 * 1000)
    minutes, remainder = divmod(remainder, 60 * 1000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"

# -----------------------------
# 2️⃣ 프레임 샘플링
# -----------------------------
def sample_frames(video_path, sample_rate=30):
    cap = cv2.VideoCapture(video_path)
    frames = []
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    for i in range(0, total_frames, sample_rate):
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, frame = cap.read()
        if ret:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            frames.append(gray)
    cap.release()
    return frames


# -----------------------------
# 3️⃣ FFT 기반 아티팩트 점수
# -----------------------------
def fft_artifact_score(frame):
    f = np.fft.fft2(frame)
    fshift = np.fft.fftshift(f)
    magnitude_spectrum = np.abs(fshift)
    h, w = magnitude_spectrum.shape
    center_h, center_w = h // 2, w // 2
    radius = min(center_h, center_w) // 4
    mask = np.ones_like(magnitude_spectrum, dtype=bool)
    mask[center_h - radius:center_h + radius, center_w - radius:center_w + radius] = False
    high_freq_energy = np.sum(magnitude_spectrum[mask])
    total_energy = np.sum(magnitude_spectrum)
        
    # 0 나누기 방지
    if total_energy == 0:
        return 0.0

    score = high_freq_energy / total_energy
    return score


def analyze_fft(frames):
    scores = [fft_artifact_score(f) for f in frames]
    return float(np.mean(scores))


# -----------------------------
# 4️⃣ Optical Flow 기반 동작 점수
# -----------------------------
def analyze_motion(frames):
    flow_scores = []
    for i in range(1, len(frames)):
        prev = frames[i - 1]
        curr = frames[i]
        flow = cv2.calcOpticalFlowFarneback(prev, curr, None, 0.5, 3, 15, 3, 5, 1.2, 0)
        mag, ang = cv2.cartToPolar(flow[..., 0], flow[..., 1])
        flow_scores.append(np.mean(mag))
    return float(np.mean(flow_scores))


# -----------------------------
# 5️⃣ 최종 판정
# -----------------------------
def predict_ai_video(fft_score, motion_score):
        
    # Motion 점수 기준으로 덮어쓰기
    if motion_score <= 3.7:
        result = "AI 생성 가능성 있음"
    elif motion_score >= 6.1:
        result = "실제 영상 가능성 있음"

    if fft_score <= 0.5 or fft_score >= 0.62:
        result = "AI 생성 가능성 있음"
    else:
        result = "실제 영상 가능성 있음"

    return result
