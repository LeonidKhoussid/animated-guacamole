import os
import logging
from config import PathConfig, TTSConfig
from ml_service.audio_processing import AudioToText, TextToSpeech
from .llama_response import LlamaGGUFModel

logger = logging.getLogger(__name__)


class DialogManager:
    """МЕНЕДЖЕР ДИАЛОГА"""

    def __init__(self):
        self.paths = PathConfig()
        self.audio_pipeline = AudioToText()
        self.response_generator = LlamaGGUFModel()
        self.dialog_file = self.paths.dialog_history_file

        self.tts_config = TTSConfig()
        self.tts_model = TextToSpeech(self.tts_config)

        if not os.path.exists(self.dialog_file):
            with open(self.dialog_file, "w", encoding="utf-8") as f:
                f.write("")

    def get_next_turn_number(self) -> str:
        if not os.path.exists(self.dialog_file):
            return "01"
        with open(self.dialog_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
        turn_numbers = [int(line.split("_")[2].split(":")[0]) for line in lines if line.startswith("User_input_")]
        if turn_numbers:
            next_turn = max(turn_numbers) + 1
        else:
            next_turn = 1
        return f"{next_turn:02d}"

    def update_dialog_history(self, turn_num: str, user_text: str, assistant_text: str):
        with open(self.dialog_file, "a", encoding="utf-8") as f:
            f.write(f"User_input_{turn_num}: {user_text}\n")
            f.write(f"Assistant_output_{turn_num}: {assistant_text}\n\n")
        logger.info(f"История диалога обновлена: turn_{turn_num}")

    def run_pipeline(self):
        turn_num = self.get_next_turn_number()
        logger.info(f"Начало обработки turn_{turn_num}")
        
        raw_audio = self.audio_pipeline.record_audio_raw(turn_num)
        clean_audio = self.audio_pipeline.process_audio(raw_audio, turn_num)
        
        user_text = self.audio_pipeline.transcribe_audio(clean_audio)
        logger.info(f"Whisper распознал текст (User_input_{turn_num}): {user_text[:100]}...")
        
        if not user_text or not user_text.strip():
            logger.warning("Пустой текст от Whisper, пропуск генерации ответа")
            return
        
        assistant_text = self.response_generator.generate_response(user_text)
        logger.info(f"LLM сгенерировал ответ (Assistant_output_{turn_num}): {assistant_text[:100]}...")
        
        self.tts_model.synthesize(assistant_text)
        self.update_dialog_history(turn_num, user_text, assistant_text)
