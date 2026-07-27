"""Budget rollups: spend-this-month per category -> lifebar data. Shared by the
budget route and the dragon logic so both see the same numbers."""
from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Category, Transaction


def month_bounds(today: date | None = None) -> tuple[date, date]:
    today = today or date.today()
    start = today.replace(day=1)
    nxt = (start.replace(year=start.year + 1, month=1) if start.month == 12
           else start.replace(month=start.month + 1))
    return start, nxt


def category_lifebars(db: Session, today: date | None = None) -> list[dict]:
    """One lifebar per expense category: spent vs monthly_budget for this month."""
    start, nxt = month_bounds(today)

    spent_rows = db.execute(
        select(Transaction.category_id, func.coalesce(func.sum(-Transaction.amount), 0.0))
        .where(Transaction.amount < 0, Transaction.date >= start, Transaction.date < nxt)
        .group_by(Transaction.category_id)
    ).all()
    spent_by_cat = {cid: float(total) for cid, total in spent_rows}

    cats = db.scalars(
        select(Category).where(Category.kind == "expense").order_by(Category.sort_order)
    ).all()

    bars = []
    for c in cats:
        spent = round(spent_by_cat.get(c.id, 0.0), 2)
        budget = round(c.monthly_budget, 2)
        remaining = round(budget - spent, 2)
        pct = (spent / budget * 100) if budget > 0 else (100.0 if spent > 0 else 0.0)
        over = budget > 0 and spent > budget
        # Hide zero-budget categories with no spend to keep the dashboard clean.
        if budget == 0 and spent == 0:
            continue
        bars.append({
            "id": c.id,
            "name": c.name,
            "spent": spent,
            "budget": budget,
            "remaining": remaining,
            "pct": round(pct, 1),
            "over_budget": over,
            "overspend": round(spent - budget, 2) if over else 0.0,
        })
    return bars


def month_summary(db: Session, today: date | None = None) -> dict:
    start, nxt = month_bounds(today)
    income = db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0.0))
        .where(Transaction.amount > 0, Transaction.date >= start, Transaction.date < nxt)
    ) or 0.0
    expense = db.scalar(
        select(func.coalesce(func.sum(-Transaction.amount), 0.0))
        .where(Transaction.amount < 0, Transaction.date >= start, Transaction.date < nxt)
    ) or 0.0
    net = income - expense
    return {
        "income": round(float(income), 2),
        "expense": round(float(expense), 2),
        "net": round(float(net), 2),
        "savings_rate": round(float(net / income * 100), 1) if income else 0.0,
    }
