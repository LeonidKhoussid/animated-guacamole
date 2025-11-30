import cv2
import torch
import shutil
import logging
import tempfile
import numpy as np
import pandas as pd
from PIL import Image
from pathlib import Path
from PyPDF2 import PdfMerger
from typing import List, Tuple, Dict, Optional, Any
from transformers import TrOCRProcessor, VisionEncoderDecoderModel


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(ch)


class OCRExtractor:
    """OCR ЕСЛИ БУДЕТ ФОТО"""

    def __init__(self, model_name: str = "microsoft/trocr-base-printed", model_dir: str = "./models/trocr-base-printed", device: str = "cpu", debug: bool = False, standard_width: int = 1920, standard_height: int = 2560):
        self.model_name = model_name
        self.model_dir = Path(model_dir)
        self.debug = debug
        self.standard_width = standard_width
        self.standard_height = standard_height
        
        if device == "cpu" or device is None:
            from config import CUDAConfig
            cuda_cfg = CUDAConfig()
            self.device = cuda_cfg.device
        else:
            self.device = device if torch.cuda.is_available() and device.startswith("cuda") else "cpu"
        
        self.processor = None
        self.model = None
        self._load_model()
        
        if self.debug:
            from ml_service.utils.wrapper import OCRDebugWrapper
            self.debug_wrapper = OCRDebugWrapper()
        else:
            self.debug_wrapper = None

    # Загрузка модели
    def _load_model(self):
        try:
            model_path = self.model_dir / "model"
            if model_path.exists() and any(model_path.iterdir()):
                logger.info(f"Загрузка модели из {model_path}")
                self.processor = TrOCRProcessor.from_pretrained(str(model_path))
                self.model = VisionEncoderDecoderModel.from_pretrained(str(model_path))
            else:
                logger.info(f"Загрузка модели {self.model_name}")
                self.processor = TrOCRProcessor.from_pretrained(self.model_name)
                self.model = VisionEncoderDecoderModel.from_pretrained(self.model_name)
                model_path.mkdir(parents=True, exist_ok=True)
                self.processor.save_pretrained(str(model_path))
                self.model.save_pretrained(str(model_path))
                logger.info(f"Модель сохранена в {model_path}")
            
            self.model.to(self.device)
            self.model.eval()
            logger.info(f"Модель загружена на {self.device}")
        except Exception as e:
            logger.error(f"Ошибка загрузки модели: {e}")
            raise

    # Конвертация фото
    def images_to_pdf(self, image_files: List[Path], out_pdf: Path) -> Path:
        if not image_files:
            raise ValueError("пусто")

        images = []
        for p in sorted(image_files):
            im = Image.open(str(p))
            if im.mode in ("RGBA", "LA"):
                background = Image.new("RGB", im.size, (255, 255, 255))
                background.paste(im, mask=im.split()[-1])
                im = background
            else:
                im = im.convert("RGB")
            images.append(im)

        first, rest = images[0], images[1:]
        out_pdf.parent.mkdir(parents=True, exist_ok=True)
        first.save(str(out_pdf), "PDF", resolution=300.0, save_all=True, append_images=rest)
        logger.info("Сохранено в: %s", out_pdf)
        return out_pdf

    # Конвертация в searchable
    def images_to_searchable_pdf(self, image_files: List[Path], out_pdf: Path) -> Path:
        if not image_files:
            raise ValueError("пусто")

        tmp_dir = Path(tempfile.mkdtemp(prefix="ocr_pdf_"))
        tmp_pages: List[Path] = []
        try:
            for i, p in enumerate(sorted(image_files), start=1):
                img = Image.open(str(p))
                img = img.convert("RGB")
                page_pdf = tmp_dir / f"page_{i:03d}.pdf"
                img.save(str(page_pdf), "PDF", resolution=300.0)
                tmp_pages.append(page_pdf)

            merger = PdfMerger()
            for p in tmp_pages:
                merger.append(str(p))
            out_pdf.parent.mkdir(parents=True, exist_ok=True)
            merger.write(str(out_pdf))
            merger.close()
            logger.info("Сохранено в: %s", out_pdf)
            return out_pdf
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    # Выравнивание
    def _deskew(self, img: np.ndarray) -> np.ndarray:
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            gray = cv2.bitwise_not(gray)
            thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
            coords = np.column_stack(np.where(thresh > 0))
            if coords.size == 0:
                return img
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            if abs(angle) < 0.1:
                return img
            (h, w) = img.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            logger.debug("Deskew angle: %.2f", angle)
            return rotated
        except Exception as e:
            logger.debug("Deskew failed: %s", e)
            return img

    # Стандартизация по размеру
    def _standardize_image_size(self, pil_img: Image.Image) -> Image.Image:
        original_size = pil_img.size
        img_ratio = original_size[0] / original_size[1]
        target_ratio = self.standard_width / self.standard_height
        
        if abs(img_ratio - target_ratio) > 0.1:
            if img_ratio > target_ratio:
                new_width = self.standard_width
                new_height = int(self.standard_width / img_ratio)
            else:
                new_height = self.standard_height
                new_width = int(self.standard_height * img_ratio)
            
            pil_img = pil_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            new_img = Image.new("RGB", (self.standard_width, self.standard_height), (255, 255, 255))
            x_offset = (self.standard_width - new_width) // 2
            y_offset = (self.standard_height - new_height) // 2
            new_img.paste(pil_img, (x_offset, y_offset))
            pil_img = new_img
        else:
            pil_img = pil_img.resize((self.standard_width, self.standard_height), Image.Resampling.LANCZOS)
        
        if self.debug:
            logger.info(f"Изображение обработано: {original_size} -> {pil_img.size}")
        
        return pil_img

    # Препроцессинг
    def _preprocess_for_ocr(self, pil_img: Image.Image, do_deskew: bool = True) -> Image.Image:
        img = self._standardize_image_size(pil_img)
        img = img.convert("RGB")
        np_img = np.array(img)
        
        if do_deskew:
            np_img = self._deskew(np_img)

        return Image.fromarray(np_img)

    # Распознавание текста с фото
    def _recognize_text(self, pil_img: Image.Image) -> str:
        if self.processor is None or self.model is None:
            raise RuntimeError("Модель не загружена")
        
        try:
            pixel_values = self.processor(images=pil_img, return_tensors="pt").pixel_values
            pixel_values = pixel_values.to(self.device)
            
            with torch.no_grad():
                generated_ids = self.model.generate(pixel_values)
                generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            
            return generated_text.strip()
        except Exception as e:
            logger.warning(f"OCR failed: {e}")
            return ""

    # В текст
    def images_to_text(self, image_files: List[Path], preprocess: bool = True) -> str:
        pages: List[str] = []
        for page_num, img_path in enumerate(sorted(image_files), 1):
            pil = Image.open(str(img_path))
            if self.debug:
                logger.info(f"Обработка изображения: {img_path.name} (размер: {pil.size})")
            
            if preprocess:
                pil_proc = self._preprocess_for_ocr(pil)
            else:
                pil_proc = self._standardize_image_size(pil.convert("RGB"))
            
            text = self._recognize_text(pil_proc)
            pages.append(text)
            
            if self.debug and self.debug_wrapper:
                self.debug_wrapper.log_image_text(img_path, text, page_num)
        
        all_text = "\n\n---PAGE---\n\n".join(pages)
        
        if self.debug and self.debug_wrapper:
            self.debug_wrapper.log_all_texts(image_files, all_text)
        
        return all_text

    # С изображения
    def extract_tables_from_image(self, image_path: Path) -> List[pd.DataFrame]:
        img = cv2.imread(str(image_path))
        if img is None:
            raise FileNotFoundError(f"Can't read image: {image_path}")

        original = img.copy()
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, bw = cv2.threshold(~gray, 128, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)

        horizontal = bw.copy()
        vertical = bw.copy()
        scale = 15
        horizontalsize = max(1, horizontal.shape[1] // scale)
        verticalsize = max(1, vertical.shape[0] // scale)

        horiz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (horizontalsize, 1))
        vert_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, verticalsize))

        horizontal = cv2.erode(horizontal, horiz_kernel, iterations=1)
        horizontal = cv2.dilate(horizontal, horiz_kernel, iterations=1)

        vertical = cv2.erode(vertical, vert_kernel, iterations=1)
        vertical = cv2.dilate(vertical, vert_kernel, iterations=1)

        mask = cv2.bitwise_and(horizontal, vertical)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        tables: List[pd.DataFrame] = []

        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            if w < 50 or h < 50:
                continue
            table_roi = original[y:y + h, x:x + w]
            table_df = self._extract_table_from_roi(table_roi)
            if table_df is not None and not table_df.empty:
                tables.append(table_df)

        if not tables:
            contours2, _ = cv2.findContours(bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            candidates = []
            for c in contours2:
                x, y, w, h = cv2.boundingRect(c)
                if w > img.shape[1] * 0.2 and h > img.shape[0] * 0.05:
                    candidates.append((x, y, w, h))
            for x, y, w, h in candidates:
                table_roi = original[y:y + h, x:x + w]
                t = self._extract_table_from_roi(table_roi)
                if t is not None and not t.empty:
                    tables.append(t)

        return tables

    # С области
    def _extract_table_from_roi(self, roi: np.ndarray) -> Optional[pd.DataFrame]:
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        _, bw = cv2.threshold(~gray, 128, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)

        scale = 20
        horizontalsize = max(1, bw.shape[1] // scale)
        verticalsize = max(1, bw.shape[0] // scale)
        horiz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (horizontalsize, 1))
        vert_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, verticalsize))

        horizontal = cv2.erode(bw, horiz_kernel, iterations=1)
        horizontal = cv2.dilate(horizontal, horiz_kernel, iterations=1)
        vertical = cv2.erode(bw, vert_kernel, iterations=1)
        vertical = cv2.dilate(vertical, vert_kernel, iterations=1)

        mask = cv2.bitwise_or(horizontal, vertical)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        dilated = cv2.dilate(mask, kernel, iterations=2)
        contours, _ = cv2.findContours(dilated, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        boxes = []
        for c in contours:
            x, y, w, h = cv2.boundingRect(c)
            if w < 20 or h < 10:
                continue
            boxes.append((x, y, w, h))
        if not boxes:
            return None

        boxes = sorted(boxes, key=lambda b: (b[1], b[0]))

        rows: List[List[Tuple[int, int, int, int]]] = []
        current_row: List[Tuple[int, int, int, int]] = []
        last_y = None
        y_tol = max(10, int(roi.shape[0] * 0.01))
        for b in boxes:
            x, y, w, h = b
            if last_y is None:
                current_row = [b]
                last_y = y
            elif abs(y - last_y) <= y_tol:
                current_row.append(b)
                last_y = int((last_y + y) / 2)
            else:
                rows.append(sorted(current_row, key=lambda r: r[0]))
                current_row = [b]
                last_y = y
        if current_row:
            rows.append(sorted(current_row, key=lambda r: r[0]))

        table_data: List[List[str]] = []
        for row in rows:
            row_texts: List[str] = []
            for (x, y, w, h) in row:
                cell = roi[y:y + h, x:x + w]
                pad = 2
                y0 = max(0, y - pad)
                y1 = min(roi.shape[0], y + h + pad)
                x0 = max(0, x - pad)
                x1 = min(roi.shape[1], x + w + pad)
                pil_cell = Image.fromarray(cv2.cvtColor(roi[y0:y1, x0:x1], cv2.COLOR_BGR2RGB))
                try:
                    txt = self._recognize_text(pil_cell)
                except Exception:
                    txt = ""
                row_texts.append(txt)
            table_data.append(row_texts)

        max_cols = max(len(r) for r in table_data) if table_data else 0
        normalized = [r + [""] * (max_cols - len(r)) for r in table_data]
        try:
            df = pd.DataFrame(normalized)
            return df
        except Exception as e:
            logger.debug("Failed to build DataFrame from table_data: %s", e)
            return None

    # Пайплайн
    def images_to_structured(self, image_files: List[Path], out_dir: Optional[Path] = None,
                             export_pdf: bool = True, searchable_pdf: bool = False) -> Dict[str, Any]:
        result: Dict[str, Any] = {"text": "", "tables": [], "pdf_path": None, "searchable_pdf_path": None}
        if out_dir:
            out_dir = Path(out_dir)
            out_dir.mkdir(parents=True, exist_ok=True)

        if export_pdf and out_dir:
            out_pdf = out_dir / (self._make_group_name(image_files) + ".pdf")
            try:
                result["pdf_path"] = self.images_to_pdf(image_files, out_pdf)
            except Exception as e:
                logger.warning("images_to_pdf failed: %s", e)

        if searchable_pdf and out_dir:
            out_search_pdf = out_dir / (self._make_group_name(image_files) + "_searchable.pdf")
            try:
                result["searchable_pdf_path"] = self.images_to_searchable_pdf(image_files, out_search_pdf)
            except Exception as e:
                logger.warning("images_to_searchable_pdf failed: %s", e)

        result["text"] = self.images_to_text(image_files, preprocess=True)

        tables_all: List[pd.DataFrame] = []
        for p in sorted(image_files):
            try:
                tables = self.extract_tables_from_image(p)
                if tables:
                    tables_all.extend(tables)
            except Exception as e:
                logger.debug("table extraction failed for %s: %s", p, e)
        result["tables"] = tables_all
        return result

    # Группы
    def _make_group_name(self, image_files: List[Path]) -> str:
        stems = [p.stem for p in image_files]
        if not stems:
            return "document"
        prefix = stems[0]
        for s in stems[1:]:
            while not s.startswith(prefix) and prefix:
                prefix = prefix[:-1]
        if prefix and prefix.strip():
            return prefix.rstrip("_- .")
        return stems[0]


# from ml_service.modeling.ocr import OCRExtractor
# # Запуск
# if __name__ == "__main__":
#     ocr = OCRExtractor()
#     # примеры
#     # text = ocr.images_to_text([Path(""), Path("")])
