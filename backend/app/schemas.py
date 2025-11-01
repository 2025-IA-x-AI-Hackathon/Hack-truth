from typing import Literal, Optional

from pydantic import BaseModel, Field


class VerificationRequest(BaseModel):
    """Payload coming from the frontend."""

    text: str = Field(..., min_length=1, description="Raw news article or text to verify.")


class VerificationResult(BaseModel):
    """Normalized Gemini output."""

    verdict: Literal["real", "fake", "uncertain"] = Field(
        ...,
        description="Model's classification of the news.",
    )
    accuracy: str = Field(
        ...,
        description="Model confidence expressed as a percentage string, e.g. '82%'.",
    )
    reason: str = Field(
        ...,
        description="Short explanation for the verdict.",
    )


class VerificationResponse(BaseModel):
    """HTTP response returned to the frontend."""

    result: VerificationResult
    raw_model_response: Optional[str] = Field(
        default=None,
        description="Raw JSON string returned by Gemini, preserved for debugging.",
    )
