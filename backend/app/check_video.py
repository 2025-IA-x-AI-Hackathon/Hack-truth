import cv2
import numpy as np
from pytubefix import YouTube
import math
from playwright.sync_api import sync_playwright
import os
from yt_dlp import YoutubeDL

def safe_float(x):
    if x is None or math.isnan(x) or math.isinf(x):
        return 0.0
    return float(x)

# -----------------------------
#  유튜브 영상 다운로드
# -----------------------------
def download_youtube_video(url, filename="video.mp4", cookies_path="cookies.txt"):
    filename = os.path.abspath(filename)

    if os.path.exists(filename):
        os.remove(filename)

    ydl_opts = {
        "format": 'b[ext=mp4]/b',      # 단일 mp4 파일
        "outtmpl": filename,           # 저장 경로
        "force_ipv4": True,            # IPv6 문제 회피
        "noplaylist": True,            # 플레이리스트 방지
        "quiet": False
    }

    if cookies_path:
        ydl_opts["cookiefile"] = cookies_path

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        saved_path = ydl.prepare_filename(info)

    return saved_path

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
            # ① 그레이 변환
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            # ② 가우시안 블러로 노이즈 제거
            frame = cv2.GaussianBlur(frame, (5, 5), 0)
            frames.append(frame)
    
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
