"""Budget oracle: given the user's income/location/goals plus their observed
fixed spending, propose a full monthly budget (discretionary + savings/investing)
via the LLM, with a deterministic heuristic fallback. Returns a proposal aligned
to the existing category/subcategory structure; a separate endpoint applies it."""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..budget_calc import month_bounds
from ..classify.service import build_provider
from ..db import get_db
from ..models import Category, Transaction

router = APIRouter(prefix="/api/budget/oracle", tags=["oracle"])

# Categories treated as fixed (anchored to observed/actual spend, not invented).
FIXED = {"Housing", "Health and personal care", "Taxes", "Insurance",
         "Mobility", "Communication and entertainment", "Debts"}


class OracleInput(BaseModel):
    income_monthly: float
    location: str = ""          # canton / city
    household: str = ""         # free text: renter/owner, car, family, ...
    goals: str = ""             # free text goals
    savings_rate_target: float | None = None  # optional %, 0-100


def _observed_monthly(db: Session, months: int = 6) -> dict[str, float]:
    """Average monthly expense per category over the last `months` full months."""
    cur_start, _ = month_bounds()
    txns = db.scalars(
        select(Transaction).where(Transaction.amount < 0, Transaction.is_split.is_(False),
                                  Transaction.date < cur_start)
    ).all()
    by_cat_month: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for t in txns:
        key = f"{t.date.year:04d}-{t.date.month:02d}"
        by_cat_month[t.category_id][key] += -t.amount
    # last `months` month-keys present overall
    all_months = sorted({k for m in by_cat_month.values() for k in m})[-months:]
    n = max(len(all_months), 1)
    cats = {c.id: c.name for c in db.scalars(select(Category)).all()}
    out: dict[str, float] = defaultdict(float)
    for cid, mm in by_cat_month.items():
        name = cats.get(cid)
        if not name:
            continue
        out[name] += round(sum(v for k, v in mm.items() if k in all_months) / n, 2)
    return {k: round(v, 2) for k, v in out.items()}


def _catalogue(db: Session) -> list[Category]:
    return db.scalars(select(Category).where(Category.kind == "expense").order_by(Category.sort_order)).all()


def _prompt(inp: OracleInput, cats: list[Category], observed: dict[str, float]) -> str:
    lines = []
    for c in cats:
        subs = json.loads(c.subcategories_json or "[]")
        sub_names = ", ".join(s["name"] for s in subs) or "(none)"
        obs = observed.get(c.name, 0.0)
        tag = "FIXED" if c.name in FIXED else "flexible"
        lines.append(f'- {c.name} [{tag}] observed≈CHF {obs:.0f}/mo; subcategories: {sub_names}')
    cat_block = "\n".join(lines)
    return (
        "You are a Swiss personal-finance budgeting oracle. Build a realistic "
        "MONTHLY budget for this person.\n\n"
        f"Net monthly income: CHF {inp.income_monthly:.0f}\n"
        f"Location: {inp.location or 'Switzerland'}\n"
        f"Household: {inp.household or 'n/a'}\n"
        f"Goals: {inp.goals or 'save and invest sensibly'}\n"
        f"Target savings rate: {inp.savings_rate_target if inp.savings_rate_target is not None else 'choose a sensible one'}%\n\n"
        "Rules:\n"
        "- Keep FIXED categories close to their observed monthly value (don't invent).\n"
        "- Set flexible categories (groceries, leisure, sports, bars, holidays, "
        "hobbies) to sensible Swiss amounts for this income.\n"
        "- Fund savings/investing so total expenses (incl. savings) ≈ income and "
        "the savings goal is met. Put savings under 'Reserves' subcategories and "
        "'Other' -> 'Savings / investments / retirement'.\n"
        "- Use ONLY the exact category and subcategory names given below.\n\n"
        f"Categories:\n{cat_block}\n\n"
        'Respond ONLY with JSON: an object mapping each category name to an object '
        'mapping subcategory name to a monthly CHF number, e.g. '
        '{"Groceries": {"Groceries and beverages": 400, "Dining out (restaurants, canteens)": 120}}. '
        "Omit subcategories you set to 0. Include a short plan under key _rationale (string)."
    )


