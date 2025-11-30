import os
import re
import json
from pathlib import Path

import pdfplumber
from ml_service.modeling.ocr import OCRExtractor


class EGRNExtractor:
    """ПАРСЕР ПДФОК ЕГРНА В БД"""

    def __init__(self, debug: bool = None, use_ocr: bool = True):
        from config import EGRNConfig, OCRConfig

        self.config = EGRNConfig()
        ocr_cfg = OCRConfig()
        self.debug = debug if debug is not None else ocr_cfg.debug
        self.use_ocr = use_ocr
        Path(self.config.output_dir).mkdir(parents=True, exist_ok=True)
        
        if self.use_ocr:
            self.ocr = OCRExtractor(
                model_name=ocr_cfg.model_name,
                model_dir=ocr_cfg.model_dir,
                device=ocr_cfg.device,
                debug=self.debug,
                standard_width=ocr_cfg.standard_width,
                standard_height=ocr_cfg.standard_height
            )
        else:
            self.ocr = None

        self.patterns = {
            "object_id": [
                r"Кадастровый\s+номер[:\s]+(.+)",
                r"Кадастровый\s*номер[:\s]+(.+)",
            ],
            "address": [
                r"Местоположение[:\s]+(.+)",
                r"Адрес[:\s]+(.+)",
            ],
            "total_area": [
                r"Площадь[,\s]*м\s*2[:\s]+(.+)",
                r"Площадь[:\s]+(.+)",
            ],
            "cadastral_price": [
                r"Кадастровая\s+стоимость[,\s]*руб\.?[:\s]+(.+)",
                r"Кадастровая\s+стоимость[:\s]+(.+)",
            ],
            "floor": [
                r"Номер[,\s]+тип\s+этажа[,\s]+на\s+котором\s+расположено\s+помещение[,\s]+машино-место[:\s]+(.+)",
                r"Этаж[:\s]+(.+)",
            ],
            "reg_date": [
                r"Дата\s+присвоения\s+кадастрового\s+номера[:\s]+(.+)",
                r"Дата\s+присвоения[:\s]+(.+)",
            ],
            "object_type": [
                r"Вид\s+жилого\s+помещения[:\s]+(.+)",
                r"Вид\s+помещения[:\s]+(.+)",
            ],
            "owner": [
                r"Правообладатель\s*\(правообладатели\)[:\s]+(.+)",
                r"Правообладатель[:\s]+(.+)",
                r"Собственник[:\s]+(.+)",
            ],
        }

    # Чтение
    def _read_pdf_text(self, file_path: Path) -> str:
        parts = []
        with pdfplumber.open(str(file_path)) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                parts.append(text)
        return "\n".join(parts)

    # Нормализация
    def _normalize_text(self, text: str) -> str:
        if not text:
            return ""
        text = text.replace("\xa0", " ")
        text = text.replace("\u2009", " ")
        text = text.replace("\u2006", " ")
        text = text.replace("\u2007", " ")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\s+\n", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        lines = [line.strip() for line in text.split("\n")]
        text = "\n".join(lines)
        return text.strip()

    # Мыло
    def _extract_email(self, text: str) -> str:
        return "example@.mail.ru" # при регистрации будет пользователя

    # Очистка owner от префиксов
    def _clean_owner(self, owner_text: str) -> str:
        if not owner_text:
            return owner_text
        cleaned = re.sub(r"^\s*\d+\.\s*\d+\.\s*", "", owner_text).strip()
        if cleaned == owner_text:
            cleaned = re.sub(r"^\s*\d+\.\s*", "", owner_text).strip()
        if cleaned == owner_text:
            cleaned = re.sub(r"^[\d.\s]+", "", owner_text).strip()
        return cleaned

    # Поля по паттернам
    def _extract_by_patterns(self, text: str) -> dict:
        result: dict[str, str | None] = {
            "table_properties": "выписка из егрн",
            "user_id": self._extract_email(text),
            "object_id": None,
            "address": None,
            "owner": None,
            "object_type": None,
            "reg_date": None,
            "total_area": None,
            "cadastral_price": None,
            "floor": None,
        }

        for field, patterns in self.patterns.items():
            if result.get(field):
                continue
            for pattern in patterns:
                m = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
                if m:
                    value = m.group(1).strip()
                    value = re.split(r"[\r\n]", value)[0].strip(" ,;.")
                    if field == "owner":
                        value = self._clean_owner(value)
                    result[field] = value
                    break

        return result

    # Для собвстенника
    def _final_cleanup(self, data: dict) -> dict:
        if data.get("owner"):
            data["owner"] = self._clean_owner(data["owner"])
        return data

    # Группировка изображений
    def _group_images(self, image_files: list[Path]) -> dict[str, list[Path]]:
        groups: dict[str, list[Path]] = {}
        for f in image_files:
            stem = f.stem
            prefix = re.sub(r"\d+$", "", stem)
            key = prefix if prefix else "doc"
            groups.setdefault(key, []).append(f)
        return groups

    # Общий процессинг по тексту
    def process_pdf(self, file_path: Path) -> dict:
        raw_text = self._read_pdf_text(file_path)
        norm_text = self._normalize_text(raw_text)
        data = self._extract_by_patterns(norm_text)
        return data

    # По каждому изображению в документе
    def process_images_group(self, group_name: str, image_files: list[Path]) -> dict:
        if not self.use_ocr or self.ocr is None:
            import logging
            logging.warning(f"OCR отключен, пропуск группы {group_name}")
            return {
                "table_properties": "выписка из егрн",
                "user_id": "example@.mail.ru",
                "object_id": None,
                "address": None,
                "owner": None,
                "object_type": None,
                "reg_date": None,
                "total_area": None,
                "cadastral_price": None,
                "floor": None,
                "source_files": [os.path.basename(p) for p in sorted(image_files)],
                "group_name": group_name,
            }

        pdf_dir = Path(getattr(self.config, "pdf_output_dir", self.config.output_dir))
        pdf_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = pdf_dir / f"{group_name}.pdf"
        try:
            self.ocr.images_to_pdf(image_files, pdf_path)
        except Exception as e:
            if self.debug:
                import logging
                logging.warning(f"Ошибка в создании PDF: {e}") # для OCR из .jpg 01 02 03

        raw_text = self.ocr.images_to_text(image_files)
        
        if not raw_text or not raw_text.strip():
            if self.debug:
                import logging
                logging.warning(f"ВНИМАНИЕ: Текст не распознан {group_name}!")
                logging.warning(f"Файлы: {[os.path.basename(p) for p in image_files]}")
        
        if self.debug:
            import logging
            logging.info(f"\n{'='*60}")
            logging.info(f"Группа: {group_name}")
            logging.info(f"Сырой текст (длина: {len(raw_text)}):\n{raw_text[:1000]}...")
            logging.info(f"{'='*60}\n")
        
        norm_text = self._normalize_text(raw_text)
        
        if self.debug:
            import logging
            logging.info(f"Нормализованный текст (длина: {len(norm_text)}):\n{norm_text[:1000]}...")
            logging.info(f"{'='*60}\n")
        
        data = self._extract_by_patterns(norm_text)
        
        if self.debug:
            import logging
            logging.info(f"Найденные поля для {group_name}:")
            for key, value in data.items():
                if value:
                    logging.info(f"  {key}: {value}")
            logging.info("")
        
        data["source_files"] = [os.path.basename(p) for p in sorted(image_files)]
        data["group_name"] = group_name
        data["pdf_file"] = os.path.basename(pdf_path)
        return data

    # Основная функция
    def run_pipeline(self, input_dir: Path | None = None) -> None:
        if input_dir is None:
            input_dir = Path(self.config.input_dir)
        else:
            input_dir = Path(input_dir)
        output_dir = Path(self.config.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        pdf_exts = getattr(self.config, "pdf_ext", [".pdf"])
        pdf_files: list[Path] = []
        for ext in pdf_exts:
            pdf_files.extend(sorted(input_dir.glob(f"*{ext}")))
        for pdf_file in pdf_files:
            if not pdf_file.is_file():
                continue
            data = self.process_pdf(pdf_file)
            data = self._final_cleanup(data)
            out_name = pdf_file.stem + "_properties.json"
            out_path = output_dir / out_name
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

        image_files: list[Path] = []
        image_exts = getattr(self.config, "image_ext", [".jpg", ".jpeg", ".png"])
        for ext in image_exts:
            image_files.extend(sorted(input_dir.glob(f"*{ext}")))

        if image_files:
            groups = self._group_images(image_files)
            for group_name, files in groups.items():
                data = self.process_images_group(group_name, files)
                data = self._final_cleanup(data)
                out_name = f"{group_name}_images_properties.json"
                out_path = output_dir / out_name
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)


# from ml_service.utils.egrn_extractor import EGRNExtractor
# # Запуск
# if __name__ == "__main__":
#     pipeline = EGRNExtractor(debug=True, use_ocr=True)
#     pipeline.run_pipeline()
