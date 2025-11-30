import torch
import logging
from pathlib import Path
from typing import Optional
from diffusers import ControlNetModel
from config import StyleDiffusionConfig


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(h)


class ControlNetSegmentation:
    """СЕГМЕНТАЦИЯ CONTROLNET"""

    def __init__(self, config: Optional[StyleDiffusionConfig] = None, device: Optional[str] = None):
        self.config = config if config else StyleDiffusionConfig()
        self.device = device if device else self._get_device()
        self.controlnet = None
        self._load_controlnet()

    #  Устройство [gpu/cpu]
    def _get_device(self) -> str:
        from config import CUDAConfig
        return CUDAConfig().device

    # Загрузка
    def _load_controlnet(self):
        d = Path(self.config.controlnet_model_dir)
        if d.exists() and any(d.iterdir()):
            self.controlnet = ControlNetModel.from_pretrained(
                str(d),
                torch_dtype=torch.float16 if self.device != "cpu" else torch.float32
            )
        else:
            self.controlnet = ControlNetModel.from_pretrained(
                self.config.controlnet_model,
                torch_dtype=torch.float16 if self.device != "cpu" else torch.float32
            )
            d.mkdir(parents=True, exist_ok=True)
            self.controlnet.save_pretrained(str(d))
        self.controlnet.to(self.device)

    # Получение
    def get_controlnet(self) -> ControlNetModel:
        return self.controlnet


# from ml_service.modeling.diffusion.controlnet import ControlNetSegmentation
# # Запуск
# if __name__ == "__main__":
#     cn = ControlNetSegmentation()
#     # model = cn.get_controlnet()
#     # print(model)
