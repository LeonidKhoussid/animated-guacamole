import logging
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from api.schemas import (
    UserRegister, UserLogin, AuthResponse,
    BBoxRequest, BBoxResponse,
    OCRRequest, OCRResponse,
    STTRequest, STTResponse,
    TTSRequest, TTSResponse,
    LLMRequest, LLMResponse,
    DialogRequest, DialogResponse,
    EGRNRequest, EGRNResponse,
    Plan3DRequest, Plan3DResponse,
    PlanTracingRequest, PlanTracingResponse,
    SegmentationRequest, SegmentationResponse,
    StyleDiffusionRequest, StyleDiffusionResponse,
    PhotoGenerationRequest, PhotoGenerationResponse,
    PlanProcessingRequest, PlanProcessingResponse,
    SuccessResponse, ErrorResponse
)
from db_connector import get_db
from db_connector.crud import (
    get_user, create_user, verify_password,
    get_property, create_property, get_properties_by_user,
    get_plan, create_plan, get_plans_by_user,
    get_dialog, create_dialog, get_dialogs_by_user,
    get_photo, create_photo, get_photos_by_user
)
from db_connector.db_schemas import (
    UserCreate, PropertyCreate, PlanCreate, DialogCreate, PhotoCreate
)

from ml_service.inference_api import (
    BBoxInferenceAPI, OCRInferenceAPI, AudioInferenceAPI,
    LLMInferenceAPI, DialogInferenceAPI, EGRNInferenceAPI,
    Plan3DInferenceAPI, PlanTracingInferenceAPI,
    SegmentationInferenceAPI, StyleDiffusionInferenceAPI
)
from ml_service.ml_pipeline import (
    PlanProcessingPipeline, EGRNPipeline, DialogPipeline,
    Plan3DPipeline, PlanTracingPipeline
)

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: Session = Depends(get_db)
):
    user = get_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Неверные учетные данные")
    return user


