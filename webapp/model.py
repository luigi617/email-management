import os
from dataclasses import dataclass
from typing import Tuple

from dotenv import load_dotenv

load_dotenv(override=True)


@dataclass(frozen=True)
class ProviderModels:
    slow: str
    medium: str
    fast: str


EMAIL_PROVIDER_PRIORITY = [
    "claude",
    "openai",
    "gemini",
    "xai",
    "groq",
]

PROVIDER_API_KEY_ENV = {
    "claude": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "xai": "XAI_API_KEY",
    "groq": "GROQ_API_KEY",
}

EMAIL_MODELS_BY_PROVIDER = {
    "claude": ProviderModels(
        slow="claude-opus-4.5",
        medium="claude-sonnet-4.5",
        fast="claude-haiku-3.5",
    ),
    "openai": ProviderModels(
        slow="gpt-5.2",
        medium="gpt-4o",
        fast="gpt-5-mini",
    ),
    "gemini": ProviderModels(
        slow="gemini-3-flash-preview",
        medium="gemini-2.5-flash",
        fast="gemini-2.5-flash-lite",
    ),
    "xai": ProviderModels(
        slow="grok-4",
        medium="grok-3",
        fast="grok-4-1-fast-reasoning",
    ),
    "groq": ProviderModels(
        slow="openai/gpt-oss-120b",
        medium="qwen/qwen3-32b",
        fast="llama-3.1-8b-instant",
    ),
}


def select_email_provider_and_models() -> Tuple[str, ProviderModels]:
    for provider in EMAIL_PROVIDER_PRIORITY:
        env_key = PROVIDER_API_KEY_ENV[provider]
        api_key = os.getenv(env_key)

        if api_key and api_key.strip():
            return provider, EMAIL_MODELS_BY_PROVIDER[provider]

    return None, {}
