"""Bank statement parser. Ported from analyze_spending.py.

Pluggable by design: `parse_file` dispatches on detected format so future bank
formats can be added as new parser functions returning the same row schema.

Normalized row schema (one dict per transaction):
    date (datetime.date), payee (str), amount (float, +income/-expense),
    currency (str), account (str), bank_category (str|None)
"""
from __future__ import annotations

import hashlib
import io
from datetime import date

import pandas as pd

# Columns that identify the "Assistant financier" export header row.
AF_HEADER_MARKERS = {"Date", "Montant", "Catégorie"}


class ParseError(Exception):
    pass


def dedup_hash(d: date, payee: str, amount: float, account: str) -> str:
    raw = f"{d.isoformat()}|{payee.strip().lower()}|{amount:.2f}|{account.strip().lower()}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _find_header_row(raw: pd.DataFrame) -> int | None:
    for i in range(min(30, len(raw))):
        row_vals = {str(v) for v in raw.iloc[i].tolist()}
        if AF_HEADER_MARKERS.issubset(row_vals):
            return i
    return None


def parse_assistant_financier(content: bytes) -> list[dict]:
    buf = io.BytesIO(content)
    raw = pd.read_excel(buf, header=None)
    header_row = _find_header_row(raw)
    if header_row is None:
        raise ParseError("Could not locate header row (expected Date/Montant/Catégorie).")

    buf.seek(0)
    df = pd.read_excel(buf, header=header_row)
    df = df.dropna(subset=["Date", "Montant"]).copy()
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Date"])

    # Internal transfers between own accounts net to zero -> exclude from cash flow.
    if "Bénéficiaire" in df.columns:
        is_transfer = df["Bénéficiaire"].astype(str).str.startswith("Transfert", na=False)
        df = df[~is_transfer]

    def _clean(v) -> str:
        if v is None or (isinstance(v, float) and pd.isna(v)):
            return ""
        return " ".join(str(v).split()).strip()

    rows: list[dict] = []
    for _, r in df.iterrows():
        payee = str(r.get("Bénéficiaire", "") or "").strip()
        bank_cat = r.get("Catégorie")
        bank_cat = None if pd.isna(bank_cat) else str(bank_cat).strip()
        # Payment narrative / comments the bank attaches — useful context for the
        # user and for AI classification. In this export the description sits in
        # "Référence"; other columns are usually empty but harmless to include.
        seen_parts: list[str] = []
        for col in ("Référence", "Informations de paiement", "Commentaire"):
            val = _clean(r.get(col))
            if val and val != payee and val not in seen_parts:
                seen_parts.append(val)
        info = " · ".join(seen_parts) or None
        rows.append({
            "date": r["Date"].date(),
            "payee": payee,
            "amount": round(float(r["Montant"]), 2),
            "currency": str(r.get("Devise", "CHF") or "CHF").strip(),
            "account": str(r.get("Compte", "") or "").strip(),
            "bank_category": bank_cat,
            "info": info,
        })
    return rows


def parse_file(filename: str, content: bytes) -> list[dict]:
    """Detect format and parse. Extend here for new bank formats."""
    try:
        return parse_assistant_financier(content)
    except ParseError:
        raise
    except Exception as e:  # noqa: BLE001 - surface a clean error to the API
        raise ParseError(f"Failed to parse '{filename}': {e}") from e
