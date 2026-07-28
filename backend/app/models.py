"""ORM models. One SQLite file holds everything; PostgreSQL-compatible types only."""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Category(Base):
    """A budget category (from Budget-Tool.xlsm). kind = 'expense' | 'income'."""
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(16), default="expense")
    name: Mapped[str] = mapped_column(String(128), unique=True)
    monthly_budget: Mapped[float] = mapped_column(Float, default=0.0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    # Subcategory names + budgets kept as JSON-ish text for MVP (drill-down later).
    subcategories_json: Mapped[str] = mapped_column(Text, default="[]")

    transactions: Mapped[list[Transaction]] = relationship(back_populates="category")


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (UniqueConstraint("dedup_hash", name="uq_txn_dedup"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    payee: Mapped[str] = mapped_column(String(256), default="")
    amount: Mapped[float] = mapped_column(Float)  # negative = expense, positive = income
    currency: Mapped[str] = mapped_column(String(8), default="CHF")
    account: Mapped[str] = mapped_column(String(128), default="")
    bank_category: Mapped[str | None] = mapped_column(String(128), nullable=True)

    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True, index=True)
    subcategory: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # How the category was assigned: bank | rule | ai | manual | unclassified
    classified_by: Mapped[str] = mapped_column(String(16), default="unclassified")
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False)

    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str | None] = mapped_column(String(256), nullable=True)
    source_file: Mapped[str | None] = mapped_column(String(256), nullable=True)
    dedup_hash: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Split support: a parent is excluded from all aggregations; its children
    # (split_parent_id set) carry the real amounts and categories.
    is_split: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    split_parent_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)

    category: Mapped[Category | None] = relationship(back_populates="transactions")


class MerchantRule(Base):
    """User- or seed-defined substring rule: payee contains X -> category."""
    __tablename__ = "merchant_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    contains: Mapped[str] = mapped_column(String(128), index=True)
    category_name: Mapped[str] = mapped_column(String(128))
    subcategory: Mapped[str | None] = mapped_column(String(128), nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=100)
    source: Mapped[str] = mapped_column(String(16), default="seed")  # seed | user


class BankCategoryMap(Base):
    """Bank export French category -> budget category (deterministic first pass)."""
    __tablename__ = "bank_category_map"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bank_category: Mapped[str] = mapped_column(String(128), unique=True)
    category_name: Mapped[str | None] = mapped_column(String(128), nullable=True)


class DragonState(Base):
    """Singleton (id=1). Derived on read, but persisted for streaks/history."""
    __tablename__ = "dragon_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    stage: Mapped[str] = mapped_column(String(16), default="baby")  # baby|young|adult|legendary
    mood: Mapped[str] = mapped_column(String(16), default="idle")   # idle|happy|excited|sleepy|angry
    xp: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(256))
    n_rows: Mapped[int] = mapped_column(Integer, default=0)
    n_new: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")


class ActionLog(Base):
    """Reversible record of a mutating action, for single-step undo.
    `data` is JSON holding whatever the reverse needs (prior states, new ids)."""
    __tablename__ = "action_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(24))  # recategorize | bulk | split
    data: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
