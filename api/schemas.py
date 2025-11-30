from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    user_id: EmailStr = Field(..., description="Email пользователя")
    password: str = Field(..., min_length=6, description="Пароль (мин. 6 символов)")


class UserLogin(BaseModel):
    user_id: EmailStr
    password: str


class AuthResponse(BaseModel):
    success: bool
    message: str
    user_id: Optional[str] = None


class BBoxRequest(BaseModel):
    image_path: str = Field(..., description="Путь к изображению")
    output_path: Optional[str] = Field(None, description="Путь для сохранения результата с bboxes")


class BBoxResponse(BaseModel):
    success: bool
    bboxes: List[List[float]] = Field(default_factory=list)
    classes: List[str] = Field(default_factory=list)
    wall_bboxes: List[List[float]] = Field(default_factory=list)
    room_bboxes: List[List[float]] = Field(default_factory=list)
    image_path: Optional[str] = None
    error: Optional[str] = None


class OCRRequest(BaseModel):
    image_path: str = Field(..., description="Путь к изображению")


class OCRResponse(BaseModel):
    success: bool
    text: str = ""
    error: Optional[str] = None


class STTRequest(BaseModel):
    audio_path: str = Field(..., description="Путь к аудио файлу (WAV)")


class STTResponse(BaseModel):
    success: bool
    text: str = ""
    error: Optional[str] = None


class TTSRequest(BaseModel):
    text: str = Field(..., description="Текст для синтеза")
    output_path: Optional[str] = Field(None, description="Путь для сохранения аудио")


class TTSResponse(BaseModel):
    success: bool
    audio_path: Optional[str] = None
    error: Optional[str] = None


class LLMRequest(BaseModel):
    text: str = Field(..., description="Текст запроса")
    user_id: EmailStr = Field(..., description="ID пользователя")


class LLMResponse(BaseModel):
    success: bool
    response: str = ""
    error: Optional[str] = None


class DialogRequest(BaseModel):
    user_id: EmailStr
    chat_id: str = Field(..., description="ID чата/сессии")
    audio_path: Optional[str] = Field(None, description="Путь к аудио (если есть)")


class DialogResponse(BaseModel):
    success: bool
    user_text: str = ""
    model_text: str = ""
    audio_path: Optional[str] = None
    error: Optional[str] = None


class EGRNRequest(BaseModel):
    pdf_path: str = Field(..., description="Путь к PDF файлу выписки ЕГРН")
    user_id: EmailStr


class EGRNResponse(BaseModel):
    success: bool
    properties: Dict[str, Any] = Field(default_factory=dict)
    pdf_path: Optional[str] = None
    error: Optional[str] = None


class Plan3DRequest(BaseModel):
    svg_path: str = Field(..., description="Путь к SVG файлу плана")
    output_path: str = Field(..., description="Путь для сохранения OBJ файла")
    wall_thickness: float = Field(0.2, description="Толщина стен")
    wall_height: float = Field(3.0, description="Высота стен")
    steps: int = Field(50, description="Количество шагов")
    min_length: float = Field(6.0, description="Минимальная длина")


class Plan3DResponse(BaseModel):
    success: bool
    obj_path: Optional[str] = None
    svg_path: Optional[str] = None
    error: Optional[str] = None


class PlanTracingRequest(BaseModel):
    image_path: str = Field(..., description="Путь к изображению плана")
    output_path: Optional[str] = Field(None, description="Путь для сохранения результата")


class PlanTracingResponse(BaseModel):
    success: bool
    vectorized_path: Optional[str] = None
    vector_npy_path: Optional[str] = None
    error: Optional[str] = None


class SegmentationRequest(BaseModel):
    image_path: str = Field(..., description="Путь к изображению")
    output_path: Optional[str] = Field(None, description="Путь для сохранения маски сегментации")


class SegmentationResponse(BaseModel):
    success: bool
    segmentation_path: Optional[str] = None
    error: Optional[str] = None


class StyleDiffusionRequest(BaseModel):
    image_path: str = Field(..., description="Путь к изображению")
    prompt: str = Field(..., description="Текстовый промпт для генерации")
    output_path: Optional[str] = Field(None, description="Путь для сохранения результата")
    num_images: int = Field(1, ge=1, le=4, description="Количество изображений (1-4)")


class StyleDiffusionResponse(BaseModel):
    success: bool
    generated_paths: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class PhotoGenerationRequest(BaseModel):
    user_id: EmailStr
    input_photo_path: str = Field(..., description="Путь к входному фото")
    user_text: Optional[str] = Field(None, description="Текст от пользователя")
    prompt: Optional[str] = Field(None, description="Промпт для генерации (если не указан, будет сгенерирован)")


class PhotoGenerationResponse(BaseModel):
    success: bool
    photo_id: Optional[int] = None
    generated_paths: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class PlanProcessingRequest(BaseModel):
    image_path: str = Field(..., description="Путь к изображению плана")
    use_ocr: bool = Field(True, description="Использовать OCR")
    use_bbox: bool = Field(True, description="Использовать детекцию bboxes")
    normalize: bool = Field(True, description="Нормализовать изображение")


class PlanProcessingResponse(BaseModel):
    success: bool
    text: str = ""
    bboxes: List[List[float]] = Field(default_factory=list)
    steps: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None


class SuccessResponse(BaseModel):
    success: bool
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
