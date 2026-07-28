"""Plan tracking: are we on track vs the budget plan? No account balances —
compares actual cash flow to the plan derived from category budgets."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..budget_calc import month_bounds
from ..db import get_db
from ..models import Category, Transaction

router = APIRouter(prefix="/api/health", tags=["health"])


def _status(ratio: float) -> str:
    # ratio = projected/target for spend, or actual/target for savings (>=1 good for savings)
    if ratio <= 1.0:
        return "on_track"
    if ratio <= 1.1:
        return "watch"
    return "off_track"


@router.get("/plan")
def plan(db: Session = Depends(get_db)):
    today = date.today()
    start, nxt = month_bounds(today)
    days_in_month = (nxt - start).days
    day = today.day

    expense_budget = db.scalar(
        select(func.coalesce(func.sum(Category.monthly_budget), 0.0)).where(Category.kind == "expense")
    ) or 0.0
    income_budget = db.scalar(
        select(func.coalesce(func.sum(Category.monthly_budget), 0.0)).where(Category.kind == "income")
    ) or 0.0
    planned_net = round(float(income_budget - expense_budget), 2)

    spent = db.scalar(
        select(func.coalesce(func.sum(-Transaction.amount), 0.0))
        .where(Transaction.amount < 0, Transaction.date >= start, Transaction.date < nxt,
               Transaction.is_split.is_(False))
    ) or 0.0
    spent = round(float(spent), 2)
    projected = round(spent / day * days_in_month, 2) if day else spent
    pace_ratio = (projected / expense_budget) if expense_budget else 0.0

    month_pace = {
        "day": day,
        "days_in_month": days_in_month,
        "spent": spent,
        "budget": round(float(expense_budget), 2),
        "projected": projected,
        "status": _status(pace_ratio) if expense_budget else "on_track",
    }

    # Monthly actual net vs the planned target line.
    txns = db.scalars(select(Transaction).where(Transaction.is_split.is_(False))).all()
    buckets: dict[str, float] = {}
    for t in txns:
        key = f"{t.date.year:04d}-{t.date.month:02d}"
        buckets[key] = buckets.get(key, 0.0) + t.amount
    monthly = [
        {"month": k, "net": round(v, 2), "target": planned_net}
        for k, v in sorted(buckets.items())
    ][-12:]

    # Year-to-date savings vs plan.
    ytd_start = date(today.year, 1, 1)
    ytd_actual = db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0.0))
        .where(Transaction.date >= ytd_start, Transaction.date < nxt, Transaction.is_split.is_(False))
    ) or 0.0
    ytd_actual = round(float(ytd_actual), 2)
    ytd_target = round(planned_net * today.month, 2)  # months elapsed incl current
    savings_ratio = (ytd_actual / ytd_target) if ytd_target > 0 else (2.0 if ytd_actual > 0 else 0.0)

    savings = {
        "planned_monthly": planned_net,
        "ytd_actual": ytd_actual,
        "ytd_target": ytd_target,
        "delta": round(ytd_actual - ytd_target, 2),
        # For savings, meeting-or-beating target is good -> invert the ratio test.
        "status": "on_track" if savings_ratio >= 0.95 else ("watch" if savings_ratio >= 0.8 else "off_track"),
    }

    return {"month_pace": month_pace, "savings": savings, "monthly": monthly}
