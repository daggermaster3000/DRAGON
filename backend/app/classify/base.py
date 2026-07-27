"""AI provider abstraction. Providers only need to classify a batch of payees
into one of the allowed budget categories. Everything deterministic (rules,
bank map) is handled by the service before AI is ever consulted."""
from __future__ import annotations

from typing import Protocol


class AIProvider(Protocol):
    name: str

    def available(self) -> bool:
        """Cheap reachability check; service uses it to decide fallback."""
        ...

    def classify_batch(self, payees: list[str], categories: list[str]) -> list[str | None]:
        """Return one category name per payee (or None if unsure).
        Length must match `payees`. Must not raise on individual failures."""
        ...
