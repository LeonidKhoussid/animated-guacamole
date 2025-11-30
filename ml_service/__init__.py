"""
ML сервис: пайплайны и модели
Отделение логики ML от backend
"""

# Inference APIs - API интерфейсы для ML моделей
from .inference_api import (
    BaseInferenceAPI,
    BBoxInferenceAPI,
    OCRInferenceAPI,
    AudioInferenceAPI,
    LLMInferenceAPI,
    DialogInferenceAPI,
    EGRNInferenceAPI,
    Plan3DInferenceAPI,
    PlanTracingInferenceAPI,
    SegmentationInferenceAPI,
    StyleDiffusionInferenceAPI
)

# Pipelines - комплексные пайплайны обработки
from .ml_pipeline import (
    BasePipeline,
    PlanProcessingPipeline,
    EGRNPipeline,
    DialogPipeline,
    Plan3DPipeline,
    PlanTracingPipeline,
    FullPlanPipeline
)

__all__ = [
    # Inference APIs
    "BaseInferenceAPI",
    "BBoxInferenceAPI",
    "OCRInferenceAPI",
    "AudioInferenceAPI",
    "LLMInferenceAPI",
    "DialogInferenceAPI",
    "EGRNInferenceAPI",
    "Plan3DInferenceAPI",
    "PlanTracingInferenceAPI",
    "SegmentationInferenceAPI",
    "StyleDiffusionInferenceAPI",
    # Pipelines
    "BasePipeline",
    "PlanProcessingPipeline",
    "EGRNPipeline",
    "DialogPipeline",
    "Plan3DPipeline",
    "PlanTracingPipeline",
    "FullPlanPipeline"
]
