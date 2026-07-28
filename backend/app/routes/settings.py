"""AI provider settings — configure OpenAI / Anthropic (Claude) / Mistral /
Ollama from the UI instead of only via .env. Secrets are write-only: the API
reports whether a key is set (and a masked hint), never the cleartext."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..ai_settings import SECRET_FIELDS, get_ai_config, set_ai_config
from ..classify.service import build_provider
from ..db import get_db

router = APIRouter(prefix="/api/settings", tags=["settings"])

PROVIDERS = ["rules", "ollama", "openai", "anthropic", "mistral"]


def _mask(value: str) -> str:
    if not value:
        return ""
    return f"…{value[-4:]}" if len(value) > 4 else "••••"


def _public(cfg: dict) -> dict:
    """Replace secret values with a set/masked view."""
    out = {}
    for field, value in cfg.items():
        if field in SECRET_FIELDS:
            out[field + "_set"] = bool(value)
            out[field + "_hint"] = _mask(value)
        else:
            out[field] = value
    return out


class SettingsPatch(BaseModel):
    provider: str | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    openai_api_key: str | None = None
    openai_model: str | None = None
    anthropic_api_key: str | None = None
    anthropic_model: str | None = None
    mistral_api_key: str | None = None
    mistral_model: str | None = None


@router.get("")
def get_settings_endpoint(db: Session = Depends(get_db)):
    return {"providers": PROVIDERS, **_public(get_ai_config(db))}


@router.put("")
def update_settings(patch: SettingsPatch, db: Session = Depends(get_db)):
    data = patch.model_dump(exclude_none=True)
    # Empty-string secret fields are intentional "clear"; keep them.
    set_ai_config(db, data)
    return {"providers": PROVIDERS, **_public(get_ai_config(db))}


@router.post("/test")
def test_provider(db: Session = Depends(get_db)):
    """Check the currently-configured provider is reachable and can generate."""
    provider = build_provider(db)
    if provider is None:
        return {"ok": True, "provider": "rules", "detail": "Deterministic rules — no AI provider."}
    if not provider.available():
        return {"ok": False, "provider": provider.name, "detail": "Provider not reachable / missing API key."}
    text = provider.generate("Reply with the single word: pong.", temperature=0)
    return {"ok": bool(text), "provider": provider.name,
            "detail": (text or "No response — model may be missing or unauthorized.")[:200]}
