#!/usr/bin/env python3
"""
Extract the canonical budget from Budget-Tool.xlsm (Hilfstabelle sheet) into
budget_seed.json, the file the backend uses to seed a fresh database.

Run this again whenever Budget-Tool.xlsm changes:
    python3 generate_seed.py "../../../../Budget-Tool.xlsm"

The seed also carries:
  - bank_category_map: maps the bank export's French categories to budget
    categories (deterministic first-pass classification, no AI needed).
  - merchant_rules: default substring rules for common Swiss merchants.
"""
import json
import sys
from pathlib import Path

import openpyxl

# Bank export (French "Assistant financier") category -> budget category +
# a default subcategory (the bank's categories are essentially line-items).
# {"category": None} means "ambiguous, hand to the classifier / leave for review".
# subcategory None -> category assigned, but line-item left for manual choice.
BANK_CATEGORY_MAP = {
    "Courses": {"category": "Groceries", "subcategory": "Groceries and beverages"},
    "Restauration": {"category": "Groceries", "subcategory": "Dining out (restaurants, canteens)"},
    "Loyer et hypothèque": {"category": "Housing", "subcategory": "Rent"},
    "Amélioration de l'habitat": {"category": "Housing", "subcategory": "Maintenance and smaller repairs"},
    "Voiture": {"category": "Car and motorcycle", "subcategory": None},
    "Transports publics": {"category": "Mobility", "subcategory": "Public transportation passes"},
    "Loisirs": {"category": "Leisure and holidays", "subcategory": "Events, clubs, bars, cinemas"},
    "Voyages": {"category": "Leisure and holidays", "subcategory": "Holidays and excursions"},
    "Soins personnels": {"category": "Health and personal care", "subcategory": "Personal hygiene"},
    "Pharmacie et droguerie": {"category": "Health and personal care", "subcategory": "Personal hygiene"},
    "Médecins et services de santé": {"category": "Health and personal care", "subcategory": None},
    "Assurance-maladie": {"category": "Health and personal care", "subcategory": "Mandatory health insurance"},
    "Impôts": {"category": "Taxes", "subcategory": None},
    "Shopping": {"category": "Other", "subcategory": "Consumer goods"},
    "Services": {"category": "Communication and entertainment", "subcategory": None},
    "Général": {"category": None, "subcategory": None},
    "Paiements": {"category": None, "subcategory": None},
    "Retraits": {"category": "Other", "subcategory": "Other expenses"},
    "Remboursements": {"category": "Other", "subcategory": None},
    "Épargne et placements": {"category": "Reserves", "subcategory": None},
    # Income-side bank categories
    "Salaire": {"category": "Erwerbseinkommen", "subcategory": "Net salary"},
    "Autres revenus": {"category": "Übriges", "subcategory": "Other income"},
}

# Default merchant substring rules (case-insensitive). First match wins.
# category is the budget Category the transaction is forced into.
MERCHANT_RULES = [
    {"contains": "migros", "category": "Groceries", "subcategory": "Groceries and beverages"},
    {"contains": "coop", "category": "Groceries", "subcategory": "Groceries and beverages"},
    {"contains": "denner", "category": "Groceries", "subcategory": "Groceries and beverages"},
    {"contains": "lidl", "category": "Groceries", "subcategory": "Groceries and beverages"},
    {"contains": "aldi", "category": "Groceries", "subcategory": "Groceries and beverages"},
    {"contains": "mensa", "category": "Groceries", "subcategory": "Dining out (restaurants, canteens)"},
    {"contains": "cafeteria", "category": "Groceries", "subcategory": "Dining out (restaurants, canteens)"},
    {"contains": "restaurant", "category": "Groceries", "subcategory": "Dining out (restaurants, canteens)"},
    {"contains": "mcdonald", "category": "Groceries", "subcategory": "Dining out (restaurants, canteens)"},
    {"contains": "popeyes", "category": "Groceries", "subcategory": "Dining out (restaurants, canteens)"},
    {"contains": "sbb", "category": "Mobility", "subcategory": "Public transportation single tickets"},
    {"contains": "cff", "category": "Mobility", "subcategory": "Public transportation single tickets"},
    {"contains": "zvv", "category": "Mobility", "subcategory": "Public transportation passes"},
    {"contains": "swisscom", "category": "Communication and entertainment", "subcategory": "Mobile plans, prepaid mobile"},
    {"contains": "salt", "category": "Communication and entertainment", "subcategory": "Mobile plans, prepaid mobile"},
    {"contains": "sunrise", "category": "Communication and entertainment", "subcategory": "Mobile plans, prepaid mobile"},
    {"contains": "netflix", "category": "Communication and entertainment", "subcategory": "Streaming and TV plans"},
    {"contains": "spotify", "category": "Communication and entertainment", "subcategory": "Streaming and TV plans"},
    {"contains": "serafe", "category": "Communication and entertainment", "subcategory": "Serafe fee"},
    {"contains": "pharmacie", "category": "Health and personal care", "subcategory": "Personal hygiene"},
    {"contains": "apotheke", "category": "Health and personal care", "subcategory": "Personal hygiene"},
]


def extract(xlsm_path: Path) -> dict:
    wb = openpyxl.load_workbook(xlsm_path, data_only=True)
    ws = wb["Hilfstabelle"]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]

    expenses: dict[str, dict] = {}
    income: dict[str, dict] = {}
    for r in rows:
        if not r or r[0] is None or str(r[0]) == "Oberkategorie":
            continue
        top = str(r[0])
        category = r[1]
        subcategory = r[2]
        monthly = r[3] if len(r) > 3 and isinstance(r[3], (int, float)) else 0
        monthly = round(float(monthly or 0), 2)
        target = expenses if top == "Expenses" else income if top == "Einnahmen" else None
        if target is None:
            continue
        bucket = target.setdefault(category, {"category": category, "monthly_budget": 0.0, "subcategories": []})
        bucket["monthly_budget"] = round(bucket["monthly_budget"] + monthly, 2)
        bucket["subcategories"].append({"name": subcategory, "monthly_budget": monthly})

    return {
        "expense_categories": list(expenses.values()),
        "income_categories": list(income.values()),
        "bank_category_map": BANK_CATEGORY_MAP,
        "merchant_rules": MERCHANT_RULES,
    }


def main() -> None:
    here = Path(__file__).resolve().parent
    default = here / ".." / ".." / ".." / ".." / "Budget-Tool.xlsm"
    xlsm = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else default.resolve()
    if not xlsm.exists():
        sys.exit(f"Budget-Tool.xlsm not found at {xlsm}")
    seed = extract(xlsm)
    out = here / "budget_seed.json"
    out.write_text(json.dumps(seed, ensure_ascii=False, indent=2), encoding="utf-8")
    n_exp = len(seed["expense_categories"])
    n_inc = len(seed["income_categories"])
    print(f"Wrote {out} — {n_exp} expense categories, {n_inc} income categories.")


if __name__ == "__main__":
    main()
