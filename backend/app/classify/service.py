"""Classification orchestrator.

Pipeline per transaction, cheapest and most certain first:
  1. Merchant rule (user/seed substring)      -> classified_by="rule"
  2. Bank export category map                  -> classified_by="bank"
  3. AI provider on remaining unique payees    -> classified_by="ai"
  4. Nothing matched                           -> unclassified, needs_review

AI is consulted only for payees steps 1-2 could not resolve, batched and cached
per unique payee. If the provider is unavailable it falls back to leaving the
transaction unclassified (never blocks an import).
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import BankCategoryMap, Category, MerchantRule, Transaction
from .ollama_provider import OllamaProvider
from .openai_provider import OpenAIProvider

# Amount above which an AI/uncertain classification is flagged for manual review.
REVIEW_AMOUNT_THRESHOLD = 1000.0


def _build_provider():
    s = get_settings()
    if s.ai_provider == "ollama":
        return OllamaProvider(s.ollama_base_url, s.ollama_model)
    if s.ai_provider == "openai":
        return OpenAIProvider(s.openai_api_key, s.openai_model)
    return None  # "rules" or unknown -> deterministic only


def classify_transactions(db: Session, txns: list[Transaction]) -> dict:
    """Assign category to each transaction in-place. Returns counts by method."""
    settings = get_settings()
    rules = db.scalars(select(MerchantRule).order_by(MerchantRule.priority)).all()
    bank_map = {m.bank_category: m.category_name for m in db.scalars(select(BankCategoryMap)).all()}
    cat_by_name = {c.name: c for c in db.scalars(select(Category)).all()}
    expense_cat_names = [c.name for c in cat_by_name.values() if c.kind == "expense"]

    counts = {"rule": 0, "bank": 0, "ai": 0, "unclassified": 0}
    unresolved: dict[str, list[Transaction]] = {}

    for t in txns:
        payee_l = (t.payee or "").lower()

        # 1. merchant rule
        matched = next((r for r in rules if r.contains and r.contains.lower() in payee_l), None)
        if matched and matched.category_name in cat_by_name:
            _assign(t, cat_by_name[matched.category_name], matched.subcategory, "rule")
            counts["rule"] += 1
            continue

        # 2. bank category map
        mapped = bank_map.get(t.bank_category) if t.bank_category else None
        if mapped and mapped in cat_by_name:
            _assign(t, cat_by_name[mapped], None, "bank")
            counts["bank"] += 1
            continue

        # 3. defer to AI, grouped by unique payee
        unresolved.setdefault(t.payee or "", []).append(t)

    if unresolved:
        _classify_with_ai(unresolved, expense_cat_names, cat_by_name, counts, settings)

    return counts


def reclassify_all(db: Session, include_manual: bool = False) -> dict:
    """Re-run the pipeline over stored transactions. Manual edits are preserved
    unless include_manual=True. Used after editing merchant rules."""
    stmt = select(Transaction)
    if not include_manual:
        stmt = stmt.where(Transaction.classified_by != "manual")
    txns = db.scalars(stmt).all()
    for t in txns:  # reset so the pipeline re-decides from scratch
        t.category_id = None
        t.subcategory = None
        t.classified_by = "unclassified"
        t.needs_review = False
    counts = classify_transactions(db, txns)
    db.commit()
    counts["total"] = len(txns)
    return counts


def _assign(t: Transaction, cat: Category, sub: str | None, method: str) -> None:
    t.category_id = cat.id
    t.subcategory = sub
    t.classified_by = method
    t.needs_review = method in ("ai", "unclassified") and abs(t.amount) >= REVIEW_AMOUNT_THRESHOLD


def _classify_with_ai(unresolved, cat_names, cat_by_name, counts, settings) -> None:
    provider = _build_provider()
    payees = list(unresolved.keys())

    results: list[str | None] = [None] * len(payees)
    if provider is not None and provider.available():
        results = provider.classify_batch(payees, cat_names)
    elif provider is not None and not settings.ai_graceful_fallback:
        # Explicit opt-out of fallback: still don't raise, just leave unclassified.
        pass

    for payee, cat_name in zip(payees, results):
        txns = unresolved[payee]
        if cat_name and cat_name in cat_by_name:
            for t in txns:
                _assign(t, cat_by_name[cat_name], None, "ai")
                t.needs_review = abs(t.amount) >= REVIEW_AMOUNT_THRESHOLD
            counts["ai"] += len(txns)
        else:
            for t in txns:
                t.classified_by = "unclassified"
                t.needs_review = True
            counts["unclassified"] += len(txns)
