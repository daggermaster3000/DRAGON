"""Category editing: create custom categories, rename, edit monthly budget,
delete. (GET /api/categories lives in dashboard.py.)"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Category, Transaction

router = APIRouter(prefix="/api/categories", tags=["categories"])


class CategoryIn(BaseModel):
    name: str
    monthly_budget: float = 0.0
    kind: str = "expense"


class CategoryPatch(BaseModel):
    name: str | None = None
    monthly_budget: float | None = None


def _out(c: Category) -> dict:
    return {"id": c.id, "name": c.name, "kind": c.kind, "monthly_budget": round(c.monthly_budget, 2)}


@router.post("")
def create_category(payload: CategoryIn, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(422, "name must not be empty")
    if db.scalar(select(Category).where(Category.name == name)):
        raise HTTPException(409, f"category '{name}' already exists")
    if payload.kind not in ("expense", "income"):
        raise HTTPException(422, "kind must be 'expense' or 'income'")
    max_order = db.scalar(select(func.max(Category.sort_order))) or 0
    c = Category(
        kind=payload.kind, name=name, monthly_budget=max(0.0, payload.monthly_budget),
        sort_order=max_order + 1, subcategories_json="[]",
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _out(c)


@router.patch("/{category_id}")
def update_category(category_id: int, patch: CategoryPatch, db: Session = Depends(get_db)):
    c = db.get(Category, category_id)
    if not c:
        raise HTTPException(404, "category not found")
    if patch.name is not None:
        new = patch.name.strip()
        if not new:
            raise HTTPException(422, "name must not be empty")
        clash = db.scalar(select(Category).where(Category.name == new, Category.id != category_id))
        if clash:
            raise HTTPException(409, f"category '{new}' already exists")
        c.name = new
    if patch.monthly_budget is not None:
        c.monthly_budget = max(0.0, patch.monthly_budget)
    db.commit()
    db.refresh(c)
    return _out(c)


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    c = db.get(Category, category_id)
    if not c:
        raise HTTPException(404, "category not found")
    # Detach transactions rather than deleting them; flag for review.
    n = db.query(Transaction).filter(Transaction.category_id == category_id).update(
        {"category_id": None, "classified_by": "unclassified", "needs_review": True},
        synchronize_session=False,
    )
    db.delete(c)
    db.commit()
    return {"deleted": category_id, "transactions_detached": n}