def _heuristic(inp: OracleInput, cats: list[Category], observed: dict[str, float]) -> tuple[dict, str]:
    """Deterministic fallback: fixed = observed, savings = target, discretionary
    split of the remainder by weights."""
    income = inp.income_monthly
    target_rate = (inp.savings_rate_target if inp.savings_rate_target is not None else 20) / 100
    savings = round(income * target_rate, 2)

    fixed_total = sum(observed.get(c.name, 0.0) for c in cats if c.name in FIXED)
    discretionary_pool = max(0.0, income - fixed_total - savings)
    weights = {"Groceries": 4, "Leisure and holidays": 2, "Clothing and shoes": 1,
               "Pets": 0.3, "Education and continuing education": 0.5, "Other": 1}
    wsum = sum(weights.values())

    proposal: dict[str, dict[str, float]] = {}
    for c in cats:
        subs = json.loads(c.subcategories_json or "[]")
        if not subs:
            continue
        if c.name in FIXED:
            total = observed.get(c.name, 0.0)
        elif c.name == "Reserves":
            total = savings * 0.5
        elif c.name == "Other":
            total = discretionary_pool * (weights.get("Other", 1) / wsum) + savings * 0.5
        else:
            total = discretionary_pool * (weights.get(c.name, 0.5) / wsum)
        # allocate the category total to its highest-budget subcategory (or first)
        chosen = max(subs, key=lambda s: s.get("monthly_budget", 0)) if any(s.get("monthly_budget") for s in subs) else subs[0]
        proposal[c.name] = {chosen["name"]: round(total, 2)}
    rationale = (f"Heuristic plan: fixed costs kept at observed (~CHF {fixed_total:.0f}/mo), "
                 f"savings CHF {savings:.0f}/mo ({target_rate*100:.0f}%), remaining "
                 f"CHF {discretionary_pool:.0f} split across flexible categories.")
    return proposal, rationale


def _align(raw: dict, cats: list[Category]) -> list[dict]:
    """Map an AI/heuristic proposal (category->sub->amount) to the existing
    structure, keeping only valid names."""
    items = []
    total = 0.0
    for c in cats:
        seed_subs = json.loads(c.subcategories_json or "[]")
        valid = {s["name"] for s in seed_subs}
        proposed = raw.get(c.name, {}) if isinstance(raw.get(c.name), dict) else {}
        subs = []
        for s in seed_subs:
            amt = proposed.get(s["name"])
            subs.append({"name": s["name"], "monthly_budget": round(float(amt), 2) if isinstance(amt, (int, float)) else 0.0})
        # any proposed sub not in seed but with an amount -> add it
        for name, amt in proposed.items():
            if name not in valid and isinstance(amt, (int, float)) and amt:
                subs.append({"name": name, "monthly_budget": round(float(amt), 2)})
        cat_total = round(sum(s["monthly_budget"] for s in subs), 2)
        total += cat_total
        items.append({"category": c.name, "monthly_budget": cat_total, "subcategories": subs})
    return items


@router.post("")
def propose(inp: OracleInput, db: Session = Depends(get_db)):
    cats = _catalogue(db)
    observed = _observed_monthly(db)
    provider = build_provider()

    raw: dict | None = None
    rationale = ""
    source = "fallback"
    if provider is not None and provider.available():
        text = provider.generate(_prompt(inp, cats, observed), temperature=0.4)
        if text:
            try:
                data = json.loads(text[text.index("{"): text.rindex("}") + 1])
                rationale = str(data.pop("_rationale", "")) if isinstance(data, dict) else ""
                raw = data
                source = "ai"
            except (ValueError, json.JSONDecodeError):
                raw = None
    if raw is None:
        raw, rationale = _heuristic(inp, cats, observed)
        source = "fallback"

    items = _align(raw, cats)
    total_expense = round(sum(i["monthly_budget"] for i in items), 2)
    planned_savings = round(inp.income_monthly - total_expense, 2)
    return {
        "source": source,
        "rationale": rationale,
        "items": items,
        "income_monthly": round(inp.income_monthly, 2),
        "total_expense": total_expense,
        "planned_savings": planned_savings,
        "observed": observed,
    }


class ApplyItem(BaseModel):
    category: str
    subcategories: list[dict]


class ApplyInput(BaseModel):
    items: list[ApplyItem]


@router.post("/apply")
def apply(payload: ApplyInput, db: Session = Depends(get_db)):
    by_name = {c.name: c for c in db.scalars(select(Category)).all()}
    applied = 0
    for item in payload.items:
        c = by_name.get(item.category)
        if not c:
            continue
        subs = []
        for s in item.subcategories:
            name = str(s.get("name", "")).strip()
            if not name:
                continue
            amt = s.get("monthly_budget", 0)
            subs.append({"name": name, "monthly_budget": round(max(0.0, float(amt or 0)), 2)})
        c.subcategories_json = json.dumps(subs, ensure_ascii=False)
        c.monthly_budget = round(sum(s["monthly_budget"] for s in subs), 2)
        applied += 1
    if applied == 0:
        raise HTTPException(422, "no matching categories to apply")
    db.commit()
    return {"applied": applied}
