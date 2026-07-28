"""The dragon's remark about the day's spending — a funny/insulting one-liner.

To keep LLM cost down, a small BATCH of quips is generated at most once per day
(and once after each import) and cached in the settings table. Normal loads and
"poke" just rotate through the cached batch — no LLM call.
"""
from __future__ import annotations

import json
import random
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..budget_calc import category_lifebars
from ..classify.service import build_provider
from ..db import get_db
from ..models import Setting, Transaction

router = APIRouter(prefix="/api/dragon", tags=["dragon"])

CACHE_KEY = "quip_cache"
BATCH_SIZE = 5


# --- day summary --------------------------------------------------------
def _day_summary(db: Session) -> dict:
    latest = db.scalar(select(func.max(Transaction.date)).where(Transaction.is_split.is_(False)))
    if latest is None:
        return {"date": None, "spend": 0.0, "count": 0, "biggest": None, "over_budget": []}
    txns = db.scalars(
        select(Transaction).options(joinedload(Transaction.category))
        .where(Transaction.date == latest, Transaction.amount < 0, Transaction.is_split.is_(False))
    ).all()
    spend = round(sum(-t.amount for t in txns), 2)
    biggest = None
    if txns:
        b = max(txns, key=lambda t: -t.amount)
        biggest = {"payee": b.payee, "amount": round(-b.amount, 2), "category": b.category.name if b.category else None}
    over = [b["name"] for b in category_lifebars(db) if b["over_budget"]]
    return {"date": latest.isoformat(), "spend": spend, "count": len(txns), "biggest": biggest, "over_budget": over}


# --- generation ---------------------------------------------------------
def _batch_prompt(s: dict, n: int) -> str:
    big = s["biggest"]
    big_str = f"{big['payee']} for CHF {big['amount']} ({big['category']})" if big else "nothing"
    over_str = ", ".join(s["over_budget"]) if s["over_budget"] else "none"
    return (
        "You are a sassy, dramatic pet dragon that hoards your owner's money like "
        f"treasure and judges every purchase. Write {n} DIFFERENT one-liners "
        "roasting today's spending — each funny, mildly insulting but affectionate, "
        "max 22 words, Swiss francs (CHF), no emoji, no quotes, no numbering. Put "
        "each remark on its own line.\n\n"
        f"Today's date: {s['date']}\n"
        f"Total spent today: CHF {s['spend']} across {s['count']} purchases\n"
        f"Biggest purchase: {big_str}\n"
        f"Categories over budget this month: {over_str}\n\n"
        "Remarks:"
    )


def _parse_lines(text: str, n: int) -> list[str]:
    lines = []
    for raw in text.splitlines():
        line = raw.strip().lstrip("0123456789.-)• ").strip().strip('"').strip()
        if len(line) >= 8:
            lines.append(line[:220])
    # de-dup preserving order
    seen, out = set(), []
    for line in lines:
        if line.lower() not in seen:
            seen.add(line.lower())
            out.append(line)
    return out[:n]


def _fallback_batch(s: dict, n: int) -> list[str]:
    pool: list[str] = []
    if s["date"] is None:
        return ["No transactions yet? My hoard is as empty as your ambition. Feed me data, mortal."]
    big = s["biggest"]
    if s["spend"] == 0:
        pool += [
            "Not a single franc spent today? Either you're broke or finally learning. I approve.",
            "Zero spending today. Boring, but my treasure sleeps soundly.",
        ]
    if s["over_budget"]:
        pool.append(f"{s['over_budget'][0]} is over budget AGAIN. Even a newborn lizard counts better than you.")
    if big and big["amount"] >= 100:
        pool.append(f"CHF {big['amount']:.0f} at {big['payee']}? My hoard just shed a single, expensive tear.")
    if 0 < s["spend"] < 20:
        pool.append(f"A mighty CHF {s['spend']:.0f} today. Thrilling. Wake me when you do something reckless.")
    pool += [
        f"CHF {s['spend']:.0f} across {s['count']} purchases. I'm watching. Always watching.",
        f"CHF {s['spend']:.0f} today. Acceptable. My scales remain unruffled, for now.",
        f"{s['count']} purchases today? Each one a tiny betrayal of my glorious hoard.",
    ]
    # unique, keep order, take n
    seen, out = set(), []
    for p in pool:
        if p not in seen:
            seen.add(p); out.append(p)
    return out[:n] or ["My hoard endures. Barely."]


def _generate_batch(db: Session, s: dict) -> dict:
    provider = build_provider(db)
    quips: list[str] = []
    source = "fallback"
    if provider is not None and provider.available():
        text = provider.generate(_batch_prompt(s, BATCH_SIZE), max_tokens=400)
        if text:
            quips = _parse_lines(text, BATCH_SIZE)
            if len(quips) >= 2:
                source = "ai"
    if len(quips) < 2:
        quips = _fallback_batch(s, BATCH_SIZE)
        source = "fallback"
    return {"date": date.today().isoformat(), "quips": quips, "idx": 0, "source": source}


# --- cache in settings --------------------------------------------------
def _load_cache(db: Session) -> dict | None:
    row = db.get(Setting, CACHE_KEY)
    if not row:
        return None
    try:
        return json.loads(row.value)
    except (json.JSONDecodeError, TypeError):
        return None


def _save_cache(db: Session, cache: dict) -> None:
    row = db.get(Setting, CACHE_KEY)
    if row:
        row.value = json.dumps(cache, ensure_ascii=False)
    else:
        db.add(Setting(key=CACHE_KEY, value=json.dumps(cache, ensure_ascii=False)))
    db.commit()


def invalidate_cache(db: Session) -> None:
    """Called after an import so the next quip reflects fresh data."""
    row = db.get(Setting, CACHE_KEY)
    if row:
        db.delete(row)
        db.commit()


@router.get("/quip")
def quip(db: Session = Depends(get_db)):
    cache = _load_cache(db)
    today = date.today().isoformat()

    if cache and cache.get("date") == today and cache.get("quips"):
        # Rotate to the next cached line — no LLM call.
        cache["idx"] = (int(cache.get("idx", 0)) + 1) % len(cache["quips"])
        _save_cache(db, cache)
        return {"quip": cache["quips"][cache["idx"]], "source": cache.get("source", "fallback"), "cached": True}

    # Stale or empty -> regenerate the daily batch (the one paid call).
    s = _day_summary(db)
    cache = _generate_batch(db, s)
    _save_cache(db, cache)
    return {"quip": cache["quips"][0], "source": cache["source"], "cached": False}
