import { useEffect, useMemo, useState } from "react";
import { api, type Category, type Rule } from "../api";
import { ErrorBox } from "./DashboardView";

export function RulesView({ onReclassified }: { onReclassified: () => void }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [contains, setContains] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const expenseCats = useMemo(() => cats.filter((c) => c.kind === "expense"), [cats]);

  function loadRules() {
    api.rules().then(setRules).catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadRules();
    api.categories().then((c) => {
      setCats(c);
      if (!categoryName && c.length) setCategoryName(c.find((x) => x.kind === "expense")?.name ?? c[0].name);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!contains.trim() || !categoryName) return;
    try {
      await api.createRule(contains.trim(), categoryName);
      setContains("");
      loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function remove(id: number) {
    await api.deleteRule(id);
    loadRules();
  }

  async function apply() {
    setApplying(true);
    setNote(null);
    try {
      const c = await api.applyRules();
      setNote(`Reclassified ${c.total}: ${c.rule} by rule, ${c.bank} by bank, ${c.ai} by AI, ${c.unclassified} left for review.`);
      onReclassified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div>
      {error && <div className="mb-3"><ErrorBox msg={error} /></div>}

      <form onSubmit={add} className="mb-4 rounded-2xl border border-black/10 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">New rule</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[150px] text-xs text-ink-muted">
            If payee contains
            <input
              value={contains}
              onChange={(e) => setContains(e.target.value)}
              placeholder="e.g. Migros"
              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/30"
            />
          </label>
          <span className="pb-2 text-ink-muted">→</span>
          <label className="flex-1 min-w-[150px] text-xs text-ink-muted">
            Category
            <select
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink"
            >
              {expenseCats.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <button className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85">Add</button>
        </div>
      </form>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Rules ({rules.length})</h2>
        <button
          onClick={apply}
          disabled={applying}
          className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm text-ink hover:bg-black/5 disabled:opacity-50"
        >
          {applying ? "Applying…" : "Apply to all transactions"}
        </button>
      </div>
      {note && <div className="mb-3 rounded-lg border border-hp-good/30 bg-hp-good/10 px-3 py-2 text-sm text-ink-soft">{note}</div>}

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-surface">
        <ul className="divide-y divide-black/5">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-4 py-2 text-sm">
              <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs text-ink">{r.contains}</code>
              <span className="text-ink-muted">→</span>
              <span className="flex-1 truncate text-ink-soft">{r.category_name}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${r.source === "user" ? "bg-[#7a5cc0]/15 text-[#7a5cc0]" : "bg-black/5 text-ink-muted"}`}>
                {r.source}
              </span>
              <button onClick={() => remove(r.id)} className="text-ink-muted hover:text-hp-danger" aria-label="delete rule">✕</button>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-2 text-xs text-ink-muted">User rules take precedence over seed rules and the bank's categories. Manual edits are never overwritten.</p>
    </div>
  );
}
