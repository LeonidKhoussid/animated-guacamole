import os
import logging
from pathlib import Path

try:
    import torch
except ImportError:
    torch = None

BASE_DIR = os.path.dirname(os.path.abspath("."))

logger = logging.getLogger(__name__)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(ch)


class EGRNConfig:
    """КОНФИГ ПАРСЕРА ДОКИ ЕГРН"""

    def __init__(self):
        self.input_dir = "./data/egrn_prop"
        self.output_dir = "./data/egrn_prop"
        self.pdf_output_dir = "./data/egrn_prop"
        self.pdf_ext = [".pdf"]
        self.image_ext = [".jpg", ".jpeg", ".png"]

        Path(self.input_dir).mkdir(parents=True, exist_ok=True)
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)
        Path(self.pdf_output_dir).mkdir(parents=True, exist_ok=True)


class CUDAConfig:
    """КОНФИГ ДЛЯ CUDA"""

    def __init__(self):
        self.cuda_settings = {
            "CUDA_AUTO_BOOST": "1",
            "CUDA_MODULE_LOADING": "LAZY",
            "CUDA_FORCE_PRELOAD_LIBRARIES": "1",
            "CUDA_DEVICE_MAX_CONNECTIONS": "32",
            "CUDA_CACHE_MAXSIZE": "12884901888",
            "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True",
        }
        self.apply_cuda_settings()
        self.device = self.determine_device()

    def apply_cuda_settings(self):
        for key, value in self.cuda_settings.items():
            os.environ[key] = value

    @staticmethod
    def determine_device():
        if torch is None:
            return "cpu"
        
        if torch.cuda.is_available():
            try:
                torch.cuda.init()
                return "cuda:0"
            except Exception as e:
                logger.warning(f"CUDA initialization failed: {str(e)}. Falling back to CPU.")
        return "cpu"


class OCRConfig:
    """КОНФИГ ДЛЯ OCR"""

    def __init__(self):
        self.model_name = "microsoft/trocr-base-printed"
        self.model_dir = "./models/trocr-base-printed"
        self.debug = False
        self.standard_width = 1920
        self.standard_height = 2560
        
        cuda_cfg = CUDAConfig()
        self.device = cuda_cfg.device

        Path(self.model_dir).mkdir(parents=True, exist_ok=True)


class PlanToVecConfig:
    """КОНФИГ ДЛЯ ВЕКТОРИЗАЦИИ"""

    def __init__(self):
        # Пути
        self.input_dir = "./data/plans/croped"
        self.output_dir = "./data/plans/normalized"
        self.images_output_dir = "./data/plans/normalized/images"
        self.masks_output_dir = "./data/plans/normalized/masks"
        self.vectors_output_file = "./data/plans/normalized/vectors.npy"
        self.json_output_file = "./data/plans/normalized/normalized_plans.json"
        
        # Форматы изображений
        self.image_ext = [".jpg", ".jpeg", ".png"]
        
        # Размеры
        self.target_width = 3000
        self.target_height = 3000
        
        # Настройки удаления текста
        self.text_removal = {

            "min_area_ratio_1": 0.0001, # очень маленькие (меньше 0.01% площади)
            "min_area_ratio_2": 0.001,
            "min_area_ratio_2_density": 0.5,
            "max_aspect_ratio_2": 5,
            "min_area_ratio_3": 0.0005,
            "min_aspect_ratio_3": 0.7,
            "max_aspect_ratio_3": 1.5,
            "min_area_ratio_3_density": 0.6,
        }
        
        # Сглаживание
        self.smoothing = {
            "gaussian_kernel_size": 3,
            "morphology_kernel_size": 2,
            "morphology_iterations": 1,
        }
        
        # Поиск стен
        self.wall_detection = {
            "min_area_ratio": 0.0001,  # минимум 0.01% от площади
            "morphology_kernel_size": 2,
            "morphology_iterations": 1,
        }
        
        # Поиск квартир
        self.apartment_detection = {
            "morphology_kernel_size": 3,
            "morphology_iterations": 2,
        }
        
        #  Обрезка
        self.cropping = {
            "padding": 20,
        }

        Path(self.input_dir).mkdir(parents=True, exist_ok=True)
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)
        Path(self.images_output_dir).mkdir(parents=True, exist_ok=True)
        Path(self.masks_output_dir).mkdir(parents=True, exist_ok=True)


