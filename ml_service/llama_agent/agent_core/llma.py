from typing import Optional
from gpt4all import GPT4All
from config import LlamaGGUFConfig


class LlamaGGUFModel:
    """ОБЁРТКА НАД GPT4ALL"""

    def __init__(self, config: Optional[LlamaGGUFConfig] = None):
        self.config = config or LlamaGGUFConfig()

        self.model = GPT4All(
            model_name=self.config.model_name,
            model_path=self.config.model_path,
            n_ctx=self.config.context_size,
            verbose=self.config.verbose,
            allow_download=False,
            device=self.config.device,
        )

    def generate(self, prompt: str) -> str:
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
                streaming=self.config.streaming
            ).strip()
        return response
