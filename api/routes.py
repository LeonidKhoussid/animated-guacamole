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
        api = BBoxInferenceAPI()
        result = api.predict(request.image_path, request.output_path)
        return BBoxResponse(**result)
    except Exception as exc:
        logger.exception("Ошибка детекции bboxes: %s", exc)
        return BBoxResponse(success=False, error=str(exc))


@router.post("/ml/ocr", response_model=OCRResponse)
async def extract_text(request: OCRRequest):
    try:
        api = OCRInferenceAPI()
        result = api.predict(request.image_path)
        return OCRResponse(**result)
    except Exception as exc:
        logger.exception("Ошибка OCR: %s", exc)
        return OCRResponse(success=False, error=str(exc))


@router.post("/ml/stt", response_model=STTResponse)
async def speech_to_text(request: STTRequest):
    try:
        api = AudioInferenceAPI()
        result = api.speech_to_text(request.audio_path)
        return STTResponse(**result)
    except Exception as exc:
        logger.exception("Ошибка STT: %s", exc)
        return STTResponse(success=False, error=str(exc))


@router.post("/ml/tts", response_model=TTSResponse)
async def text_to_speech(request: TTSRequest):
    try:
        api = AudioInferenceAPI()
        result = api.text_to_speech(request.text, request.output_path)
        return TTSResponse(**result)
    except Exception as exc:
        logger.exception("Ошибка TTS: %s", exc)
        return TTSResponse(success=False, error=str(exc))


