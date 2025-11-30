import os
from config import LlamaGGUFConfig
from .factory import LangChainAgentFactory


class RealEstateAgentApp:
    """ОРГАНИЗАЦИЯ ЗАПУСКА АГЕНТОВ"""

    def __init__(self, input_file: str, output_file: str):
        self.input_file = input_file
        self.output_file = output_file
        self.config = LlamaGGUFConfig()
        self.agent = None

    def read_query(self) -> str:
        if not os.path.exists(self.input_file):
            raise FileNotFoundError(f"Файл не найден: {self.input_file}")
        with open(self.input_file, "r", encoding="utf-8") as f:
            query = f.read().strip()
        return query

    def write_response(self, response: str):
        os.makedirs(os.path.dirname(self.output_file), exist_ok=True)
        with open(self.output_file, "w", encoding="utf-8") as f:
            f.write(response)

    def display_model_info(self):
        device = getattr(self.agent, "device", None) or getattr(self.agent, "_device", None)
        print("Информация:")
        print(f"Тип: {type(self.agent).__name__}")
        print(f"Устройство: {device}")

    def run(self):
        user_query = self.read_query()
        if not user_query:
            return

        factory = LangChainAgentFactory(self.config)
        self.agent = factory.build_agent()

        self.display_model_info()

        response = self.agent(user_query)
        self.write_response(response)
