"""Aggregation endpoints for charts and the calendar view. All read-only."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..budget_calc import month_bounds, period_bounds
from ..db import get_db
from ..models import Category, Transaction

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _period_key(d: date, timeframe: str) -> str:
    if timeframe == "annual":
        return f"{d.year}"
    if timeframe == "quarterly":
        return f"{d.year}-Q{(d.month - 1) // 3 + 1}"
    return f"{d.year:04d}-{d.month:02d}"


@router.get("/series")
def series(timeframe: str = Query("monthly"), periods: int = Query(12, ge=1, le=60),
           db: Session = Depends(get_db)):
    """Income/expense/net grouped by period, with a pace projection on the
    current (in-progress) period."""
    if timeframe not in ("monthly", "quarterly", "annual"):
        timeframe = "monthly"
    txns = db.scalars(select(Transaction).where(Transaction.is_split.is_(False))).all()
    buckets: dict[str, dict] = {}
    for t in txns:
        key = _period_key(t.date, timeframe)
        b = buckets.setdefault(key, {"period": key, "income": 0.0, "expense": 0.0})
        if t.amount >= 0:
            b["income"] += t.amount
        else:
            b["expense"] += -t.amount

    start, _nxt, _factor, fraction, _label = period_bounds(timeframe)
    current_key = _period_key(start, timeframe)

    out = sorted(buckets.values(), key=lambda x: x["period"])[-periods:]
    for b in out:
        b["income"] = round(b["income"], 2)
        b["expense"] = round(b["expense"], 2)
        b["net"] = round(b["income"] - b["expense"], 2)
        b["is_current"] = b["period"] == current_key
        if b["is_current"] and fraction > 0:
            b["projected_expense"] = round(b["expense"] / fraction, 2)
            b["projected_income"] = round(b["income"] / fraction, 2)
            b["projected_net"] = round(b["net"] / fraction, 2)
    return {"series": out, "timeframe": timeframe}


@router.get("/daily")
def daily(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
):
    """Per-day income/expense/net/count for one month — powers the calendar."""
    start = date(year, month, 1)
    _, nxt = month_bounds(start)
    txns = db.scalars(
        select(Transaction).where(Transaction.date >= start, Transaction.date < nxt,
                                  Transaction.is_split.is_(False))
    ).all()
    by_day: dict[str, dict] = {}
    for t in txns:
        key = t.date.isoformat()
        d = by_day.setdefault(key, {"date": key, "income": 0.0, "expense": 0.0, "count": 0})
        if t.amount >= 0:
            d["income"] += t.amount
        else:
            d["expense"] += -t.amount
        d["count"] += 1
    days = []
    for d in by_day.values():
        d["income"] = round(d["income"], 2)
        d["expense"] = round(d["expense"], 2)
        d["net"] = round(d["income"] - d["expense"], 2)
        days.append(d)
    days.sort(key=lambda x: x["date"])
    return {"year": year, "month": month, "days": days}


@router.get("/monthly")
def monthly(months: int = Query(12, ge=1, le=60), db: Session = Depends(get_db)):
    """Income/expense/net per calendar month, most recent `months`."""
    txns = db.scalars(select(Transaction).where(Transaction.is_split.is_(False))).all()
    buckets: dict[str, dict] = {}
    for t in txns:
        key = f"{t.date.year:04d}-{t.date.month:02d}"
        b = buckets.setdefault(key, {"month": key, "income": 0.0, "expense": 0.0})
        if t.amount >= 0:
            b["income"] += t.amount
        else:
            b["expense"] += -t.amount
    series = sorted(buckets.values(), key=lambda x: x["month"])[-months:]
    for b in series:
        b["income"] = round(b["income"], 2)
        b["expense"] = round(b["expense"], 2)
        b["net"] = round(b["income"] - b["expense"], 2)
    return {"series": series}


@router.get("/categories")
def categories(
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
):
    """Expense breakdown by category. Defaults to the current month."""
    if year and month:
        start = date(year, month, 1)
    else:
        start, _ = month_bounds()
    _, nxt = month_bounds(start)

    rows = db.execute(
        select(Category.name, func.coalesce(func.sum(-Transaction.amount), 0.0))
        .join(Transaction, Transaction.category_id == Category.id)
        .where(Transaction.amount < 0, Transaction.date >= start, Transaction.date < nxt,
               Transaction.is_split.is_(False))
        .group_by(Category.name)
        .order_by(func.sum(-Transaction.amount))
    ).all()
    items = [{"name": name, "amount": round(float(total), 2)} for name, total in rows]
    items.sort(key=lambda x: -x["amount"])
    return {"month": f"{start.year:04d}-{start.month:02d}", "items": items}