@router.post("/ml/llm", response_model=LLMResponse)
async def llm_generate(request: LLMRequest, db: Session = Depends(get_db)):
    try:
        user = get_user(db, request.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        api = LLMInferenceAPI()
        result = api.predict(request.text)
        return LLMResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка LLM: %s", exc)
        return LLMResponse(success=False, error=str(exc))


@router.post("/ml/dialog", response_model=DialogResponse)
async def dialog(request: DialogRequest, db: Session = Depends(get_db)):
    try:
        user = get_user(db, request.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        pipeline = DialogPipeline()
        result = pipeline.run(audio_input=request.audio_path, return_audio=True)

        if result.get("success"):
            dialog_data = DialogCreate(
                user_id=request.user_id,
                chat_id=request.chat_id,
                user_audio_raw_path=request.audio_path,
                user_text=result.get("user_text"),
                model_text=result.get("assistant_text"),
                tts_audio_path=result.get("audio_path")
            )
            create_dialog(db, dialog_data)

        return DialogResponse(
            success=result.get("success", False),
            user_text=result.get("user_text", ""),
            model_text=result.get("assistant_text", ""),
            audio_path=result.get("audio_path"),
            error=result.get("error")
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

        pipeline = EGRNPipeline()
        result = pipeline.run(request.pdf_path, save_json=True)

        if result.get("success") and result.get("properties"):
            props = result["properties"]
            property_data = PropertyCreate(
                user_id=request.user_id,
                object_id=props.get("object_id", ""),
                address=props.get("address"),
                owner=props.get("owner"),
                object_type=props.get("object_type"),
                reg_date=props.get("reg_date"),
                total_area=props.get("total_area"),
                cadastral_price=props.get("cadastral_price"),
                floor=props.get("floor")
            )
            create_property(db, property_data)

        return EGRNResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ошибка EGRN: %s", exc)
        return EGRNResponse(success=False, error=str(exc))


@router.post("/ml/plan-3d", response_model=Plan3DResponse)
async def generate_3d(request: Plan3DRequest):
    try:
        api = Plan3DInferenceAPI()
        result = api.predict(
            request.svg_path,
            request.output_path,
            thick=request.wall_thickness,
            h=request.wall_height,
            steps=request.steps,
            min_len=request.min_length
        )
        return Plan3DResponse(**result)
    except Exception as exc:
        logger.exception("Ошибка 3D генерации: %s", exc)
        return Plan3DResponse(success=False, error=str(exc))


@router.post("/ml/plan-tracing", response_model=PlanTracingResponse)
async def trace_plan(request: PlanTracingRequest):
    try:
        api = PlanTracingInferenceAPI()
        result = api.predict(request.image_path, request.output_path)
        return PlanTracingResponse(**result)
    except Exception as exc:
        logger.exception("Ошибка трассировки: %s", exc)
        return PlanTracingResponse(success=False, error=str(exc))


@router.post("/ml/segmentation", response_model=SegmentationResponse)
async def segment_image(request: SegmentationRequest):
    try:
        api = SegmentationInferenceAPI()
        result = api.predict(request.image_path, prompt="interior segmentation")
        seg_result = result.get("result", {})
        seg_path = seg_result.get("segmentation_path") if isinstance(seg_result, dict) else None
        return SegmentationResponse(
            success=result.get("success", False),
            segmentation_path=seg_path or request.output_path,
            error=result.get("error")
        )
    except Exception as exc:
        logger.exception("Ошибка сегментации: %s", exc)
        return SegmentationResponse(success=False, error=str(exc))


@router.post("/ml/style-diffusion", response_model=StyleDiffusionResponse)
async def style_diffusion(request: StyleDiffusionRequest):
    try:
        api = StyleDiffusionInferenceAPI()
        generated_paths: List[str] = []
        for i in range(request.num_images):
            output = request.output_path or f"{Path(request.image_path).stem}_gen_{i+1:03d}.jpg"
            if request.num_images > 1:
                output = str(Path(output).parent / f"{Path(request.image_path).stem}_gen_{i+1:03d}.jpg")
            result = api.predict(request.image_path, request.prompt, output)
            if result.get("success"):
                img_result = result.get("result")
                if hasattr(img_result, "save"):
                    img_result.save(output)
                    generated_paths.append(output)
                elif isinstance(result.get("result"), str):
                    generated_paths.append(result.get("result"))
        return StyleDiffusionResponse(
            success=len(generated_paths) > 0,
            generated_paths=generated_paths,
            error=None if generated_paths else "Не удалось сгенерировать изображения"
        )
    except Exception as exc:
        logger.exception("Ошибка стилизации: %s", exc)
        return StyleDiffusionResponse(success=False, error=str(exc))


@router.post("/ml/plan-processing", response_model=PlanProcessingResponse)
async def process_plan(request: PlanProcessingRequest):
    try:
        pipeline = PlanProcessingPipeline(use_ocr=request.use_ocr, use_bbox=request.use_bbox)
        result = pipeline.run(request.image_path, normalize=request.normalize)
        return PlanProcessingResponse(**result)
    except Exception as exc:
        logger.exception("Ошибка обработки плана: %s", exc)
        return PlanProcessingResponse(success=False, error=str(exc))


@router.post("/ml/photo-generation", response_model=PhotoGenerationResponse)
async def generate_photo(request: PhotoGenerationRequest, db: Session = Depends(get_db)):
    try:
        user = get_user(db, request.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        api = StyleDiffusionInferenceAPI()
        prompt = request.prompt or request.user_text or "красивый современный интерьер"
        generated_paths: List[str] = []
        for i in range(4):
            output = str(Path(request.input_photo_path).parent / f"{Path(request.input_photo_path).stem}_gen_{i+1:03d}.jpg")
            result = api.predict(request.input_photo_path, prompt, output)
            if result.get("success"):
                img_result = result.get("result")
                if hasattr(img_result, "save"):
                    img_result.save(output)
                    generated_paths.append(output)
                elif isinstance(result.get("result"), str):
                    generated_paths.append(result.get("result"))

        photo_id: Optional[int] = None
        if generated_paths:
            photo_data = PhotoCreate(
                user_id=request.user_id,
                input_photo_path=request.input_photo_path,
                user_text=request.user_text,
                generated_prompt=prompt,
                generated_photo_paths=generated_paths
            )
            db_photo = create_photo(db, photo_data)
            photo_id = db_photo.id

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
        return PhotoGenerationResponse(success=False, error=str(exc))


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
    return [{"id": p.id, "input_photo_path": p.input_photo_path, "generated_photo_paths": p.generated_photo_paths} for p in photos]


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
