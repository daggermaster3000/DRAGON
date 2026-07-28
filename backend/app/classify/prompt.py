"""Shared prompt + response parsing for LLM providers. JSON-in/JSON-out so both
Ollama and OpenAI use identical logic."""
from __future__ import annotations

import json


def build_prompt(payees: list[str], categories: list[str]) -> str:
    cats = "\n".join(f"- {c}" for c in categories)
    items = "\n".join(f'{i}: "{p}"' for i, p in enumerate(payees))
    return (
        "You classify Swiss bank transactions into budget categories.\n"
        "Allowed categories (use the exact string, nothing else):\n"
        f"{cats}\n\n"
        "Each item below is a merchant/description (payee plus any payment "
        "details the bank attached). Pick the single best category for each. If "
        'truly unsure, use "Other".\n\n'
        f"Transactions:\n{items}\n\n"
        'Respond ONLY with a JSON object mapping the index (as string) to the '
        'category name, e.g. {"0": "Groceries", "1": "Mobility"}.'
    )


def parse_response(text: str, payees: list[str], categories: list[str]) -> list[str | None]:
    valid = set(categories)
    out: list[str | None] = [None] * len(payees)
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return out
    if not isinstance(data, dict):
        return out
    for k, v in data.items():
        try:
            idx = int(k)
        except (ValueError, TypeError):
            continue
        if 0 <= idx < len(payees) and isinstance(v, str) and v in valid:
            out[idx] = v
    return out
