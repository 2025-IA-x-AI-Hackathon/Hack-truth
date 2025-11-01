import logging
import os
import sys
from pathlib import Path
from typing import Any
from urllib.parse import ParseResult, urlparse

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from .detectors.deepfake_detector import detect_deepfake_image_bytes, MODEL_NAME

from .schemas import (
    ImageVerificationRequest,
    ImageVerificationResponse,
    ImageVerificationResult,
)

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
ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
}
ALLOWED_IMAGE_CONTENT_TYPE_LABEL = ", ".join(
    ctype.split("/")[-1].upper() for ctype in sorted(ALLOWED_IMAGE_CONTENT_TYPES)
)

DEFAULT_IMAGE_REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
}

DEFAULT_IMAGE_TIMEOUT = httpx.Timeout(15.0, connect=10.0)
DEFAULT_IMAGE_RETRIES = 2


def verifier_dependency() -> GeminiVerifier:
    return get_verifier()


def _build_image_request_headers(parsed_url: ParseResult) -> dict[str, str]:
    headers = DEFAULT_IMAGE_REQUEST_HEADERS.copy()
    if parsed_url.scheme and parsed_url.netloc:
        headers["Referer"] = f"{parsed_url.scheme}://{parsed_url.netloc}/"
    return headers


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
    payload: ImageVerificationRequest,
) -> ImageVerificationResponse:
    """
    이미지가 AI 생성 여부를 판별하는 엔드포인트.
    사용자는 이미지 URL을 전달하며, 백엔드는 해당 이미지를 내려받아 판별한다.
    """
    image_url = str(payload.image_url)
    logger.debug("Received image verification request: url=%s", image_url)

    parsed_url = urlparse(image_url)
    raw_path = parsed_url.path
    normalized_path = raw_path.split("!")[0]
    extension = Path(normalized_path).suffix.lower()
    if extension and extension not in ALLOWED_IMAGE_EXTENSIONS:
        message = (
            "지원하지 않는 이미지 확장자 유형입니다. "
            f"지원 형식: {ALLOWED_IMAGE_EXTENSION_LABEL}."
        )
        logger.warning("Rejected image with unsupported extension: %s", image_url)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    request_headers = _build_image_request_headers(parsed_url)

    try:
        transport = httpx.AsyncHTTPTransport(retries=DEFAULT_IMAGE_RETRIES)
        async with httpx.AsyncClient(
            timeout=DEFAULT_IMAGE_TIMEOUT,
            follow_redirects=True,
            headers=request_headers,
            transport=transport,
        ) as client:
            response = await client.get(image_url)
    except httpx.InvalidURL:
        logger.warning("Invalid image URL provided: %s", image_url)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효한 이미지 URL이 아닙니다.",
        )
    except (httpx.TimeoutException, httpx.ConnectError, httpx.RemoteProtocolError) as exc:
        logger.warning("Failed to fetch image: %s (%s)", image_url, exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 URL에 연결할 수 없습니다. 주소를 확인하고 다시 시도해주세요.",
        )
    except httpx.HTTPError as exc:
        logger.warning("HTTP error while fetching image: %s (%s)", image_url, exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 URL을 불러오는 중 오류가 발생했습니다.",
        )

    if response.status_code >= 400:
        logger.warning(
            "Image URL responded with status %s: %s",
            response.status_code,
            image_url,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 URL에서 파일을 가져오지 못했습니다. URL 접근 권한을 확인해주세요.",
        )

    content_type = response.headers.get("content-type", "").split(";")[0].lower()
    if content_type and content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        message = (
            "지원하지 않는 이미지 MIME 유형입니다. "
            f"지원 형식: {ALLOWED_IMAGE_CONTENT_TYPE_LABEL}."
        )
        logger.warning("Rejected image with unsupported MIME type %s: %s", content_type, image_url)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    content = response.content
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 데이터를 내려받지 못했습니다. 다른 URL로 다시 시도해주세요.",
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
