from typing import List, Optional
from pydantic import BaseModel, Field

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
    raw_model_response: Optional[str] = Field(
        default=None,
        description="Raw JSON string returned by model, preserved for debugging.",
    )


# ===== 이미지 판별용 (신규 추가) =====
'''
class ImageVerificationResult(BaseModel):
    """딥페이크(생성이미지) 판별 결과 정규화."""
    success: bool = Field(..., description="모델 추론 성공 여부")
    verdict: Optional[str] = Field(
        default=None,
        description="판정 결과: 'Fake (딥페이크)' 또는 'Real (진짜)'",
    )
    confidence: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="max(fake_prob, real_prob) ∈ [0,1]",
    )
    fake_prob: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="softmax(outputs.logits)[0]",
    )
    real_prob: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="softmax(outputs.logits)[1]",
    )
    error: Optional[str] = Field(default=None, description="에러 메시지(실패 시)")
    model_name: str = Field(
        default="prithivMLmods/deepfake-detector-model-v1",
        description="사용한 이미지 식별 모델 이름/ID",
    )
'''

class ImageVerificationResult(BaseModel):
    success: bool = Field(..., description="모델 추론 성공 여부")
    verdict: Optional[str] = None          # "Fake (딥페이크)" | "Real (진짜)"
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    fake_prob: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    real_prob: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    error: Optional[str] = None
    model_name: str = Field(default="prithivMLmods/deepfake-detector-model-v1")

class ImageVerificationResponse(BaseModel):
    result: ImageVerificationResult

# 내보낼 심볼 명시(실수 방지)
__all__ = [
    "VerificationRequest",
    "VerificationResult",
    "VerificationResponse",
    "ImageVerificationResult",
    "ImageVerificationResponse",
]
