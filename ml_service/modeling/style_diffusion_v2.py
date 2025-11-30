import os
import gc
import json
import torch
import logging
import numpy as np
from PIL import Image
from pathlib import Path
from datetime import datetime
from huggingface_hub import login
from typing import Optional, Tuple
from scipy.signal import fftconvolve
from diffusers import UniPCMultistepScheduler
from transformers import AutoImageProcessor, UperNetForSemanticSegmentation

from config import StyleDiffusionConfig
from ml_service.modeling.segmentation import ControlNetSegmentation
from ml_service.utils.img_norm import normalize_image_size
from ml_service.utils.prompt_gen import PromptGenerator


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(h)


# Палетка для масок
def ade_palette() -> list:
    return [[120, 120, 120], [180, 120, 120], [6, 230, 230], [80, 50, 50],
            [4, 200, 3], [120, 120, 80], [140, 140, 140], [204, 5, 255],
            [230, 230, 230], [4, 250, 7], [224, 5, 255], [235, 255, 7],
            [150, 5, 61], [120, 120, 70], [8, 255, 51], [255, 6, 82],
            [143, 255, 140], [204, 255, 4], [255, 51, 7], [204, 70, 3],
            [0, 102, 200], [61, 230, 250], [255, 6, 51], [11, 102, 255],
            [255, 7, 71], [255, 9, 224], [9, 7, 230], [220, 220, 220],
            [255, 9, 92], [112, 9, 255], [8, 255, 214], [7, 255, 224],
            [255, 184, 6], [10, 255, 71], [255, 41, 10], [7, 255, 255],
            [224, 255, 8], [102, 8, 255], [255, 61, 6], [255, 194, 7],
            [255, 122, 8], [0, 255, 20], [255, 8, 41], [255, 5, 153],
            [6, 51, 255], [235, 12, 255], [160, 150, 20], [0, 163, 255],
            [140, 140, 140], [250, 10, 15], [20, 255, 0], [31, 255, 0],
            [255, 31, 0], [255, 224, 0], [153, 255, 0], [0, 0, 255],
            [255, 71, 0], [0, 235, 255], [0, 173, 255], [31, 0, 255],
            [11, 200, 200], [255, 82, 0], [0, 255, 245], [0, 61, 255],
            [0, 255, 112], [0, 255, 133], [255, 0, 0], [255, 163, 0],
            [255, 102, 0], [194, 255, 0], [0, 143, 255], [51, 255, 0],
            [0, 82, 255], [0, 255, 41], [0, 255, 173], [10, 0, 255],
            [173, 255, 0], [0, 255, 153], [255, 92, 0], [255, 0, 255],
            [255, 0, 245], [255, 0, 102], [255, 173, 0], [255, 0, 20],
            [255, 184, 184], [0, 31, 255], [0, 255, 61], [0, 71, 255],
            [255, 0, 204], [0, 255, 194], [0, 255, 82], [0, 10, 255],
            [0, 112, 255], [51, 0, 255], [0, 194, 255], [0, 122, 255],
            [0, 255, 163], [255, 153, 0], [0, 255, 10], [255, 112, 0],
            [143, 255, 0], [82, 0, 255], [163, 255, 0], [255, 235, 0],
            [8, 184, 170], [133, 0, 255], [0, 255, 92], [184, 0, 255],
            [255, 0, 31], [0, 184, 255], [0, 214, 255], [255, 0, 112],
            [92, 255, 0], [0, 224, 255], [112, 224, 255], [70, 184, 160],
            [163, 0, 255], [153, 0, 255], [71, 255, 0], [255, 0, 163],
            [255, 204, 0], [255, 0, 143], [0, 255, 235], [133, 255, 0],
            [255, 0, 235], [245, 0, 255], [255, 0, 122], [255, 245, 0],
            [10, 190, 212], [214, 255, 0], [0, 204, 255], [20, 0, 255],
            [255, 255, 0], [0, 153, 255], [0, 41, 255], [0, 255, 204],
            [41, 0, 255], [41, 255, 0], [173, 0, 255], [0, 245, 255],
            [71, 0, 255], [122, 0, 255], [0, 255, 184], [0, 92, 255],
            [184, 255, 0], [0, 133, 255], [255, 214, 0], [25, 194, 194],
            [102, 255, 0], [92, 0, 255]]


# Очистка
def flush():
    gc.collect()
    try:
        torch.cuda.empty_cache()
    except Exception:
        pass


# Свёртка
def convolution(mask: Image.Image, size: int = 9) -> Image.Image:
    m = np.array(mask.convert("L"))
    k = np.ones((size, size), dtype=float) / (size ** 2)
    blended = fftconvolve(m, k, mode="same").astype(np.uint8)
    b = size
    blended[:b, :] = m[:b, :]
    blended[-b:, :] = m[-b:, :]
    blended[:, :b] = m[:, :b]
    blended[:, -b:] = m[:, -b:]
    return Image.fromarray(blended).convert("L")


