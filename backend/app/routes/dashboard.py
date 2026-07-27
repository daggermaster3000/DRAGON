"""Dashboard + budget lifebars + dragon read endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from sqlalchemy import select

from ..budget_calc import category_lifebars, month_summary
from ..db import get_db
from ..dragon import compute_dragon
from ..models import Category
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
    return [{"id": c.id, "name": c.name, "kind": c.kind, "monthly_budget": c.monthly_budget} for c in cats]
