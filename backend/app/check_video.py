import cv2
import numpy as np
from pytubefix import YouTube
import math
from playwright.sync_api import sync_playwright
import subprocess
import os
import requests

def safe_float(x):
    if x is None or math.isnan(x) or math.isinf(x):
        return 0.0
    return float(x)

# -----------------------------
#  유튜브 영상 다운로드
# -----------------------------
def download_youtube_video(url, filename="video.mp4", cookies_path="cookies.txt"):
    """
    yt-dlp를 사용해서 유튜브 영상을 다운로드합니다.
    - cookies_path: 로그인 상태 유지용 쿠키 파일
    - filename: 현재 경로에 저장할 파일명 (덮어쓰기)
    """
    # 절대경로 변환
    filename = os.path.abspath(filename)

    # yt-dlp 커맨드 생성
    cmd = [
        "yt-dlp",
        "-4",  # IPv4 사용
        "--cookies", cookies_path,
        "-f", "b[ext=mp4]/b",  # mp4 포맷 우선
        "-o", filename,
        url
    ]

    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"영상 다운로드 실패: {e}")

    return filename

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
def predict_ai_video(fft_score, motion_score,
                     fft_threshold=0.6, motion_threshold=7.0):
    fft_flag = fft_score < fft_threshold
    motion_flag = motion_score < motion_threshold

    # motion_score가 너무 낮으면 fft_flag와 상관없이 AI 생성 가능성 중간
    if motion_score <= 4.59:
        return "AI 생성 가능성 중간"

    if fft_flag and motion_flag:
        return "AI 생성 가능성 높음"
    elif fft_flag:
        return "AI 생성 가능성 중간"
    elif motion_flag:
        return "실제 영상 가능성 중간"
    else:
        return "실제 영상 가능성 높음"
