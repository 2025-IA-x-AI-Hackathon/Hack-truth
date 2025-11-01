from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, HttpUrl

# ===== 텍스트 판별용 (기존 유지) =====
class VerificationRequest(BaseModel):
    """Payload coming from the frontend."""
    text: str = Field(..., min_length=1, description="Raw news article or text to verify.")


class VerificationResult(BaseModel):
    """Normalized Gemini output."""
    accuracy: str = Field(
        ...,
        description="Model confidence expressed as a percentage string, e.g. '82%'.",
    )
    accuracy_reason: str = Field(
        ...,
        description="Short Korean explanation describing why the given accuracy score was selected.",
    )
    reason: str = Field(
        ...,
        description="Short explanation for the assessment.",
    )
    urls: List[str] = Field(
        ...,
        description="List of reference URLs that support the reasoning.",
    )


class VerificationResponse(BaseModel):
    """HTTP response returned to the frontend."""
    result: VerificationResult
    record_id: UUID = Field(
        ...,
        description="Primary key of the persisted verification record.",
    )
    raw_model_response: Optional[str] = Field(
        default=None,
        description="Raw JSON string returned by model, preserved for debugging.",
    )


class VerificationRecordDetail(BaseModel):
    """Stored verification record retrieved by record_id."""
    record_id: UUID = Field(..., description="Primary key of the persisted verification record.")
    input_text: str = Field(..., description="Original text that was verified.")
    result: VerificationResult
    raw_model_response: Optional[str] = Field(
        default=None,
        description="Raw JSON string returned by model, preserved for debugging.",
    )
    created_at: datetime = Field(..., description="Timestamp when the record was stored.")


class ImageVerificationRequest(BaseModel):
    """이미지 판별 요청 (URL 기반)."""

    image_url: HttpUrl = Field(
        ...,
        description="확인할 이미지의 절대 URL.",
    )

class ImageVerificationResult(BaseModel):
    success: bool = Field(..., description="모델 추론 성공 여부")
    verdict: Optional[str] = Field(
        default=None,
        description="판정 결과. 'Real' 또는 'Fake' 문자열.",
    )
    confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="가장 높은 확률(%) 값. 0.0~100.0 사이.",
    )
    fake_prob: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="딥페이크 확률(%). 0.0~100.0 사이.",
    )
    real_prob: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="진짜 이미지 확률(%). 0.0~100.0 사이.",
    )
    error: Optional[str] = None
    model_name: str = Field(default="prithivMLmods/deepfake-detector-model-v1")

class ImageVerificationResponse(BaseModel):
    result: ImageVerificationResult


class GeminiImageVerdict(BaseModel):
    fake: str = Field(
        ...,
        description="Gemini가 반환한 AI 생성 가능성(%) 문자열, 예: '65%'.",
    )
    reason: str = Field(
        ...,
        description="Gemini가 제공한 한국어 판정 근거 (1~3문장).",
    )


class GeminiImageVerificationResponse(BaseModel):
    result: GeminiImageVerdict
    raw_model_response: Optional[str] = Field(
        default=None,
        description="Gemini가 반환한 원본 JSON 문자열 (디버깅용).",
    )

# 내보낼 심볼 명시(실수 방지)
__all__ = [
    "VerificationRequest",
    "VerificationResult",
    "VerificationResponse",
    "VerificationRecordDetail",
    "ImageVerificationRequest",
    "ImageVerificationResult",
    "ImageVerificationResponse",
    "GeminiImageVerdict",
    "GeminiImageVerificationResponse",
]

class VideoRequest(BaseModel):
    url: str

class VideoResponse(BaseModel):
    fft_artifact_score: str
    action_pattern_score: str
    result: str
