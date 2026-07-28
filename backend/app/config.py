"""Runtime configuration, all overridable via environment variables (.env)."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Storage
    data_dir: Path = Path("./data")
    database_url: str = ""  # derived from data_dir if empty

    # Classification
    # Provider default is "rules": deterministic, zero external calls. Set to
    # "ollama" (local), "openai", "anthropic", or "mistral" (cloud) to enable AI.
    # These are the .env defaults; the Settings tab persists overrides in the DB.
    ai_provider: str = "rules"
    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "llama3.2"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5"
    mistral_api_key: str = ""
    mistral_model: str = "mistral-small-latest"
    # If AI is enabled but unreachable, fall back to rules instead of erroring.
    ai_graceful_fallback: bool = True

    # Server
    cors_origins: str = "*"  # comma-separated; "*" for self-hosted single-user

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        self.data_dir.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{(self.data_dir / 'budget.db').as_posix()}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
