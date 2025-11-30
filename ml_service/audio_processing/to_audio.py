import os
import re
import torch
import logging
import soundfile as sf
from pathlib import Path
from typing import Optional
from config import TTSConfig, CUDAConfig

CUDAConfig()

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(h)


class TextToSpeech:
    """ГЕНЕРАЦИЯ РЕЧИ SILERO"""

    # Конструктор
    def __init__(self, config: Optional[TTSConfig] = None):
        if torch is None:
            logger.error("torch не установлен")
            raise ImportError("Установите torch")
        self.config = config if config else TTSConfig()
        device_obj = torch.device(self.config.device)
        from pathlib import Path as _P
        model_path = _P(self.config.model_dir) / f"{self.config.model_id}.pt"
        try:
            import torch.hub as hub_module
            orig_validate = getattr(hub_module, "_validate_not_a_forked_repo", None)

            def _patched(repo_owner, repo_name, ref):
                if repo_owner == "snakers4" and repo_name == "silero-models":
                    return
                if orig_validate:
                    return orig_validate(repo_owner, repo_name, ref)

            hub_module._validate_not_a_forked_repo = _patched
            try:
                self.model, self.example_text = torch.hub.load(
                    repo_or_dir="snakers4/silero-models",
                    model="silero_tts",
                    language=self.config.language,
                    speaker=self.config.model_id,
                    trust_repo=True,
                    force_reload=False,
                )
            finally:
                if orig_validate is not None:
                    hub_module._validate_not_a_forked_repo = orig_validate
            self.model.to(device_obj)
            logger.info(f"Silero {self.config.model_id} на {self.config.device}")
        except Exception as e:
            logger.error(f"Ошибка загрузки Silero TTS: {e}")
            raise

    # Путь файла
    @staticmethod
    def _get_next_output_path(directory: str, prefix: str = "output_", extension: str = ".wav") -> str:
        os.makedirs(directory, exist_ok=True)
        files = [f for f in os.listdir(directory) if f.startswith(prefix) and f.endswith(extension)]
        nums = []
        for f in files:
            m = re.search(rf"{re.escape(prefix)}(\d+){re.escape(extension)}", f)
            if m:
                try:
                    nums.append(int(m.group(1)))
                except Exception:
                    pass
        idx = max(nums, default=0) + 1
        return os.path.join(directory, f"{prefix}{idx:02d}{extension}")

    # Текст обработка
    @staticmethod
    def _improve_text_for_tts(text: str) -> str:
        if not text:
            return text
        t = re.sub(r"\s+", " ", text.strip())
        t = re.sub(r"([,;])\s*", r"\1 ", t)
        t = re.sub(r"([!?])\s*", r"\1 ", t)
        t = re.sub(r"\.\s+", ". ", t)
        return re.sub(r"\b(если|потому что|даже|когда|где)\s+", r"\1 ", t)

    # Конвертация ударений
    @staticmethod
    def _convert_stress_to_base_notes(text: str) -> str:
        if "'" not in text:
            return text
        return re.sub(r"([а-яё]+)'([а-яё]+)", lambda m: m.group(1) + "+" + m.group(2), text, flags=re.IGNORECASE)

    # Автоударение
    @staticmethod
    def _add_stress_auto(text: str) -> str:
        return text

    # Синтез
    def synthesize(self, text: str, use_stress: Optional[bool] = None, auto_improve: Optional[bool] = None) -> Optional[str]:
        if not text or not text.strip():
            logger.warning("Пустой текст")
            return None
        use_stress_flag = use_stress if use_stress is not None else self.config.use_base_notes
        improve = auto_improve if auto_improve is not None else self.config.auto_improve_text
        original = text
        text = text.replace("|||", "   ").replace("||", "  ").replace("|", " ")
        if improve:
            text = self._improve_text_for_tts(text)
        if use_stress_flag:
            has_stress = "'" in text
            has_base = "+" in text
            if has_stress and not has_base:
                text = self._convert_stress_to_base_notes(text)
            elif not has_stress and not has_base:
                text = self._add_stress_auto(text)
                if "'" in text:
                    text = self._convert_stress_to_base_notes(text)
        out_path = self._get_next_output_path(str(self.config.output_dir))
        try:
            audio = self.model.apply_tts(text=text, speaker=self.config.speaker, sample_rate=self.config.sample_rate)
            sf.write(out_path, audio, self.config.sample_rate)
            logger.info(f"Аудио сохранено: {out_path}")
            return out_path
        except Exception as e:
            logger.error(f"Ошибка при синтезе: {e}")
            logger.error(f"Ориг: {original[:120]}...")
            logger.error(f"Обраб: {text[:120]}...")
            return None


# from ml_service.audio_processing.to_audio import TextToSpeech
# # Запуск
# if __name__ == "__main__":
#     cfg = TTSConfig()
#     tts = TextToSpeech(cfg)
#     # out = tts.synthesize("")
