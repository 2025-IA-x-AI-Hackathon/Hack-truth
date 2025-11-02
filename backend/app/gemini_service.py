import json
import logging
import os
import re
from functools import lru_cache
from threading import Lock
from typing import Any, Optional, Tuple

from google import genai
from google.genai import types
from pydantic import ValidationError

from .schemas import GeminiImageVerdict, VerificationResult

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
  "accuracy_reason": "짧은 문장으로 정확도 배경을 설명 (한국어).",
  "reason": "1–2 sentences explaining the judgment and key evidence (Korean).",
  "urls": ["https://source1.example", "https://source2.example"]
}
```

* `accuracy`: integer percentage as a string `"0%"`–`"100%"`.
* `accuracy_reason`: **must be in Korean (Hangul)**; clarify why the score was chosen, referencing supporting evidence.
* `reason`: **must be in Korean (Hangul)**; concise verdict description; neutral and nonpartisan.
* `urls`: direct source URLs actually used; if none available, return `[]`.

**Edge Cases**

* If the input lacks a verifiable factual claim, set `"accuracy":"0%"` and explain in `reason`.
* If multiple claims exist, assess the main claim and note that limitation in `reason`.
"""


IMAGE_SYSTEM_INSTRUCTION = """
# System Instruction: AI-Generated Image Detector (Concise)

**Task**
Determine if the attached image contains **AI-generated content**. For YouTube/content thumbnails: normal human-made composites from real photos are **not** generative; if **any element** appears AI-generated, treat the whole as generative and name the element.

**Output (strict)**
Return **only one JSON object**:
`{"fake":"NN%","reason":"..."}`

* `"fake"`: 0–100% (round to nearest 5).
* `"reason"`: **Korean only**, 1–3 concise sentences with concrete cues.

**Hard rules**

* JSON only; no extra text.
* Ignore printed/overlaid **dates/times** as evidence (current date: 2025-11-02).
* If image is too small/corrupted/unreadable, return a cautious score (e.g., **50%**) and say so in Korean.

**Method**

1. **Triage**: obvious real-photo composite with basic edits → lean low.
2. **AI cues** (examples): 비현실적 피부/질감, 해부학 오류(손가락·치아), 왜곡/융합, 그림자·반사 불일치, 글자 왜곡/난삽, 반복 무늬/깊이 오류, 반사체 불일치.
3. **Editing vs generation**: 색보정·자막·간단 합성 = 비생성. 배경/사물/인물 **창출**(in/out-painting 포함) = 생성.
4. **Metadata**(있다면) 참고만; 단독 근거로 사용 금지.

**Confidence guide**

* Real/edit only: **0–20%**
* Uncertain/mixed: **25–60%**
* Multiple strong AI cues or explicit AI composite: **65–100%**

**Multi-image/Collage**
If any panel/부분이 AI로 보이면 **생성형**으로 판단하고 해당 영역을 이유에 명시.
"""


class GeminiConfigurationError(RuntimeError):
    """Raised when the Gemini client is misconfigured."""


class GeminiVerificationError(RuntimeError):
    """Raised when the Gemini API response cannot be parsed."""


def _discover_gemini_api_keys() -> list[str]:
    """Return the ordered list of Gemini API keys configured via environment variables."""
    keys: list[str] = []

    multi_value = os.environ.get("GEMINI_API_KEYS")
    if multi_value:
        candidates = re.split(r"[\s,]+", multi_value)
        keys.extend(candidate.strip() for candidate in candidates if candidate.strip())

    index = 1
    while True:
        sequential_key = os.environ.get(f"GEMINI_API_KEY_{index}")
        if not sequential_key:
            break
        keys.append(sequential_key.strip())
        index += 1

    single_key = os.environ.get("GEMINI_API_KEY")
    if single_key:
        keys.append(single_key.strip())

    # Preserve order while removing duplicates and empty entries.
    unique_keys: list[str] = []
    seen: set[str] = set()
    for key in keys:
        if not key or key in seen:
            continue
        unique_keys.append(key)
        seen.add(key)

    return unique_keys


class GeminiClientPool:
    """Round-robin pool of Gemini clients backed by multiple API keys."""

    def __init__(self, api_keys: list[str]) -> None:
        filtered_keys = [key.strip() for key in api_keys if key and key.strip()]
        if not filtered_keys:
            raise GeminiConfigurationError(
                "Environment variable GEMINI_API_KEYS (or GEMINI_API_KEY) must provide at least one API key."
            )

        self._keys = filtered_keys
        self._clients: dict[str, genai.Client] = {}
        self._lock = Lock()
        self._index = 0

    def acquire_client(self) -> genai.Client:
        with self._lock:
            key = self._keys[self._index]
            self._index = (self._index + 1) % len(self._keys)

            client = self._clients.get(key)
            if client is None:
                client = genai.Client(api_key=key)
                self._clients[key] = client

        return client

    @property
    def size(self) -> int:
        return len(self._keys)


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
        api_keys = _discover_gemini_api_keys()
        self._client_pool = GeminiClientPool(api_keys)

        if self._client_pool.size > 1:
            logger.info(
                "Initializing Gemini client pool for model '%s' with %d API keys",
                model,
                self._client_pool.size,
            )
        else:
            logger.debug("Initializing Gemini client for model '%s'", model)

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
            client = self._client_pool.acquire_client()
            response = client.models.generate_content(
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

    temperature_str = os.environ.get("GEMINI_TEMPERATURE", "0.2")
    try:
        temperature = float(temperature_str)
    except ValueError:
        logger.warning("Invalid GEMINI_TEMPERATURE='%s'. Falling back to 0.2.", temperature_str)
        temperature = 0.2

    return GeminiVerifier(
        model=model,
        temperature=temperature,
        enable_google_search=enable_search,
        thinking_budget=thinking_budget,
        system_instruction=DEFAULT_SYSTEM_INSTRUCTION,
    )


class GeminiImageVerifier:
    """Gemini client wrapper for image-based AI detection."""

    def __init__(
        self,
        *,
        model: str,
        thinking_budget: Optional[int] = -1,
        image_aspect_ratio: Optional[str] = None,
    ) -> None:
        api_keys = _discover_gemini_api_keys()
        self._client_pool = GeminiClientPool(api_keys)
        self._model = model

        response_schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "fake": types.Schema(type=types.Type.STRING),
                "reason": types.Schema(type=types.Type.STRING),
            },
            required=["fake", "reason"],
        )

        config_kwargs: dict[str, Any] = {
            "system_instruction": IMAGE_SYSTEM_INSTRUCTION,
            "response_schema": response_schema,
            "response_mime_type": "application/json",
        }

        if image_aspect_ratio:
            config_kwargs["image_config"] = types.ImageConfig(
                aspect_ratio=image_aspect_ratio
            )

        if thinking_budget is not None:
            config_kwargs["thinking_config"] = types.ThinkingConfig(
                thinking_budget=thinking_budget
            )

        self._generate_config = types.GenerateContentConfig(**config_kwargs)

    def verify(self, image_bytes: bytes, mime_type: Optional[str]) -> Tuple[GeminiImageVerdict, str]:
        if not image_bytes:
            raise GeminiVerificationError("Image bytes payload is empty.")

        normalized_mime = (mime_type or "image/jpeg").lower()

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_bytes(data=image_bytes, mime_type=normalized_mime),
                ],
            )
        ]

        try:
            client = self._client_pool.acquire_client()
            response = client.models.generate_content(
                model=self._model,
                contents=contents,
                config=self._generate_config,
            )
        except Exception as exc:  # noqa: BLE001 - expose raw error to caller with context
            logger.exception("Gemini image API call failed")
            raise GeminiVerificationError(f"Gemini API call failed: {exc}") from exc

        raw_text = getattr(response, "text", None)
        logger.debug("Gemini image usage metadata: %s", getattr(response, "usage_metadata", None))

        parsed = getattr(response, "parsed", None)
        if parsed is not None:
            logger.debug("Received structured response from Gemini image model")
            result = self._coerce_result(parsed)
            return result, raw_text or json.dumps(result.model_dump(), ensure_ascii=False)

        if not raw_text:
            raise GeminiVerificationError("Gemini image response did not include any text payload.")

        try:
            parsed_json = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            logger.exception("Gemini image response was not valid JSON")
            raise GeminiVerificationError("Gemini image response was not valid JSON.") from exc

        result = self._coerce_result(parsed_json)
        return result, raw_text

    @staticmethod
    def _coerce_result(candidate: object) -> GeminiImageVerdict:
        try:
            return GeminiImageVerdict.model_validate(candidate)
        except ValidationError as exc:
            logger.exception("Gemini image JSON did not match expected schema")
            raise GeminiVerificationError(
                "Gemini image JSON did not match the expected schema."
            ) from exc


@lru_cache(maxsize=1)
def get_image_verifier() -> GeminiImageVerifier:
    """Lazily construct a singleton image verifier using environment configuration."""

    model = os.environ.get("GEMINI_IMAGE_MODEL") or os.environ.get("GEMINI_MODEL", "gemini-flash-latest")

    thinking_budget_str = os.environ.get("GEMINI_IMAGE_THINKING_BUDGET") or os.environ.get("GEMINI_THINKING_BUDGET", "-1")
    try:
        thinking_budget = int(thinking_budget_str) if thinking_budget_str else None
    except ValueError:
        logger.warning(
            "Invalid GEMINI_IMAGE_THINKING_BUDGET='%s'. Falling back to -1.",
            thinking_budget_str,
        )
        thinking_budget = -1

    image_aspect_ratio = os.environ.get("GEMINI_IMAGE_ASPECT_RATIO")

    return GeminiImageVerifier(
        model=model,
        thinking_budget=thinking_budget,
        image_aspect_ratio=image_aspect_ratio,
    )
