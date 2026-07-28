"""Anthropic (Claude) provider. Raw HTTP to keep the provider layer uniform with
the Ollama/OpenAI providers (no extra SDK dependency on the Pi). Wire format per
the Anthropic Messages API: x-api-key + anthropic-version headers."""
from __future__ import annotations

import httpx

from .prompt import build_prompt, parse_response

API_URL = "https://api.anthropic.com/v1/messages"
VERSION = "2023-06-01"


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, api_key: str, model: str, timeout: float = 30.0):
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def available(self) -> bool:
        return bool(self.api_key)

    def _headers(self) -> dict:
        return {"x-api-key": self.api_key, "anthropic-version": VERSION, "content-type": "application/json"}

    def _message(self, prompt: str, max_tokens: int, temperature: float) -> str | None:
        r = httpx.post(
            API_URL,
            headers=self._headers(),
            json={"model": self.model, "max_tokens": max_tokens, "temperature": temperature,
                  "messages": [{"role": "user", "content": prompt}]},
            timeout=self.timeout,
        )
        r.raise_for_status()
        blocks = r.json().get("content", [])
        text = next((b.get("text", "") for b in blocks if b.get("type") == "text"), "")
        return text.strip() or None

    def classify_batch(self, payees: list[str], categories: list[str]) -> list[str | None]:
        if not payees:
            return []
        try:
            text = self._message(build_prompt(payees, categories), max_tokens=1024, temperature=0)
            return parse_response(text or "", payees, categories)
        except Exception:
            return [None] * len(payees)

    def generate(self, prompt: str, temperature: float = 0.9) -> str | None:
        try:
            return self._message(prompt, max_tokens=200, temperature=temperature)
        except Exception:
            return None
