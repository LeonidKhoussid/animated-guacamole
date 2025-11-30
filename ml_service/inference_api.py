import logging
from pathlib import Path
from typing import Optional, Dict, Any, List, Union

from ml_service.llama_agent import LlamaGGUFModel, DialogManager
from ml_service.audio_processing import AudioToText, TextToSpeech
from ml_service.utils import EGRNExtractor, SVGWalls3D, PlanTrassing
from ml_service.modeling import BBoxDetector, OCRExtractor, ControlNetSegmentation, StyleDiffusionV2


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(h)


class BaseInferenceAPI:
    """БАЗОВЫЙ КЛАСС ИНФЕРЕНСА"""

    # Инициализация
    def __init__(self):
        self.model = None

    # Предсказание
    def predict(self, *args, **kwargs):
        raise NotImplementedError


class BBoxInferenceAPI(BaseInferenceAPI):
    """API ДЕТЕКЦИИ BBOX"""

    # Инициализация
    def __init__(self, config: Optional[Any] = None):
        super().__init__()
        self.model = BBoxDetector(config)
        logger.info("BBoxInferenceAPI initialized")

    # Для фото
    def predict(self, image_path: Union[str, Path], output_path: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
        try:
            image_path = Path(image_path)
            if not image_path.exists():
                raise FileNotFoundError(str(image_path))
            result = self.model.detect(str(image_path))
            if result is None:
                return {"success": False, "error": "Detection failed"}
            
            # BBoxDetector возвращает wall_bboxes и room_bboxes
            wall_bboxes = result.get("wall_bboxes", [])
            room_bboxes = result.get("room_bboxes", [])
            
            # Формируем единый список bboxes с классами
            all_bboxes = []
            all_classes = []
            for bbox in wall_bboxes:
                all_bboxes.append(bbox)
                all_classes.append("wall")
            for bbox in room_bboxes:
                all_bboxes.append(bbox)
                all_classes.append("room")
            
            # Если нужна визуализация
            if output_path:
                outp = Path(output_path)
                outp.parent.mkdir(parents=True, exist_ok=True)
                import cv2
                img = cv2.imread(str(image_path))
                if img is not None:
                    # Рисуем bboxes
                    for bbox in wall_bboxes:
                        x1, y1, x2, y2 = bbox[:4]
                        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    for bbox in room_bboxes:
                        x1, y1, x2, y2 = bbox[:4]
                        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.imwrite(str(outp), img)
                    logger.info(f"Saved: {outp}")
            
            return {"success": True,
                    "bboxes": all_bboxes,
                    "classes": all_classes,
                    "wall_bboxes": wall_bboxes,
                    "room_bboxes": room_bboxes,
                    "image_path": str(image_path)}
        except Exception as e:
            logger.error(f"BBox error: {e}")
            return {"success": False, "error": str(e)}


class OCRInferenceAPI(BaseInferenceAPI):
    """API OCR ИЗВЛЕЧЕНИЯ ТЕКСТА"""

    # Инициализация
    def __init__(self, model_name: Optional[str] = None, device: Optional[str] = None, debug: bool = False):
        super().__init__()
        from config import OCRConfig
        cfg = OCRConfig()
        self.model = OCRExtractor(
            model_name=model_name or cfg.model_name,
            device=device or cfg.device,
            debug=debug or cfg.debug,
            standard_width=cfg.standard_width,
            standard_height=cfg.standard_height
        )
        logger.info("OCRInferenceAPI initialized")

    # Распознавание
    def predict(self, image_path: Union[str, Path]) -> Dict[str, Any]:
        try:
            image_path = Path(image_path)
            if not image_path.exists():
                raise FileNotFoundError(str(image_path))
            text = self.model.image_to_text(str(image_path))
            return {"success": True, "text": text, "image_path": str(image_path)}
        except Exception as e:
            logger.error(f"OCR error: {e}")
            return {"success": False, "error": str(e)}

    # Пакет
    def predict_batch(self, image_paths: List[Union[str, Path]]) -> List[Dict[str, Any]]:
        out = []
        for p in image_paths:
            out.append(self.predict(p))
        return out


class AudioInferenceAPI(BaseInferenceAPI):
    """API АУДИО STT/TTS"""

    # Инициализация
    def __init__(self):
        super().__init__()
        self.stt_model = AudioToText()
        from config import TTSConfig
        self.tts_model = TextToSpeech(TTSConfig())
        logger.info("AudioInferenceAPI initialized")

    # STT
    def speech_to_text(self, audio_path: Union[str, Path], turn_num: Optional[str] = None) -> Dict[str, Any]:
        try:
            audio_path = Path(audio_path)
            if not audio_path.exists():
                raise FileNotFoundError(str(audio_path))
            if turn_num:
                clean = self.stt_model.process_audio(str(audio_path), turn_num)
                text = self.stt_model.transcribe_audio(str(clean))
            else:
                text = self.stt_model.transcribe_audio(str(audio_path))
            return {"success": True, "text": text, "audio_path": str(audio_path)}
        except Exception as e:
            logger.error(f"STT error: {e}")
            return {"success": False, "error": str(e)}

    # TTS
    def text_to_speech(self, text: str, output_path: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
        try:
            audio_path = self.tts_model.synthesize(text)
            if output_path and audio_path:
                from shutil import copy2
                copy2(audio_path, output_path)
                audio_path = str(output_path)
            return {"success": True, "audio_path": audio_path, "text": text}
        except Exception as e:
            logger.error(f"TTS error: {e}")
            return {"success": False, "error": str(e)}


class LLMInferenceAPI(BaseInferenceAPI):
    """API LLM ГЕНЕРАЦИИ ОТВЕТОВ"""

    # Инициализация
    def __init__(self, config: Optional[Any] = None):
        super().__init__()
        self.model = LlamaGGUFModel(config)
        logger.info("LLMInferenceAPI initialized")

    # Ответ
    def predict(self, text: str, history: Optional[List[tuple]] = None) -> Dict[str, Any]:
        try:
            response = self.model.generate_response(text)
            return {"success": True, "response": response, "input_text": text}
        except Exception as e:
            logger.error(f"LLM error: {e}")
            return {"success": False, "error": str(e)}


class DialogInferenceAPI(BaseInferenceAPI):
    """API ПОЛНОГО ДИАЛОГА"""

    # Инициализация
    def __init__(self):
        super().__init__()
        self.model = DialogManager()
        logger.info("DialogInferenceAPI initialized")

    # Диалог
    def predict(self) -> Dict[str, Any]:
        try:
            self.model.run_pipeline()
            return {"success": True, "message": "Done"}
        except Exception as e:
            logger.error(f"Dialog error: {e}")
            return {"success": False, "error": str(e)}


class EGRNInferenceAPI(BaseInferenceAPI):
    """API EGRN ИЗВЛЕЧЕНИЯ ДАННЫХ"""

    # Инициализация
    def __init__(self, use_ocr: bool = True, debug: bool = False):
        super().__init__()
        self.model = EGRNExtractor(use_ocr=use_ocr, debug=debug)
        logger.info("EGRNInferenceAPI initialized")

    # Парсинг документа
    def predict(self, pdf_path: Union[str, Path]) -> Dict[str, Any]:
        try:
            pdf_path = Path(pdf_path)
            if not pdf_path.exists():
                raise FileNotFoundError(str(pdf_path))
            props = self.model.extract_properties(str(pdf_path))
            return {"success": True, "properties": props, "pdf_path": str(pdf_path)}
        except Exception as e:
            logger.error(f"EGRN error: {e}")
            return {"success": False, "error": str(e)}

    # Пакет
    def predict_batch(self, pdf_paths: List[Union[str, Path]]) -> List[Dict[str, Any]]:
        out = []
        for p in pdf_paths:
            out.append(self.predict(p))
        return out


class Plan3DInferenceAPI(BaseInferenceAPI):
    """API 3D ГЕНЕРАЦИИ ИЗ SVG"""

    # Инициализация
    def __init__(self, config: Optional[Any] = None):
        super().__init__()
        self.model = SVGWalls3D
        self.config = config
        logger.info("Plan3DInferenceAPI initialized")

    # Триангуляция
    def predict(self, svg_path: Union[str, Path], output_path: Union[str, Path],
                thick: float = 0.2, h: float = 3.0, steps: int = 50, min_len: float = 6.0) -> Dict[str, Any]:
        try:
            svg_path = Path(svg_path)
            if not svg_path.exists():
                raise FileNotFoundError(str(svg_path))
            outp = Path(output_path)
            outp.parent.mkdir(parents=True, exist_ok=True)
            self.model.convert(str(svg_path), str(outp), thick=thick, h=h, steps=steps, min_len=min_len)
            return {"success": True, "obj_path": str(outp), "svg_path": str(svg_path)}
        except Exception as e:
            logger.error(f"3D error: {e}")
            return {"success": False, "error": str(e)}

    # Папка
    def predict_folder(self, input_dir: Union[str, Path], config: Optional[Any] = None) -> Dict[str, Any]:
        try:
            input_dir = Path(input_dir)
            if not input_dir.exists():
                raise FileNotFoundError(str(input_dir))
            self.model.process_folders(input_dir, config or self.config)
            return {"success": True, "input_dir": str(input_dir), "message": "Done"}
        except Exception as e:
            logger.error(f"3D folder error: {e}")
            return {"success": False, "error": str(e)}


class PlanTracingInferenceAPI(BaseInferenceAPI):
    """API ТРАССИРОВКИ ПЛАНОВ"""

    # Инициализация
    def __init__(self):
        super().__init__()
        self.model = PlanTrassing()
        logger.info("PlanTracingInferenceAPI initialized")

    # Векторизация
    def predict(self, image_path: Union[str, Path], output_path: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
        try:
            image_path = Path(image_path)
            if not image_path.exists():
                raise FileNotFoundError(str(image_path))
            # process_image возвращает Dict с результатами обработки одного изображения
            result = self.model.process_image(image_path)
            if result is None:
                return {"success": False, "error": "Failed to process image"}
            
            # Если указан output_path, можно сохранить результат
            if output_path:
                output_path = Path(output_path)
                output_path.parent.mkdir(parents=True, exist_ok=True)
                # Сохранение обработанного изображения если есть
                if "resized_image" in result:
                    import cv2
                    cv2.imwrite(str(output_path), result["resized_image"])
                    result["output_path"] = str(output_path)
            
            return {"success": True, "result": result, "image_path": str(image_path)}
        except Exception as e:
            logger.error(f"Tracing error: {e}")
            return {"success": False, "error": str(e)}


class SegmentationInferenceAPI(BaseInferenceAPI):
    """API СЕГМЕНТАЦИИ CONTROLNET"""

    # Инициализация
    def __init__(self, config: Optional[Any] = None):
        super().__init__()
        self.model = ControlNetSegmentation(config)
        logger.info("SegmentationInferenceAPI initialized")

    # Сегментация -> маскирование
    def predict(self, image_path: Union[str, Path], prompt: str) -> Dict[str, Any]:
        try:
            image_path = Path(image_path)
            if not image_path.exists():
                raise FileNotFoundError(str(image_path))
            result = self.model.segment(str(image_path), prompt)
            return {"success": True, "result": result, "image_path": str(image_path), "prompt": prompt}
        except Exception as e:
            logger.error(f"Segmentation error: {e}")
            return {"success": False, "error": str(e)}


class StyleDiffusionInferenceAPI(BaseInferenceAPI):
    """API СТИЛИЗАЦИИ ИЗОБРАЖЕНИЙ"""

    # Инициализация
    def __init__(self, config: Optional[Any] = None):
        super().__init__()
        self.model = StyleDiffusionV2(config)
        logger.info("StyleDiffusionInferenceAPI initialized")

    # Диффузия
    def predict(self, image_path: Union[str, Path], style_prompt: str,
                output_path: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
        try:
            image_path = Path(image_path)
            if not image_path.exists():
                raise FileNotFoundError(str(image_path))
            result = self.model.generate(str(image_path), style_prompt)
            if output_path and hasattr(result, "save"):
                outp = Path(output_path)
                outp.parent.mkdir(parents=True, exist_ok=True)
                result.save(str(outp))
            return {"success": True, "result": result, "image_path": str(image_path), "style_prompt": style_prompt}
        except Exception as e:
            logger.error(f"Style error: {e}")
            return {"success": False, "error": str(e)}
