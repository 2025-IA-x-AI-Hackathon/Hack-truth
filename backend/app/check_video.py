import cv2
import numpy as np
from pytubefix import YouTube

# -----------------------------
# 1️⃣ 유튜브 영상 다운로드
# -----------------------------
def download_youtube_video(url, filename="video.mp4"):
    yt = YouTube(url)
    stream = yt.streams.filter(file_extension="mp4", progressive=True).first()
    stream.download(filename=filename)
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

    if fft_flag and motion_flag:
        return "AI 생성 가능성 높음"
    elif fft_flag:
        return "AI 생성 가능성 중간"
    elif motion_flag:
        return "실제 영상 가능성 중간"
    else:
        return "실제 영상 가능성 높음"
