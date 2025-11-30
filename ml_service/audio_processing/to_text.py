import time
import logging
import whisper
import torchaudio
import numpy as np
import soundfile as sf
import sounddevice as sd
from pathlib import Path
from config import AudioConfig, WhisperConfig, LLMSessionConfig, CUDAConfig

CUDAConfig()


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(ch)


class AudioToText:
    """ЗАПИСЬ И ТРАНСКРИБИРОВАНИЕ АУДИО ОТ ПОЛЬЗОВАТЕЛЯ"""

    def __init__(self):
        self.audio_cfg = AudioConfig()
        self.whisper_cfg = WhisperConfig()
        self.session_cfg = LLMSessionConfig()

        model_path = Path(self.whisper_cfg.model_dir)
        if model_path.exists() and any(model_path.glob("*.pt")):
            model_file = list(model_path.glob("*.pt"))[0]
            logger.info(f"Иморт Whisper {model_file}")
            self.model = whisper.load_model(str(model_file), device=self.whisper_cfg.device)
        else:
            logger.info("Загрузка Whisper")
            self.model = whisper.load_model("base", device=self.whisper_cfg.device)

    # Запись аудио
    def record_audio_raw(self, turn_num: str) -> str:
        file_path = Path(self.session_cfg.raw_audio_dir) / f"input_{turn_num}_raw.wav"
        frames = []
        silent_duration = 0.0
        start_time = time.time()

        with sd.InputStream(
                samplerate=self.audio_cfg.sample_rate,
                channels=1,
                dtype="float32"
        ) as stream:
            while True:
                data, _ = stream.read(self.audio_cfg.chunk_samples)
                frames.append(data.copy())
                rms = np.sqrt(np.mean(data ** 2))
                if rms < self.audio_cfg.silence_threshold:
                    silent_duration += self.audio_cfg.chunk_duration
                else:
                    silent_duration = 0.0
                if silent_duration >= self.audio_cfg.silence_limit or \
                        (time.time() - start_time) >= self.audio_cfg.max_duration:
                    break

        audio_data = np.concatenate(frames, axis=0)
        audio_data = (audio_data * 32767).astype(np.int16)
        stereo_data = np.column_stack((audio_data, audio_data))
        sf.write(str(file_path), stereo_data, self.audio_cfg.sample_rate, subtype="PCM_16")
        logger.info(f"Сырое аудио сохранено: {file_path}")
        return str(file_path)

    # Аудио процесиинг (нормализация и ресемплинг)
    def process_audio(self, input_file: str, turn_num: str) -> str:
        output_file = Path(self.session_cfg.clean_audio_dir) / f"input_{turn_num}_clean.wav"
        if output_file.exists():
            logger.info(f"Чистое аудио уже существует: {output_file}")
            return str(output_file)

        try:
            waveform, sr = torchaudio.load(input_file)
            if sr != self.audio_cfg.sample_rate:
                resampler = torchaudio.transforms.Resample(orig_freq=sr, new_freq=self.audio_cfg.sample_rate)
                waveform = resampler(waveform)

            max_val = waveform.abs().max()
            if max_val > 0:
                waveform = waveform / max_val * 0.99

            torchaudio.save(str(output_file), waveform, self.audio_cfg.sample_rate)
            logger.info(f"Чистое аудио сохранено: {output_file}")
            return str(output_file)
        except Exception as e:
            logger.error(f"Ошибка обработки аудио: {e}")
            return None

    # Транскрибирование
    def transcribe_audio(self, clean_audio_file: str) -> str:
        if clean_audio_file is None or not Path(clean_audio_file).exists():
            logger.error(f"Файл не найден: {clean_audio_file}")
            return ""
        
        try:
            result = self.model.transcribe(
                clean_audio_file,
                language=self.whisper_cfg.target_language,
                fp16=self.whisper_cfg.fp16
            )
            text = result.get("text", "").strip()
            logger.info(f"Транскрибирование завершено: {len(text)} символов")
            return text
        except Exception as e:
            logger.error(f"Ошибка при транскрибировании: {e}")
            return ""


# # from modeling import AudioToText
# # Запуск
# if __name__ == "__main__":
#     pipeline = AudioToText()
#     turn_num = "01"  # сессия
#     raw_path = pipeline.record_audio_raw(turn_num)
#     clean_path = pipeline.process_audio(raw_path, turn_num)
#     transcript = pipeline.transcribe_audio(clean_path)
