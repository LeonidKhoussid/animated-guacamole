import logging
from PIL import Image
from pathlib import Path
from typing import Optional


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(h)


# Нормализация на вход модели
def normalize_image_size(
    image: Image.Image,
    min_size: Optional[int] = None,
    max_size: Optional[int] = None,
    divisible_by: int = 8
) -> Image.Image:
    if image.mode != "RGB":
        image = image.convert("RGB")
    w, h = image.size
    if min_size and (w < min_size or h < min_size):
        s = min_size / min(w, h)
        w, h = int(w * s), int(h * s)
    if max_size and (w > max_size or h > max_size):
        s = max_size / max(w, h)
        w, h = int(w * s), int(h * s)
    w = _round_to_multiple(w, divisible_by)
    h = _round_to_multiple(h, divisible_by)
    if (w, h) != image.size:
        logger.info(f"Изменение размера: {image.size} -> ({w}, {h})")
        image = image.resize((w, h), Image.Resampling.LANCZOS)
    return image


# Округление (чтобы делилось на 8)
def _round_to_multiple(value: int, multiple: int) -> int:
    return ((value + multiple - 1) // multiple) * multiple


# Загрузка
def normalize_image_from_path(
    image_path: Path,
    min_size: Optional[int] = None,
    max_size: Optional[int] = None,
    divisible_by: int = 8
) -> Optional[Image.Image]:
    if not image_path.exists():
        logger.error(f"Файл не найден: {image_path}")
        return None
    try:
        img = Image.open(image_path)
        return normalize_image_size(img, min_size=min_size, max_size=max_size, divisible_by=divisible_by)
    except Exception as e:
        logger.error(f"Ошибка загрузки {image_path}: {e}")
        return None


# from ml_service.utils.image_normalizer import normalize_image_from_path
# # Запуск
# if __name__ == "__main__":
#     img = normalize_image_from_path(Path("path/to/image.jpg"))
#     # print(img.size)
