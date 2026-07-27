"""Local Ollama provider. Private: nothing leaves the host. Slower on a Pi, so
the service batches payees and caches results per unique payee."""
from __future__ import annotations

import json

import httpx

from .prompt import build_prompt, parse_response


class OllamaProvider:
    name = "ollama"

    def __init__(self, base_url: str, model: str, timeout: float = 60.0):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def available(self) -> bool:
        try:
            r = httpx.get(f"{self.base_url}/api/tags", timeout=3.0)
            return r.status_code == 200
        except Exception:
            return False

    def classify_batch(self, payees: list[str], categories: list[str]) -> list[str | None]:
        if not payees:
            return []
        prompt = build_prompt(payees, categories)
        try:
            r = httpx.post(
                f"{self.base_url}/api/generate",
                json={"model": self.model, "prompt": prompt, "stream": False,
                      "format": "json", "options": {"temperature": 0}},
                timeout=self.timeout,
            )
            r.raise_for_status()
            text = r.json().get("response", "")
            return parse_response(text, payees, categories)
        except Exception:
            return [None] * len(payees)
