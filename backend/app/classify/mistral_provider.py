"""Mistral provider. OpenAI-compatible chat completions endpoint."""
from __future__ import annotations

import httpx

from .prompt import build_prompt, parse_response

API_URL = "https://api.mistral.ai/v1/chat/completions"


class MistralProvider:
    name = "mistral"

    def __init__(self, api_key: str, model: str, timeout: float = 30.0):
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def available(self) -> bool:
        return bool(self.api_key)

    def _chat(self, prompt: str, temperature: float, max_tokens: int) -> str | None:
        r = httpx.post(
            API_URL,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"model": self.model, "temperature": temperature, "max_tokens": max_tokens,
                  "messages": [{"role": "user", "content": prompt}]},
            timeout=self.timeout,
        )
        r.raise_for_status()
        return (r.json()["choices"][0]["message"]["content"] or "").strip() or None

    def classify_batch(self, payees: list[str], categories: list[str]) -> list[str | None]:
        if not payees:
            return []
        try:
            return parse_response(self._chat(build_prompt(payees, categories), 0, 1024) or "", payees, categories)
        except Exception:
            return [None] * len(payees)

    def generate(self, prompt: str, temperature: float = 0.9) -> str | None:
        try:
            return self._chat(prompt, temperature, 200)
        except Exception:
            return None