@router.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    try:
        if get_user(db, user_data.user_id):
            raise HTTPException(status_code=400, detail="Пользователь уже существует")

        user_create = UserCreate(user_id=user_data.user_id, password=user_data.password)
        create_user(db, user_create)
        return AuthResponse(success=True, message="Пользователь зарегистрирован", user_id=user_data.user_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка регистрации: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/auth/login", response_model=AuthResponse)
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    try:
        if verify_password(db, login_data.user_id, login_data.password):
            return AuthResponse(success=True, message="Успешная авторизация", user_id=login_data.user_id)
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка авторизации: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/ml/bbox", response_model=BBoxResponse)
async def detect_bboxes(request: BBoxRequest):
    try:
        # Проверка существования файла
        image_path = Path(request.image_path)
        if not image_path.exists():
            raise HTTPException(status_code=404, detail=f"Изображение не найдено: {request.image_path}")

        api = BBoxInferenceAPI()
        result = api.predict(request.image_path, request.output_path)

        if not result.get("success"):
            return BBoxResponse(success=False, error=result.get("error", "Unknown error"))

        return BBoxResponse(
            success=True,
            bboxes=result.get("bboxes", []),
            classes=result.get("classes", []),
            wall_bboxes=result.get("wall_bboxes", []),
            room_bboxes=result.get("room_bboxes", []),
            image_path=result.get("image_path"),
            error=None
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка детекции bboxes: %s", exc)
        return BBoxResponse(success=False, error=str(exc))


@router.post("/ml/ocr", response_model=OCRResponse)
async def extract_text(request: OCRRequest):
    try:
        # Проверка существования файла
        image_path = Path(request.image_path)
        if not image_path.exists():
            raise HTTPException(status_code=404, detail=f"Изображение не найдено: {request.image_path}")

        api = OCRInferenceAPI()
        result = api.predict(request.image_path)

        if not result.get("success"):
            return OCRResponse(success=False, text="", error=result.get("error", "Unknown error"))

        return OCRResponse(
            success=True,
            text=result.get("text", ""),
            error=None
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка OCR: %s", exc)
        return OCRResponse(success=False, text="", error=str(exc))


@router.post("/ml/stt", response_model=STTResponse)
async def speech_to_text(request: STTRequest):
    try:
        # Проверка существования файла
        audio_path = Path(request.audio_path)
        if not audio_path.exists():
            raise HTTPException(status_code=404, detail=f"Аудио файл не найден: {request.audio_path}")

        api = AudioInferenceAPI()
        result = api.speech_to_text(request.audio_path)

        if not result.get("success"):
            return STTResponse(success=False, text="", error=result.get("error", "Unknown error"))

        return STTResponse(
            success=True,
            text=result.get("text", ""),
            error=None
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка STT: %s", exc)
        return STTResponse(success=False, text="", error=str(exc))


@router.post("/ml/tts", response_model=TTSResponse)
async def text_to_speech(request: TTSRequest):
    try:
        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="Текст не может быть пустым")

        api = AudioInferenceAPI()
        result = api.text_to_speech(request.text, request.output_path)

        if not result.get("success"):
            return TTSResponse(success=False, audio_path=None, error=result.get("error", "Unknown error"))

        return TTSResponse(
            success=True,
            audio_path=result.get("audio_path"),
            error=None
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка TTS: %s", exc)
        return TTSResponse(success=False, audio_path=None, error=str(exc))


@router.post("/ml/llm", response_model=LLMResponse)
async def llm_generate(request: LLMRequest, db: Session = Depends(get_db)):
    try:
        user = get_user(db, request.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="Текст запроса не может быть пустым")

        api = LLMInferenceAPI()
        result = api.predict(request.text)

        if not result.get("success"):
            return LLMResponse(success=False, response="", error=result.get("error", "Unknown error"))

        return LLMResponse(
            success=True,
            response=result.get("response", ""),
            error=None
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка LLM: %s", exc)
        return LLMResponse(success=False, response="", error=str(exc))


@router.post("/ml/dialog", response_model=DialogResponse)
async def dialog(request: DialogRequest, db: Session = Depends(get_db)):
    try:
        user = get_user(db, request.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        # Проверка наличия аудио файла
        if request.audio_path:
            audio_path = Path(request.audio_path)
            if not audio_path.exists():
                raise HTTPException(status_code=404, detail=f"Аудио файл не найден: {request.audio_path}")

        pipeline = DialogPipeline()
        result = pipeline.run(audio_input=request.audio_path, return_audio=True)

        if not result.get("success"):
            return DialogResponse(
                success=False,
                user_text=result.get("user_text", ""),
                model_text="",
                audio_path=None,
                error=result.get("error", "Unknown error")
            )

        # Сохраняем диалог в БД
        try:
            dialog_data = DialogCreate(
                user_id=request.user_id,
                chat_id=request.chat_id,
                user_audio_raw_path=request.audio_path,
                user_text=result.get("user_text", ""),
                model_text=result.get("assistant_text", ""),
                tts_audio_path=result.get("audio_path")
            )
            create_dialog(db, dialog_data)
            logger.info(f"Диалог сохранен для пользователя {request.user_id}, чат {request.chat_id}")
        except Exception as db_exc:
            logger.warning(f"Ошибка сохранения диалога в БД: {db_exc}")

        return DialogResponse(
            success=True,
            user_text=result.get("user_text", ""),
            model_text=result.get("assistant_text", ""),
            audio_path=result.get("audio_path"),
            error=None
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка диалога: %s", exc)
        return DialogResponse(success=False, error=str(exc))


@router.post("/ml/egrn", response_model=EGRNResponse)
async def extract_egrn(request: EGRNRequest, db: Session = Depends(get_db)):
    try:
        user = get_user(db, request.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        # Проверка существования файла
        pdf_path = Path(request.pdf_path)
        if not pdf_path.exists():
            raise HTTPException(status_code=404, detail=f"PDF файл не найден: {request.pdf_path}")

        pipeline = EGRNPipeline()
        # EGRNPipeline.run требует output_dir для save_json
        from config import EGRNConfig
        egrn_config = EGRNConfig()
        result = pipeline.run(request.pdf_path, save_json=True, output_dir=egrn_config.output_dir)

        if result.get("success") and result.get("properties"):
            props = result["properties"]
            # Проверяем что объект еще не существует
            existing = get_property(db, props.get("object_id", ""))
            if not existing:
                try:
                    # Преобразуем типы данных
                    total_area = float(props.get("total_area", 0)) if props.get("total_area") else None
                    cadastral_price = float(props.get("cadastral_price", 0)) if props.get("cadastral_price") else None
                    floor = int(props.get("floor", 0)) if props.get("floor") else None

                    property_data = PropertyCreate(
                        user_id=request.user_id,
                        object_id=props.get("object_id", ""),
                        address=props.get("address"),
                        owner=props.get("owner"),
                        object_type=props.get("object_type"),
                        reg_date=props.get("reg_date"),
                        total_area=total_area,
                        cadastral_price=cadastral_price,
                        floor=floor
                    )
                    create_property(db, property_data)
                    logger.info(f"Создано свойство для объекта: {props.get('object_id')}")
                except Exception as prop_exc:
                    logger.warning(f"Ошибка создания свойства в БД: {prop_exc}")

        return EGRNResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка EGRN: %s", exc)
        return EGRNResponse(success=False, error=str(exc))


@router.post("/ml/plan-3d", response_model=Plan3DResponse)
async def generate_3d(request: Plan3DRequest):
    try:
        # Проверка существования файла
        svg_path = Path(request.svg_path)
        if not svg_path.exists():
            raise HTTPException(status_code=404, detail=f"SVG файл не найден: {request.svg_path}")

        api = Plan3DInferenceAPI()
        result = api.predict(
            request.svg_path,
            request.output_path,
            thick=request.wall_thickness,
            h=request.wall_height,
            steps=request.steps,
            min_len=request.min_length
        )

        if not result.get("success"):
            return Plan3DResponse(success=False, obj_path=None, svg_path=None,
                                  error=result.get("error", "Unknown error"))

        return Plan3DResponse(
            success=True,
            obj_path=result.get("obj_path"),
            svg_path=result.get("svg_path", request.svg_path),
            error=None
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка 3D генерации: %s", exc)
        return Plan3DResponse(success=False, obj_path=None, svg_path=None, error=str(exc))


@router.post("/ml/plan-tracing", response_model=PlanTracingResponse)
async def trace_plan(request: PlanTracingRequest):
    try:
        api = PlanTracingInferenceAPI()
        result = api.predict(request.image_path, request.output_path)

        if not result.get("success"):
            return PlanTracingResponse(success=False, error=result.get("error", "Unknown error"))

        # Извлекаем данные из result
        inner_result = result.get("result", {})
        vectorized_path = inner_result.get("resized_path") or request.output_path
        vector_npy_path = None

        # Если есть вектор, сохраняем его
        if "vector" in inner_result and request.output_path:
            import numpy as np
            output_path = Path(request.output_path)
            npy_path = output_path.parent / f"{output_path.stem}_vector.npy"
            np.save(str(npy_path), inner_result["vector"])
            vector_npy_path = str(npy_path)

        return PlanTracingResponse(
            success=True,
            vectorized_path=vectorized_path,
            vector_npy_path=vector_npy_path,
            error=None
        )
    except Exception as exc:
        logger.exception("Ошибка трассировки: %s", exc)
        return PlanTracingResponse(success=False, error=str(exc))


@router.post("/ml/segmentation", response_model=SegmentationResponse)
async def segment_image(request: SegmentationRequest):
    try:
        # Проверка существования файла
        image_path = Path(request.image_path)
        if not image_path.exists():
            raise HTTPException(status_code=404, detail=f"Изображение не найдено: {request.image_path}")

        # ControlNetSegmentation не имеет метода segment, используем StyleDiffusionV2
        from ml_service.modeling import StyleDiffusionV2
        from PIL import Image

        seg_model = StyleDiffusionV2()
        image = Image.open(request.image_path)
        seg_map, _ = seg_model._generate_segmentation_map(image)

        # Сохраняем результат
        output_path = request.output_path or str(image_path.parent / f"{image_path.stem}_segmentation.png")
        output_path_obj = Path(output_path)
        output_path_obj.parent.mkdir(parents=True, exist_ok=True)
        seg_map.save(output_path)

        return SegmentationResponse(
            success=True,
            segmentation_path=output_path,
            error=None
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка сегментации: %s", exc)
        return SegmentationResponse(success=False, error=str(exc))


@router.post("/ml/style-diffusion", response_model=StyleDiffusionResponse)
async def style_diffusion(request: StyleDiffusionRequest):
    try:
        # Проверка существования файла
        image_path = Path(request.image_path)
        if not image_path.exists():
            raise HTTPException(status_code=404, detail=f"Изображение не найдено: {request.image_path}")

        if not request.prompt or not request.prompt.strip():
            raise HTTPException(status_code=400, detail="Промпт не может быть пустым")

        api = StyleDiffusionInferenceAPI()
        generated_paths: List[str] = []

        for i in range(request.num_images):
            # Генерируем уникальный путь для каждого изображения
            if request.num_images > 1:
                output = request.output_path or str(image_path.parent / f"{image_path.stem}_gen_{i + 1:03d}.jpg")
                if request.output_path:
                    output = str(Path(request.output_path).parent / f"{image_path.stem}_gen_{i + 1:03d}.jpg")
            else:
                output = request.output_path or str(image_path.parent / f"{image_path.stem}_gen.jpg")

            result = api.predict(request.image_path, request.prompt, output)

            if result.get("success"):
                img_result = result.get("result")
                if hasattr(img_result, "save"):
                    output_path_obj = Path(output)
                    output_path_obj.parent.mkdir(parents=True, exist_ok=True)
                    img_result.save(output)
                    generated_paths.append(output)
                elif isinstance(result.get("result"), str):
                    generated_paths.append(result.get("result"))

        return StyleDiffusionResponse(
            success=len(generated_paths) > 0,
            generated_paths=generated_paths,
            error=None if generated_paths else "Не удалось сгенерировать изображения"
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка стилизации: %s", exc)
        return StyleDiffusionResponse(success=False, generated_paths=[], error=str(exc))


@router.post("/ml/plan-processing", response_model=PlanProcessingResponse)
async def process_plan(request: PlanProcessingRequest):
    try:
        # Проверка существования файла
        image_path = Path(request.image_path)
        if not image_path.exists():
            raise HTTPException(status_code=404, detail=f"Изображение не найдено: {request.image_path}")

        pipeline = PlanProcessingPipeline(use_ocr=request.use_ocr, use_bbox=request.use_bbox)
        result = pipeline.run(request.image_path, normalize=request.normalize)

        if not result.get("success"):
            return PlanProcessingResponse(
                success=False,
                text="",
                bboxes=[],
                steps={},
                error=result.get("error", "Unknown error")
            )

        return PlanProcessingResponse(
            success=True,
            text=result.get("text", ""),
            bboxes=result.get("bboxes", []),
            steps=result.get("steps", {}),
            error=None
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка обработки плана: %s", exc)
        return PlanProcessingResponse(success=False, text="", bboxes=[], steps={}, error=str(exc))


@router.post("/ml/photo-generation", response_model=PhotoGenerationResponse)
async def generate_photo(request: PhotoGenerationRequest, db: Session = Depends(get_db)):
    try:
        user = get_user(db, request.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        # Проверка существования файла
        input_photo_path = Path(request.input_photo_path)
        if not input_photo_path.exists():
            raise HTTPException(status_code=404, detail=f"Входное изображение не найдено: {request.input_photo_path}")

        api = StyleDiffusionInferenceAPI()
        prompt = request.prompt or request.user_text or "красивый современный интерьер"

        if not prompt or not prompt.strip():
            raise HTTPException(status_code=400, detail="Промпт или текст пользователя обязательны")

        generated_paths: List[str] = []
        for i in range(4):
            output = str(input_photo_path.parent / f"{input_photo_path.stem}_gen_{i + 1:03d}.jpg")
            result = api.predict(request.input_photo_path, prompt, output)

            if result.get("success"):
                img_result = result.get("result")
                if hasattr(img_result, "save"):
                    output_path_obj = Path(output)
                    output_path_obj.parent.mkdir(parents=True, exist_ok=True)
                    img_result.save(output)
                    generated_paths.append(output)
                elif isinstance(result.get("result"), str):
                    generated_paths.append(result.get("result"))

        photo_id: Optional[int] = None
        if generated_paths:
            try:
                photo_data = PhotoCreate(
                    user_id=request.user_id,
                    input_photo_path=request.input_photo_path,
                    user_text=request.user_text,
                    generated_prompt=prompt,
                    generated_photo_paths=generated_paths
                )
                db_photo = create_photo(db, photo_data)
                photo_id = db_photo.id
                logger.info(f"Создана запись фото для пользователя {request.user_id}, ID: {photo_id}")
            except Exception as db_exc:
                logger.warning(f"Ошибка сохранения фото в БД: {db_exc}")

        return PhotoGenerationResponse(
            success=bool(generated_paths),
            photo_id=photo_id,
            generated_paths=generated_paths,
            error=None if generated_paths else "Не удалось сгенерировать изображения"
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка генерации фото: %s", exc)
        return PhotoGenerationResponse(success=False, photo_id=None, generated_paths=[], error=str(exc))


@router.get("/users/{user_id}/properties", response_model=List[dict])
async def get_user_properties(user_id: str, db: Session = Depends(get_db)):
    properties = get_properties_by_user(db, user_id)
    return [{"id": p.id, "object_id": p.object_id, "address": p.address} for p in properties]


@router.get("/users/{user_id}/plans", response_model=List[dict])
async def get_user_plans(user_id: str, db: Session = Depends(get_db)):
    plans = get_plans_by_user(db, user_id)
    return [{"id": p.id, "object_id": p.object_id, "raw_plan_path": p.raw_plan_path} for p in plans]


@router.get("/users/{user_id}/dialogs", response_model=List[dict])
async def get_user_dialogs(user_id: str, db: Session = Depends(get_db)):
    dialogs = get_dialogs_by_user(db, user_id)
    return [{"id": d.id, "chat_id": d.chat_id, "user_text": d.user_text, "model_text": d.model_text} for d in dialogs]


@router.get("/users/{user_id}/photos", response_model=List[dict])
async def get_user_photos(user_id: str, db: Session = Depends(get_db)):
    photos = get_photos_by_user(db, user_id)
    return [{"id": p.id, "input_photo_path": p.input_photo_path, "generated_photo_paths": p.generated_photo_paths} for p
            in photos]


@router.post("/ml/dialog/run-pipeline", response_model=SuccessResponse)
async def run_dialog_pipeline():
    try:
        from ml_service.llama_agent import DialogManager
        manager = DialogManager()
        manager.run_pipeline()
        return SuccessResponse(success=True, message="Пайплайн диалога выполнен успешно")
    except Exception as exc:
        logger.exception("Ошибка выполнения пайплайна диалога: %s", exc)
        return SuccessResponse(success=False, message=f"Ошибка: {str(exc)}")


@router.get("/status", response_model=Dict[str, Any])
async def get_status():
    try:
        status_info = {
            "api": "running",
            "database": "connected",
            "ml_models": {
                "bbox": "ready",
                "ocr": "ready",
                "stt": "ready",
                "tts": "ready",
                "llm": "ready",
                "segmentation": "ready",
                "style_diffusion": "ready"
            },
            "dialog_manager": "active"
        }
        return status_info
    except Exception as exc:
        logger.exception("Ошибка получения статуса: %s", exc)
        return {"api": "error", "error": str(exc)}
