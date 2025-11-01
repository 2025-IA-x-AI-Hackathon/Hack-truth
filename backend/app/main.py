import logging
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

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


def verifier_dependency() -> GeminiVerifier:
    return get_verifier()


@app.get("/health", tags=["meta"])
async def health() -> dict[str, Any]:
    """Simple health endpoint for uptime checks."""
    return {"status": "ok"}


@app.post(
    "/verify-text",
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
