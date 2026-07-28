import { useEffect, useState } from "react";
import { api, CHF, type CategoryDetail } from "../api";

// Mini sub-budget bar for a subcategory.
function SubBar({ name, budget, spent }: { name: string; budget: number; spent: number }) {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : spent > 0 ? 100 : 0;
  const over = budget > 0 && spent > budget;
  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-ink-soft">{name}</span>
        <span className={`text-[11px] tabular-nums ${over ? "text-hp-danger" : "text-ink-muted"}`}>
          {CHF(spent)}{budget > 0 && ` / ${CHF(budget)}`}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded bg-black/5">
        <div className={`h-full rounded ${over ? "bg-hp-danger" : pct >= 85 ? "bg-hp-warn" : "bg-hp-good"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CategoryDetailPanel({ categoryId, onClose }: { categoryId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    api.categoryDetail(categoryId).then(setDetail).catch((e) => setError(e.message));
  }, [categoryId]);

  return (
    <div className="mt-4 rounded-2xl border border-ink/20 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{detail ? detail.name : "Loading…"}</h3>
        <button onClick={onClose} className="text-sm text-ink-muted hover:text-ink" aria-label="close">✕</button>
      </div>

      {error && <p className="text-sm text-hp-danger">{error}</p>}

      {detail && (
        <>
          <div className="mb-3 text-xs text-ink-muted">
            This month: <span className="font-medium text-ink">{CHF(detail.spent)}</span> of {CHF(detail.budget)} budget
          </div>

          {detail.subcategories.length > 0 && (
            <div className="mb-4">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Subcategories</div>
              {detail.subcategories.map((s) => <SubBar key={s.name} {...s} />)}
            </div>
          )}

          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Transactions ({detail.transactions.length})
          </div>
          {detail.transactions.length === 0 ? (
            <p className="py-3 text-sm text-ink-muted">None this month.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-black/5 overflow-y-auto">
              {detail.transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="w-11 shrink-0 text-xs text-ink-muted tabular-nums">{t.date.slice(5)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{t.payee || "—"}</span>
                  {t.subcategory && <span className="hidden shrink-0 text-[11px] text-ink-muted sm:block">{t.subcategory}</span>}
                  <span className="w-[70px] shrink-0 text-right tabular-nums text-ink">{CHF(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
