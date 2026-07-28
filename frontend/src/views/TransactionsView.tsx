import { useEffect, useMemo, useState } from "react";
import { api, CHF, type Category, type Transaction } from "../api";
import { ErrorBox } from "./DashboardView";

const CLS_BADGE: Record<string, string> = {
  rule: "bg-hp-good/15 text-hp-good",
  bank: "bg-black/5 text-ink-soft",
  ai: "bg-[#7a5cc0]/15 text-[#7a5cc0]",
  manual: "bg-black/10 text-ink",
  unclassified: "bg-hp-warn/20 text-[#8a6a00]",
};

export function TransactionsView({ refreshKey }: { refreshKey: number }) {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const expenseCats = useMemo(() => cats.filter((c) => c.kind === "expense"), [cats]);

  useEffect(() => {
    api.categories().then(setCats).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api
        .transactions({ q, needs_review: reviewOnly || undefined, limit: 300 })
        .then(setTxns)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 200); // debounce search
    return () => clearTimeout(t);
  }, [q, reviewOnly, refreshKey]);

  async function changeCategory(id: number, category_id: number) {
    const updated = await api.updateTransaction(id, { category_id });
    setTxns((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  if (error) return <ErrorBox msg={error} />;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search payee…"
          className="flex-1 min-w-[160px] rounded-lg border border-black/10 bg-surface px-3 py-2 text-sm outline-none focus:border-ink/30"
        />
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />
          Needs review
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-surface">
        {loading && txns.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Loading…</p>
        ) : txns.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">No transactions.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {txns.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-16 shrink-0 text-xs text-ink-muted tabular-nums">
                  {t.date.slice(5)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-ink">{t.payee || "—"}</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${CLS_BADGE[t.classified_by] || "bg-black/5"}`}>
                      {t.classified_by}
                    </span>
                    {t.needs_review && <span className="text-[10px] text-hp-warn">● review</span>}
                  </div>
                </div>
                <select
                  value={t.category_id ?? ""}
                  onChange={(e) => changeCategory(t.id, Number(e.target.value))}
                  className="max-w-[42vw] shrink-0 rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-ink-soft sm:max-w-[180px]"
                >
                  <option value="" disabled>
                    Uncategorized
                  </option>
                  {expenseCats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className={`w-20 shrink-0 text-right text-sm tabular-nums ${t.amount >= 0 ? "text-hp-good" : "text-ink"}`}>
                  {t.amount >= 0 ? "+" : ""}
                  {CHF(t.amount)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-muted">Showing up to 300, newest first. Change a category to reclassify (marks it manual).</p>
    </div>
  );
}
