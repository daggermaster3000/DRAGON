"""Create tables and seed budget categories / rules / maps on first run.

Idempotent: safe to call at every startup. Only inserts what's missing, so it
never clobbers user edits to budgets or rules.
"""
import json
from pathlib import Path

from sqlalchemy import inspect, select, text

from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine
from .models import BankCategoryMap, Category, DragonState, MerchantRule

SEED_PATH = Path(__file__).resolve().parent / "seed" / "budget_seed.json"

# Columns added after v0.1 — created on existing SQLite DBs that predate them.
_ADDED_COLUMNS = {
    "transactions": [
        ("is_split", "BOOLEAN DEFAULT 0"),
        ("split_parent_id", "INTEGER"),
    ],
}


def _migrate(conn) -> None:
    """Lightweight additive migration: create_all handles new tables; this adds
    columns to tables that already exist (SQLite can't do that via create_all)."""
    insp = inspect(conn)
    existing_tables = set(insp.get_table_names())
    for table, cols in _ADDED_COLUMNS.items():
        if table not in existing_tables:
            continue  # create_all just made it with all columns
        have = {c["name"] for c in insp.get_columns(table)}
        for name, ddl in cols:
            if name not in have:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def init_db() -> None:
    with engine.begin() as conn:
        _migrate(conn)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        _seed(db)


def _seed(db: Session) -> None:
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))

    existing = {c.name for c in db.scalars(select(Category)).all()}
    order = 0
    for kind, key in (("expense", "expense_categories"), ("income", "income_categories")):
        for cat in seed.get(key, []):
            order += 1
            if cat["category"] in existing:
                continue
            db.add(Category(
                kind=kind,
                name=cat["category"],
                monthly_budget=cat.get("monthly_budget", 0.0),
                sort_order=order,
                subcategories_json=json.dumps(cat.get("subcategories", []), ensure_ascii=False),
            ))

    if not db.scalar(select(MerchantRule).limit(1)):
        for i, r in enumerate(seed.get("merchant_rules", [])):
            db.add(MerchantRule(
                contains=r["contains"], category_name=r["category"],
                subcategory=r.get("subcategory"), priority=i, source="seed",
            ))

    if not db.scalar(select(BankCategoryMap).limit(1)):
        for bank_cat, budget_cat in seed.get("bank_category_map", {}).items():
            db.add(BankCategoryMap(bank_category=bank_cat, category_name=budget_cat))

    if not db.scalar(select(DragonState).limit(1)):
        db.add(DragonState(id=1, stage="baby", mood="idle", xp=0))

    db.commit()
