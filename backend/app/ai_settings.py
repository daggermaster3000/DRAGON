"""AI provider configuration resolved at runtime.

Defaults come from the environment (.env via config.py); the Settings tab
persists overrides in the `settings` table (keys prefixed `ai.`). Secrets are
stored as-is and never returned to the client in cleartext.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Setting

PREFIX = "ai."

# field -> (env default attribute on Settings, is_secret)
FIELDS = {
    "provider": ("ai_provider", False),
    "ollama_base_url": ("ollama_base_url", False),
    "ollama_model": ("ollama_model", False),
    "openai_api_key": ("openai_api_key", True),
    "openai_model": ("openai_model", False),
    "anthropic_api_key": ("anthropic_api_key", True),
    "anthropic_model": ("anthropic_model", False),
    "mistral_api_key": ("mistral_api_key", True),
    "mistral_model": ("mistral_model", False),
}
SECRET_FIELDS = {k for k, (_, secret) in FIELDS.items() if secret}


def get_ai_config(db: Session) -> dict:
    """Effective config = env defaults overlaid with DB overrides."""
    s = get_settings()
    cfg = {field: getattr(s, attr) for field, (attr, _) in FIELDS.items()}
    rows = db.scalars(select(Setting).where(Setting.key.like(f"{PREFIX}%"))).all()
    for row in rows:
        field = row.key[len(PREFIX):]
        if field in FIELDS and row.value != "":
            cfg[field] = row.value
    return cfg


def set_ai_config(db: Session, patch: dict) -> None:
    """Persist provided fields. Empty string clears a stored override (reverts to
    the env default). Unknown fields are ignored."""
    existing = {r.key: r for r in db.scalars(select(Setting).where(Setting.key.like(f"{PREFIX}%"))).all()}
    for field, value in patch.items():
        if field not in FIELDS or value is None:
            continue
        key = PREFIX + field
        val = str(value)
        if val == "":
            if key in existing:
                db.delete(existing[key])
        elif key in existing:
            existing[key].value = val
        else:
            db.add(Setting(key=key, value=val))
    db.commit()
