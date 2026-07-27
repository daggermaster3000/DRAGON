"""OpenAI provider. Cloud: payee names leave the host, so it is opt-in only
(AI_PROVIDER=openai) and never the default."""
from __future__ import annotations

import httpx

from .prompt import build_prompt, parse_response


class OpenAIProvider:
    name = "openai"

    def __init__(self, api_key: str, model: str, timeout: float = 30.0):
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def available(self) -> bool:
        return bool(self.api_key)

    def classify_batch(self, payees: list[str], categories: list[str]) -> list[str | None]:
        if not payees:
            return []
        prompt = build_prompt(payees, categories)
        try:
            r = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=self.timeout,
            )
            r.raise_for_status()
            text = r.json()["choices"][0]["message"]["content"]
            return parse_response(text, payees, categories)
        except Exception:
            return [None] * len(payees)
