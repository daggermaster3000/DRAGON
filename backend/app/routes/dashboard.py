"""Dashboard + budget lifebars + dragon read endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

import json

from fastapi import HTTPException
from sqlalchemy import select

from ..budget_calc import category_lifebars, month_bounds, month_summary
from ..db import get_db
from ..dragon import compute_dragon
from ..models import Category, Transaction
from ..schemas import DashboardOut, DragonOut, Lifebar

router = APIRouter(prefix="/api", tags=["dashboard"])

SORTS = {
    "remaining": lambda b: b["remaining"],
    "overspend": lambda b: -b["overspend"],
    "alphabetical": lambda b: b["name"].lower(),
}


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(sort: str = Query("remaining"), db: Session = Depends(get_db)):
    bars = category_lifebars(db)
    bars.sort(key=SORTS.get(sort, SORTS["remaining"]))
    return DashboardOut(
        summary=month_summary(db),          # type: ignore[arg-type]
        lifebars=[Lifebar(**b) for b in bars],
        dragon=compute_dragon(db),          # type: ignore[arg-type]
    )


@router.get("/budget", response_model=list[Lifebar])
def budget(sort: str = Query("remaining"), db: Session = Depends(get_db)):
    bars = category_lifebars(db)
    bars.sort(key=SORTS.get(sort, SORTS["remaining"]))
    return [Lifebar(**b) for b in bars]


@router.get("/dragon", response_model=DragonOut)
def dragon(db: Session = Depends(get_db)):
    return compute_dragon(db)  # type: ignore[return-value]


@router.get("/categories")
def categories(db: Session = Depends(get_db)):
    cats = db.scalars(select(Category).order_by(Category.kind, Category.sort_order)).all()
    return [
        {
            "id": c.id, "name": c.name, "kind": c.kind,
            "monthly_budget": round(c.monthly_budget, 2),
            "subcategories": json.loads(c.subcategories_json or "[]"),
        }
        for c in cats
    ]


@router.get("/budget/{category_id}/detail")
def category_detail(category_id: int, db: Session = Depends(get_db)):
    """Drill-down for a lifebar: per-subcategory budget vs spend + this-month
    transactions in the category."""
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(404, "category not found")
    start, nxt = month_bounds()

    txns = db.scalars(
        select(Transaction)
        .where(Transaction.category_id == category_id, Transaction.amount < 0,
               Transaction.date >= start, Transaction.date < nxt, Transaction.is_split.is_(False))
        .order_by(Transaction.date.desc())
    ).all()

    spent_by_sub: dict[str, float] = {}
    for t in txns:
        key = t.subcategory or "—"
        spent_by_sub[key] = spent_by_sub.get(key, 0.0) + (-t.amount)

    seed_subs = json.loads(cat.subcategories_json or "[]")
    subs = []
    seen = set()
    for s in seed_subs:
        name = s["name"]
        seen.add(name)
        budget = round(float(s.get("monthly_budget", 0.0)), 2)
        spent = round(spent_by_sub.get(name, 0.0), 2)
        if budget == 0 and spent == 0:
            continue
        subs.append({"name": name, "budget": budget, "spent": spent})
    # Subcategories that got spend but aren't in the seed (e.g. "—" / bank-mapped).
    for name, spent in spent_by_sub.items():
        if name not in seen and round(spent, 2) != 0:
            subs.append({"name": name, "budget": 0.0, "spent": round(spent, 2)})
    subs.sort(key=lambda x: -x["spent"])

    spent_total = round(sum(-t.amount for t in txns), 2)
    return {
        "id": cat.id,
        "name": cat.name,
        "budget": round(cat.monthly_budget, 2),
        "spent": spent_total,
        "subcategories": subs,
        "transactions": [
            {"id": t.id, "date": t.date.isoformat(), "payee": t.payee,
             "amount": t.amount, "subcategory": t.subcategory}
            for t in txns
        ],
    }