# Постобработка
def postprocess_image_masking(inpainted: Image.Image, image: Image.Image, mask: Image.Image) -> Image.Image:
    out = Image.composite(inpainted.convert("RGBA"), image.convert("RGBA"), mask)
    return out.convert("RGB")


class StyleDiffusionV2:
    """ДИФУЗИОННАЯ МОДЕЛЬ"""

    def __init__(self, config: Optional[StyleDiffusionConfig] = None):
        self.config = config if config else StyleDiffusionConfig()
        self.device = self._get_device()
        self._setup_hf_auth()
        self.pipe = None
        self.controlnet_seg = ControlNetSegmentation(config=self.config, device=self.device)
        self.controlnet = self.controlnet_seg.get_controlnet()
        self.segmentation_processor = None
        self.segmentation_model = None
        self.prompt_generator = PromptGenerator()
        self.use_custom_pipeline = False
        self._load_models()

    # Устройство
    def _get_device(self) -> str:
        from config import CUDAConfig
        return CUDAConfig().device

    # Токен для загрузки [если не скачана]
    def _setup_hf_auth(self):
        token = self.config.hf_token
        os.environ["HUGGINGFACEHUB_API_TOKEN"] = token or ""
        try:
            if token:
                login(token=token)
        except Exception as e:
            logger.warning(f"HF ошибка входа: {e}")

    # Пайплайн
    def _load_pipeline(self):
        base_dir = Path(self.config.base_model_dir)
        base_model = str(base_dir) if base_dir.exists() and any(base_dir.iterdir()) else self.config.base_model
        try:
            from stable_diffusion_controlnet_inpaint_img2img import StableDiffusionControlNetInpaintImg2ImgPipeline
            self.use_custom_pipeline = True
        except ImportError:
            from diffusers import StableDiffusionControlNetInpaintPipeline as StableDiffusionControlNetInpaintImg2ImgPipeline
            self.use_custom_pipeline = False

        self.pipe = StableDiffusionControlNetInpaintImg2ImgPipeline.from_pretrained(
            base_model,
            controlnet=self.controlnet,
            torch_dtype=torch.float16 if self.device != "cpu" else torch.float32,
            safety_checker=None,
            requires_safety_checker=False
        )

        if not (base_dir.exists() and any(base_dir.iterdir())):
            base_dir.mkdir(parents=True, exist_ok=True)
            try:
                self.pipe.save_pretrained(str(base_dir))
            except Exception:
                pass

        self.pipe.scheduler = UniPCMultistepScheduler.from_config(self.pipe.scheduler.config)
        self.pipe.to(self.device)
        if self.device != "cpu":
            try:
                self.pipe.enable_xformers_memory_efficient_attention()
            except Exception:
                logger.debug("xformers не поддерживаются")

    # Сегментация
    def _load_segmentation(self):
        seg_dir = Path(self.config.segmentation_model_dir)
        if seg_dir.exists() and any(seg_dir.iterdir()):
            proc_src = str(seg_dir)
            model_src = str(seg_dir)
        else:
            proc_src = self.config.segmentation_model
            model_src = self.config.segmentation_model
            seg_dir.mkdir(parents=True, exist_ok=True)
        self.segmentation_processor = AutoImageProcessor.from_pretrained(proc_src)
        self.segmentation_model = UperNetForSemanticSegmentation.from_pretrained(model_src)
        self.segmentation_model.to(self.device)
        self.segmentation_model.eval()

    # Загрузка
    def _load_models(self):
        self._load_pipeline()
        self._load_segmentation()
        logger.info(f"Модели загружены на {self.device}")

    # Сегмап
    def _generate_segmentation_map(self, image: Image.Image) -> Tuple[Image.Image, np.ndarray]:
        pv = self.segmentation_processor(image, return_tensors="pt").pixel_values.to(self.device)
        with torch.no_grad():
            outputs = self.segmentation_model(pv)
        seg = self.segmentation_processor.post_process_semantic_segmentation(outputs, target_sizes=[image.size[::-1]])[0]
        if isinstance(seg, torch.Tensor):
            seg = seg.cpu().numpy()
        palette = np.array(ade_palette(), dtype=np.uint8)
        color = np.zeros((seg.shape[0], seg.shape[1], 3), dtype=np.uint8)
        for lbl, col in enumerate(palette):
            color[seg == lbl] = col
        return Image.fromarray(color).convert("RGB"), seg

    # Подготовка
    def _prepare_image(self, image_path: Path) -> Optional[Image.Image]:
        if not image_path.exists():
            logger.error(f"Файл не найден: {image_path}")
            return None
        img = Image.open(image_path)
        if img.mode != "RGB":
            img = img.convert("RGB")
        max_size = max(self.config.max_image_size) if self.config.max_image_size else None
        return normalize_image_size(img, max_size=max_size, divisible_by=8)

    # Генерация
    def generate(self, image_path: Path, prompt: str, negative_prompt: Optional[str] = None,
                 num_inference_steps: Optional[int] = None, guidance_scale: Optional[float] = None,
                 seed: Optional[int] = None, use_system_prompt: bool = True, strength: float = 1.0) -> Tuple[Optional[Image.Image], Optional[Image.Image]]:
        if not Path(image_path).exists():
            logger.error(f"Файл не найден: {image_path}")
            return None, None

        img = self._prepare_image(Path(image_path))
        if img is None:
            return None, None

        seg_img, seg_arr = self._generate_segmentation_map(img)
        gen_prompt = self.prompt_generator.generate_prompt(prompt, translate=True)
        full = f"{self.config.default_positive_prompt}, {gen_prompt}" if use_system_prompt and self.config.default_positive_prompt else gen_prompt
        steps = num_inference_steps if num_inference_steps is not None else self.config.num_inference_steps
        guidance = guidance_scale if guidance_scale is not None else self.config.guidance_scale
        gen = torch.Generator(device=self.device).manual_seed(seed) if seed is not None else None

        inpaint_mask = Image.new("RGB", img.size, (255, 255, 255))
        mask_post = convolution(inpaint_mask.convert("L"))

        pipe_kwargs = {
            "prompt": full,
            "negative_prompt": negative_prompt,
            "num_inference_steps": steps,
            "guidance_scale": guidance,
            "generator": gen,
            "image": img,
            "mask_image": inpaint_mask,
            "height": img.height,
            "width": img.width
        }
        if self.use_custom_pipeline:
            pipe_kwargs["controlnet_conditioning_image"] = seg_img
        else:
            pipe_kwargs["control_image"] = seg_img

        try:
            import inspect
            sig = inspect.signature(self.pipe.__call__)
            if "strength" in sig.parameters:
                pipe_kwargs["strength"] = strength
        except Exception:
            pass

        out = self.pipe(**pipe_kwargs).images[0]
        out = postprocess_image_masking(out, img, mask_post)
        flush()
        return out, seg_img

    # История
    def _save_history_entry(self, prompt: str, input_image_path: Path, output_image_path: Path):
        hf = Path(self.config.output_dir) / "history.json"
        if hf.exists():
            try:
                with open(hf, "r", encoding="utf-8") as f:
                    history = json.load(f)
            except Exception:
                history = []
        else:
            history = []
        history.append({"timestamp": datetime.now().isoformat(), "user_prompt": prompt,
                        "user_input_img": str(input_image_path), "user_output_img": str(output_image_path)})
        try:
            with open(hf, "w", encoding="utf-8") as f:
                json.dump(history, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    # Обработка
    def process(self, image_path: Path, prompt: str, negative_prompt: Optional[str] = None,
                output_filename: Optional[str] = None, num_inference_steps: Optional[int] = None,
                guidance_scale: Optional[float] = None, seed: Optional[int] = None, use_system_prompt: bool = True,
                strength: float = 1.0, save_history: bool = True) -> Optional[Path]:
        ip = Path(image_path)
        if not ip.exists():
            logger.error(f"Нет фото: {ip}")
            return None

        result_image, seg_map = self.generate(
            image_path=ip, prompt=prompt, negative_prompt=negative_prompt,
            num_inference_steps=num_inference_steps, guidance_scale=guidance_scale,
            seed=seed, use_system_prompt=use_system_prompt, strength=strength
        )
        if result_image is None or seg_map is None:
            logger.error("Нудача!") # ещё какая!
            return None

        out_dir = Path(self.config.output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        if output_filename is None:
            name = ip.stem
            import re
            m = re.search(r"(\d{3,})", name)
            if m:
                output_filename = f"{self.config.output_filename_prefix}{m.group(1)}.jpg"
            else:
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_filename = f"{self.config.output_filename_prefix}{ts}.jpg"

        out_path = out_dir / output_filename
        try:
            result_image.save(str(out_path))
            logger.info(f"Фото сохранено: {out_path}")
        except Exception as e:
            logger.error(f"Ошибка при сохранении фото: {e}")
            return None

        seg_name = output_filename.replace(".jpg", "_segmentation.png").replace(".png", "_segmentation.png")
        try:
            seg_map.save(str(out_dir / seg_name))
            logger.info(f"Маска сохранена: {out_dir / seg_name}")
        except Exception as e:
            logger.warning(f"Ошибка при сохранении маски: {e}")

        if save_history:
            self._save_history_entry(prompt=prompt, input_image_path=ip, output_image_path=out_path)

        return out_path


# from ml_service.modeling.style_diffusion_v2 import StyleDiffusionV2
# from config import StyleDiffusionConfig
# from pathlib import Path
#
# # Запуск
# if __name__ == "__main__":
#     from config import StyleDiffusionConfig
#
#     config = StyleDiffusionConfig()
#     generator = StyleDiffusionV2(config=config)
#
#     image_files = config.get_input_images()
#     prompt = config.example_prompt
#
#     for img_path in image_files:
#         original_name = img_path.stem
#         original_ext = img_path.suffix
#         output_filename = f"{original_name}_gen{original_ext}"
#
#         generator.process(
#             image_path=img_path,
#             prompt=prompt,
#             output_filename=output_filename
#         )
