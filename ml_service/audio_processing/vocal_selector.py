import librosa
import numpy as np
import soundfile as sf
import onnxruntime as ort
from config import UVRConfig, AudioConfig


class UVRSeparator:
    """МОДЕЛЬ MDX-NET ДЛЯ СЕГМЕНТАЦИИ ГОЛОСА"""

    def __init__(self):
        self.cfg = UVRConfig()
        self.audio_cfg = AudioConfig()

        self.providers = ["CUDAExecutionProvider"] if ort.get_device() == "GPU" else ["CPUExecutionProvider"]
        self.session = ort.InferenceSession(self.cfg.model_path, providers=self.providers)

        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name

    # Подготовка спектрограммы с учетом паддинга и обрезки
    @staticmethod
    def _prepare_input(mag, target_time_size=256, target_freq_size=1024):
        h, w = mag.shape

        if h > target_freq_size:
            mag = mag[:target_freq_size, :]
        elif h < target_freq_size:
            mag = np.pad(mag, ((0, target_freq_size - h), (0, 0)), mode="constant")

        if w < target_time_size:
            mag = np.pad(mag, ((0, 0), (0, target_time_size - w)), mode="constant")

        segments = []
        for i in range(0, mag.shape[1] - target_time_size + 1, target_time_size):
            seg = mag[:, i:i + target_time_size]
            if seg.shape[1] != target_time_size:
                continue
            segments.append(np.stack([seg] * 4))

        return np.stack(segments).astype(np.float32)

    # Восстановление сигнала из модуля спектра
    @staticmethod
    def _istft_from_mag_phase(mag, phase):
        complex_stft = mag * np.exp(1j * phase)
        return librosa.istft(complex_stft, hop_length=512)

    # Извлечение голоса
    def separate_vocals(self, input_audio_path: str, output_path: str) -> str:
        waveform, sr = librosa.load(input_audio_path, sr=self.audio_cfg.sample_rate, mono=True)
        stft_complex = librosa.stft(waveform, n_fft=1024, hop_length=512)
        mag = np.abs(stft_complex)
        phase = np.angle(stft_complex)

        prepared = self._prepare_input(mag)

        output_chunks = []
        for chunk in prepared:
            chunk = chunk[np.newaxis, ...]  # например [1, 4, F, T]
            pred = self.session.run([self.output_name], {self.input_name: chunk})[0]
            output_chunks.append(pred[0, 0])

        pred_mag = np.concatenate(output_chunks, axis=1)
        separated_audio = self._istft_from_mag_phase(pred_mag, phase[:, :pred_mag.shape[1]])

        max_val = np.max(np.abs(separated_audio))
        if max_val > 0:
            separated_audio = separated_audio / max_val * 0.99

        sf.write(output_path, separated_audio, sr)
        return output_path


# from vocal_selector import UVRSeparator
# # Запуск
# if __name__ == "__main__":
#     uvr = UVRSeparator()
#     input_audio = "my_raw_audio"
#     output_audio = "my_clean_audio"
#     result_path = uvr.separate_vocals(input_audio, output_audio)
