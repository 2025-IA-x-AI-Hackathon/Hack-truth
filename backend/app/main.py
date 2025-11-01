import logging
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi import File, UploadFile
from .detectors.deepfake_detector import detect_deepfake_image_bytes, MODEL_NAME

from .schemas import ImageVerificationResponse, ImageVerificationResult

from .gemini_service import (
    GeminiConfigurationError,
    GeminiVerificationError,
    GeminiVerifier,
    get_verifier,
)
from .schemas import VerificationRequest, VerificationResponse, VerificationResult


def _load_env() -> bool:
    """Load environment variables from a project-level .env file if present."""
    project_root = Path(__file__).resolve().parent.parent
    env_path = project_root / ".env"
    return load_dotenv(env_path, override=False)


def _configure_logging() -> None:
    """Configure verbose logging for hackathon-friendly debugging."""
    log_level = os.environ.get("LOG_LEVEL", "DEBUG").upper()
    if logging.getLogger().handlers:
        # Avoid duplicate handlers when running via reloaders.
        return

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        stream=sys.stdout,
    )


_env_loaded = _load_env()
_configure_logging()
logger = logging.getLogger(__name__)
if _env_loaded:
    logger.debug("Loaded environment variables from .env file")
else:
    logger.debug("No .env file found; relying on process environment")

app = FastAPI(
    title="HackTruth Backend",
    version="0.1.0",
    description="FastAPI backend that checks if news is fake using Gemini.",
)

# Allow all origins to simplify hackathon integration; tighten later if needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
ALLOWED_IMAGE_EXTENSION_LABEL = ", ".join(
    ext.lstrip(".").upper() for ext in sorted(ALLOWED_IMAGE_EXTENSIONS)
)


def verifier_dependency() -> GeminiVerifier:
    return get_verifier()


@app.get("/health", tags=["meta"])
async def health() -> dict[str, Any]:
    """Simple health endpoint for uptime checks."""
    return {"status": "ok"}



@app.post(
    "/verify/text",
    response_model=VerificationResponse,
    tags=["verification"],
    status_code=status.HTTP_200_OK,
)
async def verify_text(
    payload: VerificationRequest,
    verifier: GeminiVerifier = Depends(verifier_dependency),
) -> VerificationResponse:
    logger.debug("Received verification request: %s", payload)

    try:
        result, raw_response = await run_in_threadpool(verifier.verify, payload.text)
    except GeminiConfigurationError as exc:
        logger.exception("Gemini configuration error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except GeminiVerificationError as exc:
        logger.exception("Gemini verification failed")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - want full traceback in logs
        logger.exception("Unexpected verification failure")
        raise HTTPException(
            status_code=500,
            detail="Unexpected error while verifying the text.",
        ) from exc

    if not isinstance(result, VerificationResult):
        # This should never trigger thanks to validation, but log defensively.
        logger.warning("Verification result was not a VerificationResult instance: %s", result)
        result = VerificationResult.model_validate(result)

    logger.debug(
        "Verification succeeded with accuracy=%s urls=%d",
        result.accuracy,
        len(result.urls),
    )
    return VerificationResponse(result=result, raw_model_response=raw_response)

@app.post(
    "/verify/image",
    response_model=ImageVerificationResponse,
    tags=["verification"],
    status_code=status.HTTP_200_OK,
)
async def verify_image(
    image: UploadFile = File(...),
) -> ImageVerificationResponse:
    """
    이미지가 AI 생성 여부를 판별하는 엔드포인트.
    multipart/form-data 형식으로 이미지를 업로드하면
    딥페이크 식별 모델을 호출해 결과를 반환한다.
    """
    logger.debug("Received image verification request: filename=%s", image.filename)

    filename = image.filename or "uploaded-image"
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        message = (
            "지원하지 않는 이미지 확장자 유형입니다. "
            f"지원 형식: {ALLOWED_IMAGE_EXTENSION_LABEL}."
        )
        logger.warning("Rejected image with unsupported extension: %s", filename)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    if image.content_type and not image.content_type.startswith("image/"):
        logger.warning("Rejected non-image upload: %s (%s)", filename, image.content_type)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 파일만 업로드할 수 있습니다.",
        )

    try:
        content = await image.read()
    except Exception as exc:
        logger.exception("Failed to read uploaded image: filename=%s", filename)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 데이터를 읽는 중 문제가 발생했습니다. 다시 시도해주세요.",
        ) from exc

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="업로드된 이미지가 비어 있습니다. 다른 파일로 다시 시도해주세요.",
        )

    try:
        det = await run_in_threadpool(detect_deepfake_image_bytes, content)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected error while verifying image")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error while verifying the image.",
        ) from exc

    if not det.get("success", False):
        error_message = det.get("error") or "이미지 판별 중 오류가 발생했습니다."
        logger.warning("Image verification failed: %s", error_message)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_message)

    result = ImageVerificationResult(
        success=True,
        verdict=det.get("verdict"),
        confidence=det.get("confidence"),
        fake_prob=det.get("fake_prob"),
        real_prob=det.get("real_prob"),
        error=None,
        model_name=det.get("model_name") or MODEL_NAME,
    )

    logger.debug(
        "Image verification succeeded: verdict=%s confidence=%.4f",
        result.verdict,
        result.confidence or 0.0,
    )
    return ImageVerificationResponse(result=result)
