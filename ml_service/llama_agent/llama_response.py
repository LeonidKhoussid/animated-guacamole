import os
from typing import Optional
from gpt4all import GPT4All
from config import LlamaGGUFConfig, PathConfig
from .prompt_engineer import PromptRouting


class LlamaGGUFModel:
    """LLAMA GGUF МОДЕЛЬ"""

    def __init__(self, config: Optional[LlamaGGUFConfig] = None):
        self.config = config or LlamaGGUFConfig()
        self.paths = PathConfig()
        self.dialog_file = self.paths.dialog_history_file

        self.model = GPT4All(
            model_name=self.config.model_name,
            model_path=self.config.model_path,
            n_ctx=self.config.context_size,
            verbose=self.config.verbose,
            allow_download=False,
            device=self.config.device,
        )

        self.prompt_engineer = PromptRouting()

    def _load_dialog_history(self) -> list:
        if not os.path.exists(self.dialog_file):
            return []

        history = []
        with open(self.dialog_file, "r", encoding="utf-8") as f:
            lines = f.readlines()

        user_input, assistant_output = None, None
        for line in lines:
            if line.startswith("User_input_"):
                user_input = line.split(":", 1)[1].strip()
            elif line.startswith("Assistant_output_"):
                assistant_output = line.split(":", 1)[1].strip()
                if user_input is not None:
                    history.append((user_input, assistant_output))
                    user_input, assistant_output = None, None
        return history

    def generate_response(self, current_input: str) -> str:
        history = self._load_dialog_history()
        prompt = self.prompt_engineer.build_prompt(user_input=current_input, history=history)

        with self.model.chat_session():
            response = self.model.generate(
                prompt=prompt,
                max_tokens=self.config.max_tokens,
                temp=self.config.temp,
                top_k=self.config.top_k,
                top_p=self.config.top_p,
                min_p=self.config.min_p,
                repeat_penalty=self.config.repeat_penalty,
                repeat_last_n=self.config.repeat_last_n,
                n_batch=self.config.n_batch,
                n_predict=self.config.n_predict,
                streaming=self.config.streaming,
            ).strip()

        return response
