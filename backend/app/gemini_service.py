import json
import logging
import os
from functools import lru_cache
from typing import Optional, Tuple

from google import genai
from google.genai import types
from pydantic import ValidationError

from .schemas import VerificationResult

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_INSTRUCTION = (
    "You are an investigative journalist. Verify whether the provided news text is fake or real. "
    "Respond strictly as JSON following the schema: "
    "{\"verdict\": \"real|fake|uncertain\", \"accuracy\": \"<percent>%\", \"reason\": \"<short explanation>\"}. "
    "Use 'uncertain' if you cannot confidently decide. Keep accuracy between 0% and 100%."
)


class GeminiConfigurationError(RuntimeError):
    """Raised when the Gemini client is misconfigured."""


class GeminiVerificationError(RuntimeError):
    """Raised when the Gemini API response cannot be parsed."""


class GeminiVerifier:
    """Thin wrapper around the google-genai client for news verification."""

    def __init__(
        self,
        *,
        model: str,
        temperature: float = 0.2,
        enable_google_search: bool = True,
        thinking_budget: Optional[int] = -1,
        system_instruction: Optional[str] = None,
    ) -> None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise GeminiConfigurationError(
                "Environment variable GEMINI_API_KEY is required to call the Gemini API."
            )

        logger.debug("Initializing Gemini client for model '%s'", model)
        self._client = genai.Client(api_key=api_key)
        self._model = model

        tools = []
        if enable_google_search:
            tools.append(types.Tool(googleSearch=types.GoogleSearch()))

        config_kwargs = {
            "system_instruction": system_instruction or DEFAULT_SYSTEM_INSTRUCTION,
            "temperature": temperature,
            "response_mime_type": "application/json",
            "response_schema": VerificationResult,
        }

        if tools:
            config_kwargs["tools"] = tools

        if thinking_budget is not None:
            config_kwargs["thinking_config"] = types.ThinkingConfig(
                thinking_budget=thinking_budget
            )

        self._generate_config = types.GenerateContentConfig(**config_kwargs)

    def verify(self, news_text: str) -> Tuple[VerificationResult, str]:
        """Send the text to Gemini and return the parsed verdict plus raw JSON."""
        if not news_text.strip():
            raise GeminiVerificationError("News text is empty after trimming whitespace.")

        logger.debug(
            "Sending %s characters to Gemini model '%s'",
            len(news_text),
            self._model,
        )

        contents = [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=news_text)],
            )
        ]

        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=contents,
                config=self._generate_config,
            )
        except Exception as exc:  # noqa: BLE001 - expose raw error to caller with context
            logger.exception("Gemini API call failed")
            raise GeminiVerificationError(f"Gemini API call failed: {exc}") from exc

        raw_text = getattr(response, "text", None)
        logger.debug("Gemini usage metadata: %s", getattr(response, "usage_metadata", None))

        parsed = getattr(response, "parsed", None)
        if parsed:
            logger.debug("Received structured response from Gemini")
            return self._coerce_verification_result(parsed), raw_text or json.dumps(parsed)

        if not raw_text:
            raise GeminiVerificationError("Gemini response did not include any text payload.")

        logger.debug("Parsing raw Gemini response text: %s", raw_text)
        try:
            parsed_json = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            logger.exception("Gemini returned invalid JSON")
            raise GeminiVerificationError("Gemini returned invalid JSON payload.") from exc

        try:
            result = self._coerce_verification_result(parsed_json)
        except ValidationError as exc:
            logger.exception("Gemini JSON could not be validated against the schema.")
            raise GeminiVerificationError(
                "Gemini JSON did not match the expected schema."
            ) from exc

        return result, raw_text

    @staticmethod
    def _coerce_verification_result(candidate: object) -> VerificationResult:
        if isinstance(candidate, VerificationResult):
            return candidate
        return VerificationResult.model_validate(candidate)


@lru_cache(maxsize=1)
def get_verifier() -> GeminiVerifier:
    """Lazily construct a singleton verifier using environment configuration."""
    model = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
    enable_search = os.environ.get("GEMINI_ENABLE_GOOGLE_SEARCH", "true").lower() == "true"
    thinking_budget_str = os.environ.get("GEMINI_THINKING_BUDGET", "-1")
    try:
        thinking_budget = int(thinking_budget_str) if thinking_budget_str else None
    except ValueError:
        logger.warning(
            "Invalid GEMINI_THINKING_BUDGET='%s'. Falling back to -1.",
            thinking_budget_str,
        )
        thinking_budget = -1

    temperature_str = os.environ.get("GEMINI_TEMPERATURE", "0.95")
    try:
        temperature = float(temperature_str)
    except ValueError:
        logger.warning("Invalid GEMINI_TEMPERATURE='%s'. Falling back to 0.95.", temperature_str)
        temperature = 0.95

    return GeminiVerifier(
        model=model,
        temperature=temperature,
        enable_google_search=enable_search,
        thinking_budget=thinking_budget,
        system_instruction=os.environ.get("GEMINI_SYSTEM_INSTRUCTION"),
    )
