from pydantic import BaseModel
from typing import Optional

class ImageVerificationResult(BaseModel):
    success: bool
    verdict: Optional[str] = None          # "Fake (딥페이크)" | "Real (진짜)"
    confidence: Optional[float] = None     # 0.0 ~ 1.0
    fake_prob: Optional[float] = None
    real_prob: Optional[float] = None
    error: Optional[str] = None
    model_name: str = "prithivMLmods/deepfake-detector-model-v1"

class ImageVerificationResponse(BaseModel):
    result: ImageVerificationResult
