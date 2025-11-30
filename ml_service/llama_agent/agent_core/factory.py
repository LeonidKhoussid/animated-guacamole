from typing import Optional
from config import LlamaGGUFConfig
from .llma import LlamaGGUFModel
from langchain.llms import GPT4All as LangChainGPT4All


class LangChainAgentFactory:
    """LANGCHAIN АГЕНТ НА ЛОКАЛЬНОЙ META"""

    def __init__(self, config: Optional[LlamaGGUFConfig] = None):
        self.config = config or LlamaGGUFConfig()
        self.model_wrapper = LlamaGGUFModel(self.config)

    def build_agent(self):
        langchain_llm = LangChainGPT4All(
            model=self.config.model_name,
            model_path=self.config.model_path,
            verbose=self.config.verbose,
            allow_download=False)
        return langchain_llm
