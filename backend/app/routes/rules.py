"""Merchant rules CRUD + re-apply. A rule is: payee contains X -> category."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..classify.service import reclassify_all
from ..db import get_db
from ..models import Category, MerchantRule

router = APIRouter(prefix="/api/rules", tags=["rules"])


class RuleIn(BaseModel):
    contains: str
    category_name: str
    subcategory: str | None = None


class RuleOut(BaseModel):
    id: int
    contains: str
    category_name: str
    subcategory: str | None
    priority: int
    source: str


@router.get("", response_model=list[RuleOut])
def list_rules(db: Session = Depends(get_db)):
    rules = db.scalars(select(MerchantRule).order_by(MerchantRule.priority)).all()
    return [RuleOut.model_validate(r, from_attributes=True) for r in rules]


@router.post("", response_model=RuleOut)
def create_rule(rule: RuleIn, db: Session = Depends(get_db)):
    contains = rule.contains.strip()
    if not contains:
        raise HTTPException(422, "contains must not be empty")
    if not db.scalar(select(Category).where(Category.name == rule.category_name)):
        raise HTTPException(422, f"unknown category '{rule.category_name}'")
    # User rules take precedence: give them a lower priority number than any existing.
    min_prio = db.scalar(select(func.min(MerchantRule.priority)))
    prio = (min_prio if min_prio is not None else 0) - 1
    r = MerchantRule(
        contains=contains, category_name=rule.category_name,
        subcategory=rule.subcategory, priority=prio, source="user",
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return RuleOut.model_validate(r, from_attributes=True)


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    r = db.get(MerchantRule, rule_id)
    if not r:
        raise HTTPException(404, "rule not found")
    db.delete(r)
    db.commit()
    return {"deleted": rule_id}


@router.post("/apply")
def apply_rules(db: Session = Depends(get_db)):
    """Reclassify all non-manual transactions with the current rule set."""
    return reclassify_all(db, include_manual=False)
