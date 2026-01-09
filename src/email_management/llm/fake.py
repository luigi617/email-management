from dataclasses import dataclass
from typing import Type
from pydantic import BaseModel

@dataclass
class FakeResult:
    content: str

class FakeLLM:
    def __init__(self, response: str):
        self.response = response

    def invoke(self, arguments: dict, *, config: dict) -> str:
        return FakeResult(self.response)


def get_fake(
    model_name: str,
    pydantic_model: Type[BaseModel],
    temperature: float = 0.1,
    timeout: int = 120,
):
   
    return FakeLLM("this is the response")