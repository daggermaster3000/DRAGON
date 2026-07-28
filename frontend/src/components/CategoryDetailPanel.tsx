import { useEffect, useMemo, useState } from "react";
import { api, CHF, type Category, type CategoryDetail } from "../api";

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

export function CategoryDetailPanel({
  categoryId,
  timeframe = "monthly",
  onClose,
  onChanged,
}: {
  categoryId: number;
  timeframe?: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  const expenseCats = useMemo(() => cats.filter((c) => c.kind === "expense"), [cats]);
  const mySubs = useMemo(() => {
    const c = cats.find((x) => x.id === categoryId);
    return c ? [...new Set(c.subcategories.map((s) => s.name))] : [];
  }, [cats, categoryId]);

  function reload() {
    api.categoryDetail(categoryId, timeframe).then(setDetail).catch((e) => setError(e.message));
  }

  useEffect(() => {
    setDetail(null);
    setEditId(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, timeframe]);

  useEffect(() => {
    api.categories().then(setCats).catch(() => setCats([]));
  }, []);

  async function moveCategory(txnId: number, newCatId: number) {
    await api.updateTransaction(txnId, { category_id: newCatId, subcategory: "" });
    reload();
    onChanged?.();
  }
  async function setSub(txnId: number, sub: string) {
    await api.updateTransaction(txnId, { subcategory: sub });
    reload();
    onChanged?.();
  }

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
            <span className="font-medium text-ink">{CHF(detail.spent)}</span> of {CHF(detail.budget)} budget
          </div>

          {detail.subcategories.length > 0 && (
            <div className="mb-4">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Subcategories</div>
              {detail.subcategories.map((s, i) => <SubBar key={`${s.name}-${i}`} {...s} />)}
            </div>
          )}

          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Transactions ({detail.transactions.length})
          </div>
          {detail.transactions.length === 0 ? (
            <p className="py-3 text-sm text-ink-muted">None in this period.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-black/5 overflow-y-auto">
              {detail.transactions.map((t) => (
                <li key={t.id} className="py-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-11 shrink-0 text-xs text-ink-muted tabular-nums">{t.date.slice(5)}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{t.payee || "—"}</span>
                    <button
                      onClick={() => setEditId(editId === t.id ? null : t.id)}
                      className={`shrink-0 text-[11px] ${editId === t.id ? "text-ink" : "text-ink-muted hover:text-ink"}`}
                    >
                      {t.subcategory || "edit"} ▾
                    </button>
                    <span className="w-[64px] shrink-0 text-right tabular-nums text-ink">{CHF(t.amount)}</span>
                  </div>
                  {editId === t.id && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-11">
                      <select
                        value={t.subcategory ?? ""}
                        onChange={(e) => setSub(t.id, e.target.value)}
                        className="min-w-[130px] flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-ink-soft"
                      >
                        <option value="">— subcategory —</option>
                        {mySubs.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <select
                        value={categoryId}
                        onChange={(e) => moveCategory(t.id, Number(e.target.value))}
                        className="min-w-[130px] flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-ink-soft"
                        title="Move to another category"
                      >
                        {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
