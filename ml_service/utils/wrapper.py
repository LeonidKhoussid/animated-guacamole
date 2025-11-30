import logging
from typing import List
from pathlib import Path


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(ch)


class OCRDebugWrapper:
    """ДЕБАГ ДЛЯ OCR"""

    def __init__(self):
        pass

    # Логи с картинки
    def log_image_text(self, image_path: Path, text: str, page_num: int = 0):
        logger.info(f"\n{'='*60}")
        logger.info(f"Файл: {image_path.name} | Страница: {page_num}")
        logger.info(f"{'='*60}")
        if text:
            logger.info(f"Распознанный текст:\n{text}")
        else:
            logger.warning("Текст не распознан!")
        logger.info(f"{'='*60}\n")

    # Логи с текста
    def log_all_texts(self, image_files: List[Path], all_text: str):
        logger.info(f"\n{'='*60}")
        logger.info("ВСЕ РАСПОЗНАННЫЕ ТЕКСТЫ")
        logger.info(f"{'='*60}")
        for i, img_path in enumerate(sorted(image_files), 1):
            logger.info(f"Файл {i}: {img_path.name}")
        logger.info(f"\n{all_text}")
        logger.info(f"{'='*60}\n")


# from ml_service.utils.wrapper import OCRDebugWrapper
# # Запуск
# if __name__ == "__main__":
#     wrapper = OCRDebugWrapper()
#     # примеры использования
#     # wrapper.log_image_text(Path(), "", 1)
