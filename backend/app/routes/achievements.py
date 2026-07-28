"""Achievements: computed from transaction data each call. Newly-met ones are
persisted (with unlock timestamp) so the UI can celebrate first unlocks."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..budget_calc import category_lifebars, month_bounds
from ..db import get_db
from ..models import Achievement, Category, ImportBatch, Transaction

router = APIRouter(prefix="/api/achievements", tags=["achievements"])


# Static catalogue. `progress` (0..1) is filled by the evaluator below.
CATALOGUE = [
    {"key": "first_import", "icon": "📥", "title": "First Steps", "desc": "Import your first statement"},
    {"key": "positive_month", "icon": "📈", "title": "In the Green", "desc": "Positive net this month"},
    {"key": "saved_1000", "icon": "💰", "title": "Nest Egg", "desc": "Save CHF 1,000 net"},
    {"key": "saved_10000", "icon": "💎", "title": "Treasure Hoard", "desc": "Save CHF 10,000 net"},
    {"key": "flawless_month", "icon": "🎯", "title": "Flawless Month", "desc": "A full month with no category over budget"},
    {"key": "streak_3", "icon": "🔥", "title": "On a Roll", "desc": "3 months in a row of positive net"},
    {"key": "streak_6", "icon": "☄️", "title": "Unstoppable", "desc": "6 months in a row of positive net"},
    {"key": "emergency_fund", "icon": "🛡️", "title": "Emergency Fund", "desc": "Save 3× your monthly expense budget"},
]


def _monthly_nets(db: Session) -> list[tuple[str, float]]:
    txns = db.scalars(select(Transaction).where(Transaction.is_split.is_(False))).all()
    buckets: dict[str, float] = {}
    for t in txns:
        key = f"{t.date.year:04d}-{t.date.month:02d}"
        buckets[key] = buckets.get(key, 0.0) + t.amount
    return sorted(buckets.items())


def _longest_positive_streak(nets: list[tuple[str, float]]) -> int:
    best = cur = 0
    for _, net in nets:
        cur = cur + 1 if net > 0 else 0
        best = max(best, cur)
    return best


def evaluate(db: Session) -> list[dict]:
    cumulative = round(float(db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0.0)).where(Transaction.is_split.is_(False))
    ) or 0.0), 2)
    has_import = db.scalar(select(ImportBatch.id).limit(1)) is not None
    expense_budget = float(db.scalar(
        select(func.coalesce(func.sum(Category.monthly_budget), 0.0)).where(Category.kind == "expense")
    ) or 0.0)

    nets = _monthly_nets(db)
    today = date.today()
    cur_key = f"{today.year:04d}-{today.month:02d}"
    this_month_net = dict(nets).get(cur_key, 0.0)
    streak = _longest_positive_streak(nets)

    # Flawless month: any completed month with zero categories over budget.
    start, _ = month_bounds(today)
    flawless = False
    for key, _net in nets:
        y, m = int(key[:4]), int(key[5:])
        if date(y, m, 1) >= start:
            continue  # skip the in-progress current month
        bars = category_lifebars(db, date(y, m, 1))
        if bars and not any(b["over_budget"] for b in bars):
            flawless = True
            break

    ef_target = expense_budget * 3
    checks = {
        "first_import": (has_import, 1.0 if has_import else 0.0),
        "positive_month": (this_month_net > 0, 1.0 if this_month_net > 0 else 0.0),
        "saved_1000": (cumulative >= 1000, min(1.0, cumulative / 1000) if cumulative > 0 else 0.0),
        "saved_10000": (cumulative >= 10000, min(1.0, cumulative / 10000) if cumulative > 0 else 0.0),
        "flawless_month": (flawless, 1.0 if flawless else 0.0),
        "streak_3": (streak >= 3, min(1.0, streak / 3)),
        "streak_6": (streak >= 6, min(1.0, streak / 6)),
        "emergency_fund": (ef_target > 0 and cumulative >= ef_target, min(1.0, cumulative / ef_target) if ef_target > 0 else 0.0),
    }
    return [{"key": k, "met": met, "progress": round(prog, 2)} for k, (met, prog) in checks.items()]


@router.get("")
def list_achievements(db: Session = Depends(get_db)):
    results = {r["key"]: r for r in evaluate(db)}
    stored = {a.key: a for a in db.scalars(select(Achievement)).all()}

    newly = []
    for key, r in results.items():
        if r["met"] and key not in stored:
            db.add(Achievement(key=key))
            newly.append(key)
    if newly:
        db.commit()
        stored = {a.key: a for a in db.scalars(select(Achievement)).all()}

    out = []
    for item in CATALOGUE:
        r = results.get(item["key"], {"met": False, "progress": 0.0})
        a = stored.get(item["key"])
        out.append({
            **item,
            "unlocked": r["met"],
            "progress": r["progress"],
            "unlocked_at": a.unlocked_at.isoformat() if a else None,
            "is_new": item["key"] in newly,
        })
    unlocked_count = sum(1 for o in out if o["unlocked"])
    return {"achievements": out, "unlocked": unlocked_count, "total": len(out), "newly_unlocked": newly}
