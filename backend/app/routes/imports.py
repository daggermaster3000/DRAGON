"""Upload a bank statement -> parse -> dedup -> classify -> store."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..classify.service import classify_transactions
from ..db import get_db
from ..dragon import compute_dragon
from ..models import ImportBatch, Transaction
from ..parser import ParseError, dedup_hash, parse_file
from ..schemas import ImportResult

router = APIRouter(prefix="/api/import", tags=["import"])


@router.post("", response_model=ImportResult)
async def import_statement(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    try:
        rows = parse_file(file.filename or "upload.xlsx", content)
    except ParseError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    existing = set(db.scalars(select(Transaction.dedup_hash)).all())
    new_txns: list[Transaction] = []
    seen: set[str] = set()
    for r in rows:
        h = dedup_hash(r["date"], r["payee"], r["amount"], r["account"])
        if h in existing or h in seen:
            continue
        seen.add(h)
        new_txns.append(Transaction(
            date=r["date"], payee=r["payee"], amount=r["amount"],
            currency=r["currency"], account=r["account"],
            bank_category=r["bank_category"], dedup_hash=h,
            source_file=file.filename,
        ))

    counts = classify_transactions(db, new_txns)
    db.add_all(new_txns)
    db.add(ImportBatch(filename=file.filename or "upload.xlsx", n_rows=len(rows), n_new=len(new_txns)))
    db.commit()

    from .quip import invalidate_cache
    invalidate_cache(db)  # next quip reflects the freshly imported data

    dragon = compute_dragon(db, event="upload")
    return ImportResult(
        filename=file.filename or "upload.xlsx",
        n_rows=len(rows),
        n_new=len(new_txns),
        n_duplicate=len(rows) - len(new_txns),
        classified=counts,
        dragon=dragon,  # type: ignore[arg-type]
    )