class BBoxDetectorConfig:
    """КОНФИГ ДЛЯ ДЕТЕКЦИИ BBOX"""

    def __init__(self):
        self.input_dir = "./data/plans/normalized/images"
        self.output_dir = "./data/plans/bboxes"
        self.mmdetection_dir = "./models/mmdetection"
        self.configs_dir = "./models/mmdetection/configs"
        self.weights_dir = "./models/mmdetection/weights"
        
        self.model_name = "cascade_swin"
        self.config_file = "cascade_swin.py"
        self.checkpoint_file = "cascade_swin_latest.pth"
        
        self.wall_class_id = 0
        self.room_class_id = 1
        self.score_threshold = 0.5
        
        Path(self.input_dir).mkdir(parents=True, exist_ok=True)
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)
        Path(self.mmdetection_dir).mkdir(parents=True, exist_ok=True)
        Path(self.configs_dir).mkdir(parents=True, exist_ok=True)
        Path(self.weights_dir).mkdir(parents=True, exist_ok=True)


class StyleDiffusionConfig:
    """КОНФИГ ДЛЯ ГЕНЕРАЦИИ CONTROLNET"""

    def __init__(self):
        self.input_dir = "./data/diffusion/input"
        self.output_dir = "./data/diffusion/output"
        self.model_dir = "./models/style_diffusion"
        self.controlnet_model_dir = "./models/style_diffusion/controlnet-seg-room"
        self.base_model_dir = "./models/style_diffusion/stable-diffusion-inpainting"
        self.segmentation_model_dir = "./models/style_diffusion/upernet-segmentation"
        
        self.hf_token = "my_hf_secret_token"

        self.controlnet_model = "BertChristiaens/controlnet-seg-room"
        self.base_model = "runwayml/stable-diffusion-inpainting"
        self.segmentation_model = "openmmlab/upernet-convnext-small"

        self.max_image_size = (1024, 1024) # настроить под разные ratio потом (в основном телефона)

        self.num_inference_steps = 20
        self.guidance_scale = 7.5

        self.default_positive_prompt = "a photograph of a room, interior design, 4k, high resolution"

        self.preserve_walls = True
        self.preserve_windows = True
        self.preserve_doors = True
        self.preserve_ceiling = True
        self.preserve_floor = True
        self.preserve_furniture = True

        self.output_filename_prefix = "gen_output_img"
        self.example_prompt = (
            "modern bedroom, platform bed, sleek nightstands, minimal lamps, built-in wardrobe, "
            "neutral bedding, floor-to-ceiling window, sheer curtains, geometric rug, wall shelves, "
            "indoor plant, abstract wall art, pendant light, clean lines, uncluttered space"
        )
        
        Path(self.input_dir).mkdir(parents=True, exist_ok=True)
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)
        Path(self.model_dir).mkdir(parents=True, exist_ok=True)

    def get_input_images(self):
        """ФОРМАТЫ НА ВХОД"""
        input_path = Path(self.input_dir)
        image_files = list(input_path.glob("*.jpg")) + list(input_path.glob("*.jpeg")) + list(input_path.glob("*.png"))
        return image_files


class NLPConfig:
    """КОНФИГ ДЛЯ NLP МОДЕЛЕЙ"""

    def __init__(self):
        self.nlp_models_dir = "./models/nlp"
        self.spacy_model_en = "en_core_web_sm"
        self.spacy_model_ru = "ru_core_news_sm"
        self.spacy_en_model_dir = "./models/nlp/spacy_model_en"
        self.spacy_ru_model_dir = "./models/nlp/spacy_model_ru"
        
        self.nltk_data_dir = "./models/nlp/nltk_data"
        
        Path(self.nlp_models_dir).mkdir(parents=True, exist_ok=True)
        Path(self.spacy_en_model_dir).mkdir(parents=True, exist_ok=True)
        Path(self.spacy_ru_model_dir).mkdir(parents=True, exist_ok=True)
        Path(self.nltk_data_dir).mkdir(parents=True, exist_ok=True)


class AudioConfig:
    """КОНФИГУРАЦИЯ ЗАПИСИ"""

    def __init__(self):
        self.sample_rate = 48000
        self.channels = 1
        self.chunk_duration = 0.5
        self.chunk_samples = int(self.sample_rate * self.chunk_duration)
        self.silence_threshold = 0.01
        self.silence_limit = 1.5
        self.max_duration = 30


class WhisperConfig:
    """КОНФИГУРАЦИЯ ДЛЯ WHISPER"""

    def __init__(self):
        if torch is None:
            self.device = "cpu"
        else:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.fp16 = self.device == "cuda"
        self.available_languages = ["ru", "en"]
        self.target_language = "ru"
        self.model_dir = "./models/whisper"
        
        Path(self.model_dir).mkdir(parents=True, exist_ok=True)


