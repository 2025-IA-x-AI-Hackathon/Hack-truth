from transformers import AutoImageProcessor, SiglipForImageClassification
from PIL import Image, UnidentifiedImageError
from io import BytesIO
import torch
import logging

logger = logging.getLogger(__name__)

MODEL_NAME = "prithivMLmods/deepfake-detector-model-v1"
_processor = AutoImageProcessor.from_pretrained(MODEL_NAME)
_model = SiglipForImageClassification.from_pretrained(MODEL_NAME)
_model.eval()


def _error_result(message: str) -> dict:
    return {
        "success": False,
        "verdict": None,
        "confidence": None,
        "fake_prob": None,
        "real_prob": None,
        "error": message,
        "model_name": MODEL_NAME,
    }


def detect_deepfake_image_bytes(file_bytes: bytes) -> dict:
    """업로드된 이미지 바이트로 딥페이크 여부 판별"""
    if not file_bytes:
        return _error_result("이미지 데이터가 비어 있습니다.")

    try:
        image = Image.open(BytesIO(file_bytes))
    except UnidentifiedImageError:
        return _error_result(
            "이미지를 해석할 수 없습니다. 지원되는 정적 이미지 형식(JPG, PNG, WEBP, BMP)인지 확인해주세요."
        )
    except OSError as exc:
        logger.warning("Failed to open image: %s", exc)
        return _error_result(
            "이미지를 열 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다."
        )

    try:
        if getattr(image, "is_animated", False) and getattr(image, "n_frames", 1) > 1:
            return _error_result(
                "정적 이미지만 지원합니다. GIF, APNG 등 애니메이션 이미지는 판별할 수 없습니다."
            )

        if image.mode != "RGB":
            processed_image = image.convert("RGB")
        else:
            processed_image = image

        inputs = _processor(images=processed_image, return_tensors="pt")
        with torch.no_grad():
            outputs = _model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=1).squeeze().tolist()

        fake_prob_raw = float(probs[0])
        real_prob_raw = float(probs[1])
        confidence_raw = max(fake_prob_raw, real_prob_raw)

        verdict = (
            "Fake (딥페이크)"
            if fake_prob_raw >= real_prob_raw
            else "Real (진짜)"
        )

        fake_prob = round(fake_prob_raw, 4)
        real_prob = round(real_prob_raw, 4)
        confidence = round(confidence_raw, 4)

        return {
            "success": True,
            "verdict": verdict,
            "confidence": confidence,
            "fake_prob": fake_prob,
            "real_prob": real_prob,
            "error": None,
            "model_name": MODEL_NAME,
        }

    except Exception as exc:  # noqa: BLE001 - want the traceback in logs
        logger.exception("deepfake detector failure")
        return _error_result(
            "이미지 판별 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
        )
    finally:
        if "processed_image" in locals() and processed_image is not image:
            processed_image.close()
        image.close()
