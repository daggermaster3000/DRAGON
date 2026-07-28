"""Transaction list + edit (category / note / tags). Full search/split/bulk in a
later pass; MVP covers list, filter, and single edit."""
from __future__ import annotations

import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import ActionLog, Category, Transaction
from ..parser import dedup_hash
from ..schemas import TransactionOut, TransactionUpdate

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def _snapshot(t: Transaction) -> dict:
    return {
        "id": t.id, "category_id": t.category_id, "subcategory": t.subcategory,
        "classified_by": t.classified_by, "needs_review": t.needs_review,
        "note": t.note, "tags": t.tags,
    }


def _log(db: Session, kind: str, data: dict) -> None:
    db.add(ActionLog(kind=kind, data=json.dumps(data)))


def _to_out(t: Transaction) -> TransactionOut:
    return TransactionOut(
        id=t.id, date=t.date, payee=t.payee, amount=t.amount, currency=t.currency,
        account=t.account, bank_category=t.bank_category, category_id=t.category_id,
        category_name=t.category.name if t.category else None, subcategory=t.subcategory,
        classified_by=t.classified_by, needs_review=t.needs_review, note=t.note, tags=t.tags,
        split_parent_id=t.split_parent_id,
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
    stmt = (
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(Transaction.is_split.is_(False))  # hide split parents; children shown
        .order_by(Transaction.date.desc())
    )
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
    _log(db, "recategorize", {"items": [_snapshot(t)]})
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


class BulkRecategorize(BaseModel):
    ids: list[int]
    category_id: int


@router.post("/bulk")
def bulk_recategorize(payload: BulkRecategorize, db: Session = Depends(get_db)):
    if not payload.ids:
        raise HTTPException(422, "ids must not be empty")
    if not db.get(Category, payload.category_id):
        raise HTTPException(422, "unknown category_id")
    txns = db.scalars(select(Transaction).where(Transaction.id.in_(payload.ids))).all()
    _log(db, "bulk", {"items": [_snapshot(t) for t in txns]})
    for t in txns:
        t.category_id = payload.category_id
        t.classified_by = "manual"
        t.needs_review = False
    db.commit()
    return {"updated": len(txns)}


class SplitPart(BaseModel):
    amount: float
    category_id: int
    subcategory: str | None = None
    note: str | None = None


class SplitIn(BaseModel):
    parts: list[SplitPart]


@router.post("/{txn_id}/split")
def split_transaction(txn_id: int, payload: SplitIn, db: Session = Depends(get_db)):
    parent = db.get(Transaction, txn_id)
    if not parent:
        raise HTTPException(404, "transaction not found")
    if parent.is_split:
        raise HTTPException(409, "transaction already split")
    if len(payload.parts) < 2:
        raise HTTPException(422, "a split needs at least 2 parts")
    total = round(sum(p.amount for p in payload.parts), 2)
    if abs(total - round(parent.amount, 2)) > 0.01:
        raise HTTPException(422, f"parts sum to {total}, must equal {parent.amount}")
    for p in payload.parts:
        if not db.get(Category, p.category_id):
            raise HTTPException(422, f"unknown category_id {p.category_id}")

    children: list[Transaction] = []
    for i, p in enumerate(payload.parts):
        children.append(Transaction(
            date=parent.date, payee=parent.payee, amount=round(p.amount, 2),
            currency=parent.currency, account=parent.account, bank_category=parent.bank_category,
            category_id=p.category_id, subcategory=p.subcategory, note=p.note,
            classified_by="manual", needs_review=False, source_file=parent.source_file,
            split_parent_id=parent.id, is_split=False,
            dedup_hash=dedup_hash(parent.date, parent.payee, parent.amount, parent.account) + f"-s{i}",
        ))
    parent.is_split = True
    db.add_all(children)
    db.flush()
    _log(db, "split", {"parent_id": parent.id, "child_ids": [c.id for c in children]})
    db.commit()
    return {"parent_id": parent.id, "children": len(children)}


@router.post("/undo")
def undo(db: Session = Depends(get_db)):
    entry = db.scalar(select(ActionLog).order_by(ActionLog.id.desc()).limit(1))
    if not entry:
        raise HTTPException(404, "nothing to undo")
    data = json.loads(entry.data)

    if entry.kind in ("recategorize", "bulk"):
        for snap in data["items"]:
            t = db.get(Transaction, snap["id"])
            if not t:
                continue
            t.category_id = snap["category_id"]
            t.subcategory = snap["subcategory"]
            t.classified_by = snap["classified_by"]
            t.needs_review = snap["needs_review"]
            t.note = snap["note"]
            t.tags = snap["tags"]
    elif entry.kind == "split":
        for cid in data["child_ids"]:
            child = db.get(Transaction, cid)
            if child:
                db.delete(child)
        parent = db.get(Transaction, data["parent_id"])
        if parent:
            parent.is_split = False

    db.delete(entry)
    db.commit()
    return {"undone": entry.kind}