class UVRConfig:
    """КОНФИГУРАЦИЯ ДЛЯ UVR"""

    def __init__(self):
        self.model_path = "./models/mdx_net/UVR-MDX-NET-Inst_HQ_4.onnx"
        self.metadata_path = "./models/mdx_net/model_data/model_data.json"
        self.mapper_path = "./models/mdx_net/model_data/model_name_mapper.json"

        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        os.makedirs(os.path.dirname(self.metadata_path), exist_ok=True)


class LLMSessionConfig:
    """КОНФИГ ДЛЯ LLM СЕССИЙ"""

    def __init__(self):
        self.session_dir = "./data/llm_session"
        self.raw_audio_dir = "./data/llm_session/raw"
        self.clean_audio_dir = "./data/llm_session/clean"
        self.dialog_file = "./data/llm_session/dialog.txt"
        
        Path(self.session_dir).mkdir(parents=True, exist_ok=True)
        Path(self.raw_audio_dir).mkdir(parents=True, exist_ok=True)
        Path(self.clean_audio_dir).mkdir(parents=True, exist_ok=True)


class TTSConfig:
    """
    КОНФИГ ДЛЯ TTS (SILERO TTS)

    Модели из коробки:
    1) v5_ru - базовая
    2) v5_cis_base - лучшая читаемость
    3) v5_cis_base_nostress - без ударений

    * голоса - авто показываются
    """

    def __init__(self):
        if torch is None:
            self.device = "cpu"
        else:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.language = "ru"
        self.model_id = "v5_cis_base"
        self.speaker = "ru_alfia"
        self.sample_rate = 48000
        self.model_dir = "./models/silero_tts"
        self.output_dir = "./data/llm_session/tts_output"
        self.use_base_notes = True      # фонемы
        self.auto_improve_text = True   # паузы
        
        Path(self.model_dir).mkdir(parents=True, exist_ok=True)
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)


class LlamaGGUFConfig:
    """КОНФИГУРАЦИЯ ДЛЯ ЛОКАЛЬНОЙ GGUF МОДЕЛИ"""

    def __init__(
            self,
            model_name: str = "Meta-Llama-3-8B-Instruct.Q4_0.gguf",
            model_path: str = "./models/meta_llama",
            context_size: int = 8192,
            verbose: bool = False,
            device: str = "cuda",
            max_tokens: int = 300,
            temp: float = 0.7,
            top_k: int = 40,
            top_p: float = 0.4,
            min_p: float = 0.0,
            repeat_penalty: float = 1.18,
            repeat_last_n: int = 64,
            n_batch: int = 8,
            n_predict: int | None = None,
            streaming: bool = False
    ):
        self.model_name = model_name
        self.model_path = model_path
        self.context_size = context_size
        self.verbose = verbose
        self.max_tokens = max_tokens
        self.temp = temp
        self.top_k = top_k
        self.top_p = top_p
        self.min_p = min_p
        self.repeat_penalty = repeat_penalty
        self.repeat_last_n = repeat_last_n
        self.n_batch = n_batch
        self.n_predict = n_predict if n_predict is not None else max_tokens
        self.streaming = streaming
        self.device = device

        base_dir = Path(__file__).resolve().parent
        self.full_path: str = str(base_dir / "models" / "meta_llama" / self.model_name)
        
        Path(self.model_path).mkdir(parents=True, exist_ok=True)


class PathConfig:
    """КОНФИГ ДЛЯ МЕНЕЖДЕРА ДИАЛОГА"""

    def __init__(self):
        self.data_dir = "./data"
        self.data_text_dir = "./data/llm_session"
        self.dialog_history_file = "./data/llm_session/dialog_history.txt"
        
        Path(self.data_dir).mkdir(parents=True, exist_ok=True)
        Path(self.data_text_dir).mkdir(parents=True, exist_ok=True)


class Plan3DConfig:
    """КОНФИГ ДЛЯ 3D ГЕНЕРАЦИИ СТЕН"""

    def __init__(self):
        self.input_dir = "./data/plans/vectors"
        self.output_dir = "./data/plans/vectors"
        
        self.wall_thickness = 0.2
        self.wall_height = 3.0
        self.steps = 50
        self.min_length = 6.0
        self.scale_factor = 0.01
        
        self.image_ext = [".jpg", ".jpeg", ".png"]
        self.svg_ext = [".svg"]
        
        Path(self.input_dir).mkdir(parents=True, exist_ok=True)
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)
