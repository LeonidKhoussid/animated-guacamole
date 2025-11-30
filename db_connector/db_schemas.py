from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# ========== ДЛЯ ПОЛЬЗОВАТЕЛЯ ==========

class UserBase(BaseModel):
    user_id: EmailStr
    password: str = Field(..., min_length=6)

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    password: Optional[str] = Field(None, min_length=6)

class UserResponse(BaseModel):
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ========== СХЕМЫ ЕГРН ==========

class PropertyBase(BaseModel):
    object_id: str
    address: Optional[str] = None
    owner: Optional[str] = None
    object_type: Optional[str] = None
    reg_date: Optional[str] = None
    total_area: Optional[float] = None
    cadastral_price: Optional[float] = None
    floor: Optional[int] = None

class PropertyCreate(PropertyBase):
    user_id: EmailStr

class PropertyUpdate(BaseModel):
    address: Optional[str] = None
    owner: Optional[str] = None
    object_type: Optional[str] = None
    reg_date: Optional[str] = None
    total_area: Optional[float] = None
    cadastral_price: Optional[float] = None
    floor: Optional[int] = None

class PropertyResponse(PropertyBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== СХЕМЫ ПЛАНОВ ==========

class PlanBase(BaseModel):
    object_id: str
    raw_plan_path: Optional[str] = None
    normalized_plan_path: Optional[str] = None
    vectorized_plan_path: Optional[str] = None
    vector_npy_path: Optional[str] = None
    walls_vector_data: Optional[dict] = None
    obj_3d_path: Optional[str] = None

class PlanCreate(PlanBase):
    user_id: EmailStr

class PlanUpdate(BaseModel):
    raw_plan_path: Optional[str] = None
    normalized_plan_path: Optional[str] = None
    vectorized_plan_path: Optional[str] = None
    vector_npy_path: Optional[str] = None
    walls_vector_data: Optional[dict] = None
    obj_3d_path: Optional[str] = None

class PlanResponse(PlanBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== СХЕМЫ ДИАЛОГА ==========

class DialogBase(BaseModel):
    chat_id: str
    user_audio_raw_path: Optional[str] = None
    user_audio_clean_path: Optional[str] = None
    user_text: Optional[str] = None
    model_text: Optional[str] = None
    tts_audio_path: Optional[str] = None

class DialogCreate(DialogBase):
    user_id: EmailStr

class DialogUpdate(BaseModel):
    user_audio_raw_path: Optional[str] = None
    user_audio_clean_path: Optional[str] = None
    user_text: Optional[str] = None
    model_text: Optional[str] = None
    tts_audio_path: Optional[str] = None

class DialogResponse(DialogBase):
    id: int
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ========== СХЕМЫ ФОТО ==========

class PhotoBase(BaseModel):
    object_id: Optional[str] = None
    input_photo_path: str
    user_text: Optional[str] = None
    generated_prompt: Optional[str] = None
    generated_photo_paths: Optional[List[str]] = None

class PhotoCreate(PhotoBase):
    user_id: EmailStr

class PhotoUpdate(BaseModel):
    user_text: Optional[str] = None
    generated_prompt: Optional[str] = None
    generated_photo_paths: Optional[List[str]] = None

class PhotoResponse(PhotoBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
