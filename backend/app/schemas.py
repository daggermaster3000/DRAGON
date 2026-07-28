"""Pydantic response/request models for the API."""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class Lifebar(BaseModel):
    id: int
    name: str
    spent: float
    budget: float
    remaining: float
    pct: float
    projected: float
    projected_pct: float
    over_budget: bool
    overspend: float


class MonthSummary(BaseModel):
    income: float
    expense: float
    net: float
    savings_rate: float
    projected_net: float = 0.0
    timeframe: str = "monthly"
    period_label: str = ""


class DragonOut(BaseModel):
    stage: str
    mood: str
    xp: int
    cumulative_net: float
    adherence: float
    over_budget_count: int


class ImportResult(BaseModel):
    filename: str
    n_rows: int
    n_new: int
    n_duplicate: int
    classified: dict[str, int]
    dragon: DragonOut


class TransactionOut(BaseModel):
    id: int
    date: date
    payee: str
    amount: float
    currency: str
    account: str
    bank_category: str | None
    category_id: int | None
    category_name: str | None
    subcategory: str | None
    classified_by: str
    needs_review: bool
    note: str | None
    info: str | None = None
    tags: str | None
    split_parent_id: int | None = None


class TransactionUpdate(BaseModel):
    category_id: int | None = None
    subcategory: str | None = None
    note: str | None = None
    tags: str | None = None


class DashboardOut(BaseModel):
    summary: MonthSummary
    lifebars: list[Lifebar]
    dragon: DragonOut
