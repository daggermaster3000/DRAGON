"""Budget rollups over a selectable timeframe (month / quarter / year), with a
pace projection for the current partial period. Shared by the budget route,
dragon logic, and stats so everyone sees the same numbers."""
from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Category, Transaction

FACTOR = {"monthly": 1, "quarterly": 3, "annual": 12}


def month_bounds(today: date | None = None) -> tuple[date, date]:
    today = today or date.today()
    start = today.replace(day=1)
    nxt = (start.replace(year=start.year + 1, month=1) if start.month == 12
           else start.replace(month=start.month + 1))
    return start, nxt


def _add_months(d: date, n: int) -> date:
    m = d.month - 1 + n
    return date(d.year + m // 12, m % 12 + 1, 1)


def period_bounds(timeframe: str = "monthly", today: date | None = None):
    """Return (start, next, factor, elapsed_fraction, label) for the period that
    contains `today`. factor scales monthly budgets to the period."""
    today = today or date.today()
    if timeframe == "annual":
        start = date(today.year, 1, 1)
        nxt = date(today.year + 1, 1, 1)
        label = str(today.year)
    elif timeframe == "quarterly":
        q = (today.month - 1) // 3
        start = date(today.year, q * 3 + 1, 1)
        nxt = _add_months(start, 3)
        label = f"Q{q + 1} {today.year}"
    else:  # monthly
        timeframe = "monthly"
        start, nxt = month_bounds(today)
        label = today.strftime("%b %Y")
    total_days = (nxt - start).days
    elapsed_days = min((today - start).days + 1, total_days)
    fraction = elapsed_days / total_days if total_days else 1.0
    return start, nxt, FACTOR[timeframe], fraction, label


def category_lifebars(db: Session, timeframe: str = "monthly", today: date | None = None) -> list[dict]:
    """One lifebar per expense category: spent vs budget for the period, plus a
    pace projection (spent extrapolated over the whole period)."""
    start, nxt, factor, fraction, _label = period_bounds(timeframe, today)

    spent_rows = db.execute(
        select(Transaction.category_id, func.coalesce(func.sum(-Transaction.amount), 0.0))
        .where(Transaction.amount < 0, Transaction.date >= start, Transaction.date < nxt,
               Transaction.is_split.is_(False))
        .group_by(Transaction.category_id)
    ).all()
    spent_by_cat = {cid: float(total) for cid, total in spent_rows}

    cats = db.scalars(
        select(Category).where(Category.kind == "expense").order_by(Category.sort_order)
    ).all()

    bars = []
    for c in cats:
        spent = round(spent_by_cat.get(c.id, 0.0), 2)
        budget = round(c.monthly_budget * factor, 2)
        remaining = round(budget - spent, 2)
        pct = (spent / budget * 100) if budget > 0 else (100.0 if spent > 0 else 0.0)
        projected = round(spent / fraction, 2) if fraction > 0 else spent
        projected_pct = (projected / budget * 100) if budget > 0 else (100.0 if projected > 0 else 0.0)
        over = budget > 0 and spent > budget
        if budget == 0 and spent == 0:
            continue
        bars.append({
            "id": c.id, "name": c.name,
            "spent": spent, "budget": budget, "remaining": remaining,
            "pct": round(pct, 1),
            "projected": projected, "projected_pct": round(projected_pct, 1),
            "over_budget": over,
            "overspend": round(spent - budget, 2) if over else 0.0,
        })
    return bars


def period_summary(db: Session, timeframe: str = "monthly", today: date | None = None) -> dict:
    start, nxt, _factor, fraction, label = period_bounds(timeframe, today)
    income = db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0.0))
        .where(Transaction.amount > 0, Transaction.date >= start, Transaction.date < nxt,
               Transaction.is_split.is_(False))
    ) or 0.0
    expense = db.scalar(
        select(func.coalesce(func.sum(-Transaction.amount), 0.0))
        .where(Transaction.amount < 0, Transaction.date >= start, Transaction.date < nxt,
               Transaction.is_split.is_(False))
    ) or 0.0
    net = income - expense
    return {
        "income": round(float(income), 2),
        "expense": round(float(expense), 2),
        "net": round(float(net), 2),
        "savings_rate": round(float(net / income * 100), 1) if income else 0.0,
        "projected_net": round(float(net / fraction), 2) if fraction > 0 else round(float(net), 2),
        "timeframe": timeframe,
        "period_label": label,
    }


# Backwards-compatible monthly summary (used by dragon).
def month_summary(db: Session, today: date | None = None) -> dict:
    return period_summary(db, "monthly", today)
