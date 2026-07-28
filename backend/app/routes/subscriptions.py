"""Detect recurring payments (subscriptions) from transaction history.

Heuristic: group expenses by a normalized payee, then flag groups that recur on
a regular cadence with a stable amount. No config — surfaces candidates the user
can eyeball. Runs on demand; cheap enough for 100k rows on a Pi.
"""
from __future__ import annotations

import re
import statistics
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import Transaction

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

# median-interval (days) -> cadence label
CADENCES = [
    (6, 8, "weekly", 7),
    (12, 16, "biweekly", 14),
    (26, 35, "monthly", 30),
    (58, 64, "bimonthly", 61),
    (85, 97, "quarterly", 91),
    (175, 190, "semi-annual", 182),
    (350, 380, "yearly", 365),
]

_MASK = re.compile(r"[•*]{2,}\s*\d+|\b\d[\d'.,/-]{2,}\b|\bcard\b", re.IGNORECASE)


def normalize(payee: str) -> str:
    s = _MASK.sub(" ", payee or "")
    s = re.sub(r"[^a-zA-ZÀ-ÿ ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def _cadence(median_days: float):
    for lo, hi, label, period in CADENCES:
        if lo <= median_days <= hi:
            return label, period
    return None, None


@router.get("")
def detect(db: Session = Depends(get_db)):
    txns = db.scalars(
        select(Transaction).options(joinedload(Transaction.category))
        .where(Transaction.amount < 0, Transaction.is_split.is_(False))
    ).all()

    groups: dict[str, list[Transaction]] = {}
    for t in txns:
        key = normalize(t.payee)
        if len(key) < 3:
            continue
        groups.setdefault(key, []).append(t)

    subs = []
    for key, items in groups.items():
        if len(items) < 3:
            continue
        items.sort(key=lambda t: t.date)
        # Intervals between consecutive charges.
        dates = [t.date for t in items]
        intervals = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
        intervals = [d for d in intervals if d > 0]
        if len(intervals) < 2:
            continue
        median = statistics.median(intervals)
        label, period = _cadence(median)
        if not label:
            continue
        amounts = [abs(t.amount) for t in items]
        avg = statistics.mean(amounts)
        # Stable amount = low spread relative to mean (or tiny absolute spread).
        spread = statistics.pstdev(amounts)
        if avg > 0 and spread / avg > 0.35 and spread > 5:
            continue
        last = dates[-1]
        # Most common category among the group's transactions.
        cats = [t.category.name for t in items if t.category]
        category = max(set(cats), key=cats.count) if cats else None
        subs.append({
            "payee": items[-1].payee,
            "normalized": key,
            "cadence": label,
            "count": len(items),
            "avg_amount": round(avg, 2),
            "last_date": last.isoformat(),
            "next_estimate": (last + timedelta(days=period)).isoformat(),
            "monthly_equiv": round(avg * 30 / period, 2),
            "category": category,
        })

    subs.sort(key=lambda s: -s["monthly_equiv"])
    total_monthly = round(sum(s["monthly_equiv"] for s in subs), 2)
    return {"subscriptions": subs, "total_monthly_equiv": total_monthly, "count": len(subs)}
