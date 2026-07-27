"""Dragon state derivation. The dragon reflects finances:

  stage  (evolution)  <- cumulative savings + budget adherence
  mood   (animation)  <- most recent event / current-month health

Kept intentionally simple for the MVP; emergency-fund and investment milestones
plug in here later without touching the frontend contract.
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .budget_calc import category_lifebars, month_summary
from .models import DragonState, Transaction

# Cumulative net-saved thresholds (CHF) for each evolution stage.
STAGE_THRESHOLDS = [
    ("legendary", 30000),
    ("adult", 10000),
    ("young", 2000),
    ("baby", float("-inf")),
]


def _cumulative_net(db: Session) -> float:
    total = db.scalar(select(func.coalesce(func.sum(Transaction.amount), 0.0)))
    return round(float(total or 0.0), 2)


def _adherence(bars: list[dict]) -> float:
    """Share of budgeted categories currently within budget (0-100)."""
    budgeted = [b for b in bars if b["budget"] > 0]
    if not budgeted:
        return 100.0
    ok = sum(1 for b in budgeted if not b["over_budget"])
    return round(ok / len(budgeted) * 100, 1)


def compute_dragon(db: Session, event: str | None = None, today: date | None = None) -> dict:
    """Derive + persist dragon state. `event` biases mood (e.g. 'upload')."""
    today = today or date.today()
    bars = category_lifebars(db, today)
    summary = month_summary(db, today)
    net_total = _cumulative_net(db)
    adherence = _adherence(bars)

    # Stage: needs both savings AND decent adherence to advance past baby.
    stage = "baby"
    for name, threshold in STAGE_THRESHOLDS:
        if net_total >= threshold:
            stage = name
            break
    if adherence < 90 and stage in ("adult", "legendary"):
        stage = "young"  # overspending holds evolution back

    # Mood
    over_count = sum(1 for b in bars if b["over_budget"])
    last_txn = db.scalar(select(func.max(Transaction.date)))
    stale = last_txn is None or (today - last_txn) > timedelta(days=14)

    if event == "upload":
        mood = "excited"
    elif over_count > 0:
        mood = "angry"
    elif stale:
        mood = "sleepy"
    elif summary["net"] > 0:
        mood = "happy"
    else:
        mood = "idle"

    xp = max(0, int(net_total / 10) + int(adherence * 5))

    state = db.get(DragonState, 1) or DragonState(id=1)
    state.stage, state.mood, state.xp = stage, mood, xp
    db.add(state)
    db.commit()

    return {
        "stage": stage,
        "mood": mood,
        "xp": xp,
        "cumulative_net": net_total,
        "adherence": adherence,
        "over_budget_count": over_count,
    }
