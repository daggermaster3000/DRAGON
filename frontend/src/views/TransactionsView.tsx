import { useEffect, useMemo, useState } from "react";
import { api, CHF, type Category, type Transaction } from "../api";
import { ErrorBox } from "./DashboardView";
import { SplitModal } from "../components/SplitModal";

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
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [bulkCat, setBulkCat] = useState<number | "">("");
  const [splitTxn, setSplitTxn] = useState<Transaction | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);
  const [note, setNote] = useState<string | null>(null);

  const expenseCats = useMemo(() => cats.filter((c) => c.kind === "expense"), [cats]);
  // category id -> its subcategory names (deduped for the picker)
  const subsByCat = useMemo(() => {
    const m: Record<number, string[]> = {};
    for (const c of cats) m[c.id] = [...new Set(c.subcategories.map((s) => s.name))];
    return m;
  }, [cats]);

  useEffect(() => {
    api.categories().then(setCats).catch((e) => setError(e.message));
  }, []);

  function reload() {
    setLoading(true);
    api
      .transactions({ q, needs_review: reviewOnly || undefined, limit: 300 })
      .then(setTxns)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const t = setTimeout(reload, 200); // debounce
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, reviewOnly, refreshKey, localRefresh]);

  async function changeCategory(id: number, category_id: number) {
    // Switching category invalidates the old subcategory -> clear it ("" = clear).
    const updated = await api.updateTransaction(id, { category_id, subcategory: "" });
    setTxns((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function changeSubcategory(id: number, subcategory: string) {
    const updated = await api.updateTransaction(id, { subcategory });
    setTxns((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  function toggle(id: number) {
    setSel((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function applyBulk() {
    if (bulkCat === "" || sel.size === 0) return;
    await api.bulkRecategorize([...sel], Number(bulkCat));
    setSel(new Set());
    setBulkCat("");
    setLocalRefresh((k) => k + 1);
  }

  async function undo() {
    try {
      const r = await api.undo();
      setNote(`Undid last ${r.undone}.`);
      setLocalRefresh((k) => k + 1);
      setTimeout(() => setNote(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nothing to undo");
    }
  }

  if (error) return <ErrorBox msg={error} />;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search payee…"
          className="flex-1 min-w-[140px] rounded-lg border border-black/10 bg-surface px-3 py-2 text-sm outline-none focus:border-ink/30"
        />
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />
          Needs review
        </label>
        <button onClick={undo} className="rounded-lg border border-black/10 px-3 py-2 text-sm text-ink-soft hover:bg-black/5">↩ Undo</button>
      </div>

      {note && <div className="mb-3 rounded-lg border border-hp-good/30 bg-hp-good/10 px-3 py-2 text-sm text-ink-soft">{note}</div>}

      {sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-ink/20 bg-ink/5 px-3 py-2">
          <span className="text-sm text-ink">{sel.size} selected</span>
          <select value={bulkCat} onChange={(e) => setBulkCat(e.target.value === "" ? "" : Number(e.target.value))} className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs">
            <option value="">Set category…</option>
            {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={applyBulk} disabled={bulkCat === ""} className="rounded-md bg-ink px-3 py-1 text-xs text-white disabled:opacity-40">Apply</button>
          <button onClick={() => setSel(new Set())} className="text-xs text-ink-muted hover:text-ink">Clear</button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-surface">
        {loading && txns.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Loading…</p>
        ) : txns.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">No transactions.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {txns.map((t) => (
              <li key={t.id} className={`flex items-start gap-2 px-3 py-2.5 ${sel.has(t.id) ? "bg-ink/5" : ""}`}>
                <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} className="mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  {/* line 1: payee + amount */}
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {t.payee || "—"}
                      {t.split_parent_id != null && <span className="ml-1 text-[10px] text-ink-muted">(split)</span>}
                    </span>
                    <span className={`shrink-0 text-sm tabular-nums ${t.amount >= 0 ? "text-hp-good" : "text-ink"}`}>
                      {t.amount >= 0 ? "+" : ""}{CHF(t.amount)}
                    </span>
                  </div>
                  {/* line 2: date · status · category · subcategory · split (wraps on mobile) */}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="shrink-0 text-[10px] text-ink-muted tabular-nums">{t.date.slice(5)}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${CLS_BADGE[t.classified_by] || "bg-black/5"}`}>{t.classified_by}</span>
                    {t.needs_review && <span className="shrink-0 text-[10px] text-hp-warn">●</span>}
                    <select
                      value={t.category_id ?? ""}
                      onChange={(e) => changeCategory(t.id, Number(e.target.value))}
                      className="min-w-[120px] flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-ink-soft"
                    >
                      <option value="" disabled>Uncategorized</option>
                      {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {t.category_id != null && (subsByCat[t.category_id]?.length ?? 0) > 0 && (
                      <select
                        value={t.subcategory ?? ""}
                        onChange={(e) => changeSubcategory(t.id, e.target.value)}
                        className="min-w-[120px] flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-ink-soft"
                      >
                        <option value="">— subcategory —</option>
                        {subsByCat[t.category_id].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    )}
                    {t.split_parent_id == null && (
                      <button onClick={() => setSplitTxn(t)} className="shrink-0 px-1 text-ink-muted hover:text-ink" title="Split">⑃</button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-muted">Select rows to bulk-recategorize · ⑃ to split · ↩ undoes the last change.</p>

      {splitTxn && (
        <SplitModal
          txn={splitTxn}
          categories={cats}
          onClose={() => setSplitTxn(null)}
          onDone={() => { setSplitTxn(null); setLocalRefresh((k) => k + 1); }}
        />
      )}
    </div>
  );
}
