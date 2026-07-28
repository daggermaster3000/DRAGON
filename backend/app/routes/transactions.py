"""Transaction list + edit (category / note / tags). Full search/split/bulk in a
later pass; MVP covers list, filter, and single edit."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import Category, Transaction
from ..schemas import TransactionOut, TransactionUpdate

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def _to_out(t: Transaction) -> TransactionOut:
    return TransactionOut(
        id=t.id, date=t.date, payee=t.payee, amount=t.amount, currency=t.currency,
        account=t.account, bank_category=t.bank_category, category_id=t.category_id,
        category_name=t.category.name if t.category else None, subcategory=t.subcategory,
        classified_by=t.classified_by, needs_review=t.needs_review, note=t.note, tags=t.tags,
    )


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    db: Session = Depends(get_db),
    q: str | None = Query(None, description="search payee substring"),
    category_id: int | None = None,
    needs_review: bool | None = None,
    date_from: date | None = Query(None, description="inclusive lower bound"),
    date_to: date | None = Query(None, description="inclusive upper bound"),
    limit: int = Query(200, le=1000),
    offset: int = 0,
):
    stmt = select(Transaction).options(joinedload(Transaction.category)).order_by(Transaction.date.desc())
    if q:
        stmt = stmt.where(Transaction.payee.ilike(f"%{q}%"))
    if category_id is not None:
        stmt = stmt.where(Transaction.category_id == category_id)
    if needs_review is not None:
        stmt = stmt.where(Transaction.needs_review == needs_review)
    if date_from is not None:
        stmt = stmt.where(Transaction.date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Transaction.date <= date_to)
    stmt = stmt.limit(limit).offset(offset)
    return [_to_out(t) for t in db.scalars(stmt).all()]


@router.patch("/{txn_id}", response_model=TransactionOut)
def update_transaction(txn_id: int, patch: TransactionUpdate, db: Session = Depends(get_db)):
    t = db.get(Transaction, txn_id)
    if not t:
        raise HTTPException(404, "transaction not found")
    if patch.category_id is not None:
        if not db.get(Category, patch.category_id):
            raise HTTPException(422, "unknown category_id")
        t.category_id = patch.category_id
        t.classified_by = "manual"
        t.needs_review = False
    if patch.subcategory is not None:
        t.subcategory = patch.subcategory
    if patch.note is not None:
        t.note = patch.note
    if patch.tags is not None:
        t.tags = patch.tags
    db.commit()
    db.refresh(t)
    return _to_out(t)
