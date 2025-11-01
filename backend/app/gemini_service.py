import json
import logging
import os
import re
from functools import lru_cache
from typing import Any, Optional, Tuple

from google import genai
from google.genai import types
from pydantic import ValidationError

from .schemas import VerificationResult

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_INSTRUCTION = """
# System Instruction: Fact-Check Any Text and Return JSON

**Task**
Given any user-provided content (news, essays, fiction, blogs, academic papers, etc.), identify the primary real-world factual claim and assess its truthfulness.

**Procedure**

* Verify using available knowledge; if web/tools are enabled, corroborate with reputable, up-to-date sources (major outlets, official sites, recognized fact-checkers, primary documents).
* Check date/place consistency, original sources, expert/official statements, and cross-source agreement.
* If evidence is weak, contradictory, or not verifiable, mark low confidence.
* Treat opinions, interpretations, or in-universe (fictional) statements as non-verifiable.

**Output (strict)**
Return **only** one JSON object:

```json
{
  "accuracy": "n%",
  "reason": "1–2 sentences explaining the judgment and key evidence.",
  "urls": ["https://source1.example", "https://source2.example"]
}
```

* `accuracy`: integer percentage as a string `"0%"`–`"100%"`.
* `reason`: **must be in Korean (Hangul)**; concise justification; neutral and nonpartisan.
* `urls`: direct source URLs actually used; if none available, return `[]`.

**Edge Cases**

* If the input lacks a verifiable factual claim, set `"accuracy":"0%"` and explain in `reason`.
* If multiple claims exist, assess the main claim and note that limitation in `reason`.
"""


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
            "response_schema": VerificationResult,
        }

        if tools:
            config_kwargs["tools"] = tools
        else:
            # Gemini currently forbids combining tools with a JSON-only response MIME type.
            config_kwargs["response_mime_type"] = "application/json"

        if thinking_budget is not None:
            config_kwargs["thinking_config"] = types.ThinkingConfig(
                thinking_budget=thinking_budget
            )

        self._generate_config = types.GenerateContentConfig(**config_kwargs)

    def verify(self, news_text: str) -> Tuple[VerificationResult, str]:
        """Send the text to Gemini and return the parsed result plus raw JSON."""
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
            print("Gemini raw response:", response)
        except Exception as exc:  # noqa: BLE001 - expose raw error to caller with context
            logger.exception("Gemini API call failed")
            raise GeminiVerificationError(f"Gemini API call failed: {exc}") from exc

        raw_text = getattr(response, "text", None)
        print("Gemini response text:", raw_text)
        logger.debug("Gemini usage metadata: %s", getattr(response, "usage_metadata", None))

        parsed = getattr(response, "parsed", None)
        if parsed:
            print("Gemini parsed response:", parsed)
            logger.debug("Received structured response from Gemini")
            return self._coerce_verification_result(parsed), raw_text or json.dumps(parsed)

        if not raw_text:
            raise GeminiVerificationError("Gemini response did not include any text payload.")

        logger.debug("Parsing raw Gemini response text: %s", raw_text)

        parsed_json = self._extract_json_from_code_block(raw_text)
        if parsed_json is not None:
            print("Gemini JSON extracted from code block:", parsed_json)
        else:
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

    @staticmethod
    def _extract_json_from_code_block(text: str) -> Optional[Any]:
        """Return JSON parsed from a ```json``` fence if present, else None."""
        pattern = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)
        for match in pattern.finditer(text):
            candidate = match.group(1).strip()
            if not candidate:
                continue
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                logger.debug("Failed to parse JSON code block candidate: %s", candidate)
                continue
        return None


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
        system_instruction=DEFAULT_SYSTEM_INSTRUCTION,
    )
