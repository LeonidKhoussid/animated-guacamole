import logging
from pathlib import Path
from typing import Optional, Dict, Any, List, Union

from ml_service.utils import normalize_image_from_path
from ml_service.inference_api import (BBoxInferenceAPI, OCRInferenceAPI, AudioInferenceAPI,
                                      LLMInferenceAPI, DialogInferenceAPI, EGRNInferenceAPI,
                                      Plan3DInferenceAPI, PlanTracingInferenceAPI)


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(h)


class BasePipeline:
    """БАЗОВЫЙ КЛАСС ПАЙПЛАЙНА"""

    # Инициализация
    def __init__(self):
        self.steps: List[str] = []

    # Запуск
    def run(self, *args, **kwargs) -> Dict[str, Any]:
        raise NotImplementedError


class PlanProcessingPipeline(BasePipeline):
    """ПАЙПЛАЙН ОБРАБОТКИ ПЛАНОВ"""

    # Инициализация
    def __init__(self, use_ocr: bool = True, use_bbox: bool = True):
        super().__init__()
        self.use_ocr = use_ocr
        self.use_bbox = use_bbox
        self.ocr_api = OCRInferenceAPI() if use_ocr else None
        self.bbox_api = BBoxInferenceAPI() if use_bbox else None
        logger.info("PlanProcessingPipeline initialized")

    # Запуск
    def run(self,
            image_path: Union[str, Path],
            normalize: bool = True,
            output_dir: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
        results: Dict[str, Any] = {"success": False}
        try:
            image_path = Path(image_path)
            if not image_path.exists():
                raise FileNotFoundError(f"Image not found: {image_path}")

            results = {"success": True, "image_path": str(image_path), "steps": {}}

            if normalize:
                normalized_img = normalize_image_from_path(image_path)
                results["steps"]["normalization"] = {
                    "success": True,
                    "size": getattr(normalized_img, "size", None)
                }

            if self.use_ocr and self.ocr_api:
                ocr_result = self.ocr_api.predict(image_path)
                results["steps"]["ocr"] = ocr_result
                results["text"] = ocr_result.get("text", "")

            if self.use_bbox and self.bbox_api:
                bbox_output = None
                if output_dir:
                    outd = Path(output_dir)
                    outd.mkdir(parents=True, exist_ok=True)
                    bbox_output = outd / f"{image_path.stem}_bbox{image_path.suffix}"
                bbox_result = self.bbox_api.predict(image_path, bbox_output)
                results["steps"]["bbox"] = bbox_result
                results["bboxes"] = bbox_result.get("bboxes", [])

            logger.info("PlanProcessingPipeline finished")
            return results

        except Exception as e:
            logger.error(f"PlanProcessingPipeline error: {e}")
            return {"success": False, "error": str(e)}


class EGRNPipeline(BasePipeline):
    """ПАЙПЛАЙН EGRN ДОКУМЕНТОВ"""

    # Инициализация
    def __init__(self, use_ocr: bool = True, debug: bool = False):
        super().__init__()
        self.egrn_api = EGRNInferenceAPI(use_ocr=use_ocr, debug=debug)
        logger.info("EGRNPipeline initialized")

    # Запуск
    def run(self,
            pdf_path: Union[str, Path],
            save_json: bool = True,
            output_dir: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
        try:
            pdf_path = Path(pdf_path)
            if not pdf_path.exists():
                raise FileNotFoundError(f"PDF not found: {pdf_path}")

            result = self.egrn_api.predict(pdf_path)

            if save_json and result.get("success") and output_dir:
                outd = Path(output_dir)
                outd.mkdir(parents=True, exist_ok=True)
                json_path = outd / f"{pdf_path.stem}_properties.json"
                import json
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(result.get("properties", {}), f, ensure_ascii=False, indent=2)
                result["json_path"] = str(json_path)

            logger.info("EGRNPipeline finished")
            return result

        except Exception as e:
            logger.error(f"EGRNPipeline error: {e}")
            return {"success": False, "error": str(e)}

    # Пакетная обработка
    def run_batch(self,
                  pdf_paths: List[Union[str, Path]],
                  save_json: bool = True,
                  output_dir: Optional[Union[str, Path]] = None) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for p in pdf_paths:
            results.append(self.run(p, save_json=save_json, output_dir=output_dir))
        return results


class DialogPipeline(BasePipeline):
    """ПАЙПЛАЙН ДИАЛОГА МОДУЛИ"""

    # Инициализация
    def __init__(self):
        super().__init__()
        self.dialog_api = DialogInferenceAPI()
        self.audio_api = AudioInferenceAPI()
        self.llm_api = LLMInferenceAPI()
        logger.info("DialogPipeline initialized")

    # Запуск
    def run(self,
            audio_input: Optional[Union[str, Path]] = None,
            text_input: Optional[str] = None,
            return_audio: bool = True) -> Dict[str, Any]:
        try:
            results: Dict[str, Any] = {"success": True, "steps": {}}

            if audio_input:
                stt_result = self.audio_api.speech_to_text(audio_input)
                user_text = stt_result.get("text", "")
                results["steps"]["stt"] = stt_result
            elif text_input:
                user_text = text_input
                results["steps"]["stt"] = {"success": True, "text": user_text, "source": "direct"}
            else:
                dialog_result = self.dialog_api.predict()
                return dialog_result

            if not user_text or not user_text.strip():
                return {"success": False, "error": "Empty user text"}

            llm_result = self.llm_api.predict(user_text)
            assistant_text = llm_result.get("response", "")
            results["steps"]["llm"] = llm_result

            if return_audio:
                tts_result = self.audio_api.text_to_speech(assistant_text)
                results["steps"]["tts"] = tts_result
                results["audio_path"] = tts_result.get("audio_path")

            results["user_text"] = user_text
            results["assistant_text"] = assistant_text

            logger.info("DialogPipeline finished")
            return results

        except Exception as e:
            logger.error(f"DialogPipeline error: {e}")
            return {"success": False, "error": str(e)}


class Plan3DPipeline(BasePipeline):
    """ПАЙПЛАЙН 3D ГЕНЕРАЦИИ"""

    # Инициализация
    def __init__(self, config: Optional[Any] = None):
        super().__init__()
        self.plan3d_api = Plan3DInferenceAPI(config)
        logger.info("Plan3DPipeline initialized")

    # Запуск
    def run(self,
            svg_path: Union[str, Path],
            output_path: Optional[Union[str, Path]] = None,
            thick: float = 0.2,
            h: float = 3.0) -> Dict[str, Any]:
        try:
            svg_path = Path(svg_path)
            if not svg_path.exists():
                raise FileNotFoundError(f"SVG not found: {svg_path}")

            if not output_path:
                output_path = svg_path.parent / f"{svg_path.stem}_walls.obj"

            result = self.plan3d_api.predict(svg_path, output_path, thick=thick, h=h)

            logger.info("Plan3DPipeline finished")
            return result

        except Exception as e:
            logger.error(f"Plan3DPipeline error: {e}")
            return {"success": False, "error": str(e)}

    # Папка
    def run_folder(self, input_dir: Union[str, Path], config: Optional[Any] = None) -> Dict[str, Any]:
        try:
            input_dir = Path(input_dir)
            if not input_dir.exists():
                raise FileNotFoundError(f"Folder not found: {input_dir}")
            result = self.plan3d_api.predict_folder(input_dir, config)
            logger.info("Plan3DPipeline folder finished")
            return result
        except Exception as e:
            logger.error(f"Plan3DPipeline folder error: {e}")
            return {"success": False, "error": str(e)}


class PlanTracingPipeline(BasePipeline):
    """ПАЙПЛАЙН ТРАССИРОВКИ ПЛАНОВ"""

    # Инициализация
    def __init__(self):
        super().__init__()
        self.tracing_api = PlanTracingInferenceAPI()
        logger.info("PlanTracingPipeline initialized")

    # Запуск
    def run(self,
            image_path: Union[str, Path],
            output_path: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
        try:
            image_path = Path(image_path)
            if not image_path.exists():
                raise FileNotFoundError(f"Image not found: {image_path}")
            result = self.tracing_api.predict(image_path, output_path)
            logger.info("PlanTracingPipeline finished")
            return result
        except Exception as e:
            logger.error(f"PlanTracingPipeline error: {e}")
            return {"success": False, "error": str(e)}


class FullPlanPipeline(BasePipeline):
    """ПОЛНЫЙ ПАЙПЛАЙН ОБРАБОТКИ"""

    # Инициализация
    def __init__(self):
        super().__init__()
        self.plan_processor = PlanProcessingPipeline(use_ocr=True, use_bbox=True)
        self.tracing_pipeline = PlanTracingPipeline()
        self.plan3d_pipeline = Plan3DPipeline()
        logger.info("FullPlanPipeline initialized")

    # Запуск
    def run(self,
            image_path: Union[str, Path],
            svg_path: Optional[Union[str, Path]] = None,
            output_dir: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
        try:
            image_path = Path(image_path)
            if not image_path.exists():
                raise FileNotFoundError(f"Image not found: {image_path}")

            if output_dir:
                outd = Path(output_dir)
                outd.mkdir(parents=True, exist_ok=True)
            else:
                outd = None

            results: Dict[str, Any] = {"success": True, "image_path": str(image_path), "steps": {}}

            plan_result = self.plan_processor.run(image_path, normalize=True, output_dir=outd)
            results["steps"]["plan_processing"] = plan_result

            tracing_output = outd / f"{image_path.stem}_traced.svg" if outd else None
            tracing_result = self.tracing_pipeline.run(image_path, tracing_output)
            results["steps"]["tracing"] = tracing_result

            if svg_path:
                obj_output = outd / f"{Path(svg_path).stem}_walls.obj" if outd else None
                plan3d_result = self.plan3d_pipeline.run(svg_path, obj_output)
                results["steps"]["3d_generation"] = plan3d_result

            logger.info("FullPlanPipeline finished")
            return results

        except Exception as e:
            logger.error(f"FullPlanPipeline error: {e}")
            return {"success": False, "error": str(e)}


# from ml_service.ml_pipeline import FullPlanPipeline
# # Пример
# if __name__ == "__main__":
#     fp = FullPlanPipeline()
#     # res = fp.run(Path("data/plans/vectors/plan_006.jpg"), svg_path=None, output_dir=Path("out"))
#     # print(res)
