import { useEffect, useMemo, useState } from "react";
import { api, CHF, type Category, type Subcategory } from "../api";
import { ErrorBox } from "./DashboardView";
import { TIMEFRAMES, type Timeframe } from "../theme";
import { OracleModal } from "../components/OracleModal";

const FACTOR: Record<Timeframe, number> = { monthly: 1, quarterly: 3, annual: 12 };
const SUFFIX: Record<Timeframe, string> = { monthly: "/mo", quarterly: "/qtr", annual: "/yr" };

export function BudgetView({ onChanged }: { onChanged: () => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [timeframe, setTimeframe] = useState<Timeframe>("monthly");
  const [oracle, setOracle] = useState(false);
  const factor = FACTOR[timeframe];

  function load() {
    api.categories().then(setCats).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  const expense = useMemo(() => cats.filter((c) => c.kind === "expense"), [cats]);
  const income = useMemo(() => cats.filter((c) => c.kind === "income"), [cats]);
  const totalExpense = expense.reduce((s, c) => s + c.monthly_budget, 0) * factor;
  const totalIncome = income.reduce((s, c) => s + c.monthly_budget, 0) * factor;
  const plannedNet = totalIncome - totalExpense;

  function replaceCat(updated: Category) {
    setCats((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    onChanged();
  }

  async function fail<T>(p: Promise<T>) {
    try { return await p; } catch (e) { setError(e instanceof Error ? e.message : "Failed"); throw e; }
  }

  async function rename(c: Category, value: string) {
    const name = value.trim();
    if (!name || name === c.name) return;
    replaceCat(await fail(api.updateCategory(c.id, { name })));
  }

  async function remove(c: Category) {
    if (!confirm(`Delete "${c.name}"? Its transactions become uncategorized (flagged for review).`)) return;
    await fail(api.deleteCategory(c.id));
    load();
    onChanged();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await fail(api.createCategory(newName.trim(), 0));
    setNewName("");
    load();
    onChanged();
  }

  async function resetToDefaults() {
    if (!confirm("Reset all budgets and line items to your Budget-Tool defaults?\n\nYour transactions and custom categories are kept — only budget amounts and subcategories are restored.")) return;
    await fail(api.resetBudget());
    load();
    onChanged();
  }

  return (
    <div>
      {error && <div className="mb-3"><ErrorBox msg={error} /></div>}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-black/10 bg-surface p-0.5">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTimeframe(t.key)}
              className={`rounded-md px-3 py-1 text-xs transition ${
                timeframe === t.key ? "bg-ink text-white" : "text-ink-soft hover:bg-black/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setOracle(true)}
            className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-ink/85"
          >
            🔮 Budget oracle
          </button>
          <button
            onClick={resetToDefaults}
            className="shrink-0 rounded-lg border border-black/10 px-3 py-1.5 text-xs text-ink-soft hover:bg-black/5"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        <Tot label={`Income ${SUFFIX[timeframe]}`} value={CHF(totalIncome)} />
        <Tot label={`Expenses ${SUFFIX[timeframe]}`} value={CHF(totalExpense)} />
        <Tot label="Planned savings" value={(plannedNet >= 0 ? "+" : "") + CHF(plannedNet)} good={plannedNet >= 0} />
      </div>
      <p className="mb-4 text-xs text-ink-muted">
        From your Budget-Tool. Amounts shown {SUFFIX[timeframe]}. Tap a category to edit its line items (incl. Reserves &amp; Savings). Its total is the sum of its lines.
      </p>

      <h2 className="mb-2 text-sm font-semibold text-ink">Expense categories</h2>
      <div className="mb-4 space-y-2">
        {expense.map((c) => (
          <CategoryRow key={c.id} cat={c} factor={factor} suffix={SUFFIX[timeframe]} onRename={rename} onRemove={remove} onSaved={replaceCat} onError={setError} />
        ))}
      </div>

      <form onSubmit={addCategory} className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-black/10 bg-surface p-3">
        <label className="flex-1 min-w-[140px] text-xs text-ink-muted">
          New category
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Coffee habit"
            className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-ink/30" />
        </label>
        <button className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85">Add</button>
      </form>

      <h2 className="mb-2 text-sm font-semibold text-ink">Income categories</h2>
      <div className="space-y-2">
        {income.map((c) => (
          <CategoryRow key={c.id} cat={c} factor={factor} suffix={SUFFIX[timeframe]} onRename={rename} onRemove={remove} onSaved={replaceCat} onError={setError} />
        ))}
      </div>

      {oracle && (
        <OracleModal
          onClose={() => setOracle(false)}
          onApplied={() => { setOracle(false); load(); onChanged(); }}
        />
      )}
    </div>
  );
}

function CategoryRow({
  cat, factor, suffix, onRename, onRemove, onSaved, onError,
}: {
  cat: Category;
  factor: number;
  suffix: string;
  onRename: (c: Category, v: string) => void;
  onRemove: (c: Category) => void;
  onSaved: (c: Category) => void;
  onError: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [subs, setSubs] = useState<Subcategory[]>(cat.subcategories);
  const [saving, setSaving] = useState(false);

  // Keep local subs in sync if parent replaces the category (e.g. after save).
  useEffect(() => setSubs(cat.subcategories), [cat.subcategories]);

  const localTotal = subs.reduce((s, x) => s + (Number(x.monthly_budget) || 0), 0) * factor;

  async function save(next: Subcategory[]) {
    setSaving(true);
    try {
      const updated = await api.setSubcategories(cat.id, next.map((s) => ({
        name: s.name, monthly_budget: Number(s.monthly_budget) || 0,
      })));
      onSaved(updated);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  function setSub(i: number, patch: Partial<Subcategory>) {
    setSubs((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-surface">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 text-ink-muted transition hover:text-ink"
          aria-label={open ? "collapse" : "expand"}
        >
          <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        </button>
        <input
          defaultValue={cat.name}
          onBlur={(e) => onRename(cat, e.target.value)}
          className="min-w-0 flex-1 rounded bg-transparent px-1 py-1 text-sm text-ink outline-none focus:bg-black/5"
        />
        <span className="shrink-0 text-sm font-medium tabular-nums text-ink-soft">{CHF(cat.monthly_budget * factor)}</span>
        <span className="shrink-0 text-[10px] text-ink-muted">{suffix}</span>
        <button onClick={() => onRemove(cat)} className="shrink-0 text-ink-muted hover:text-hp-danger" aria-label="delete category">✕</button>
      </div>

      {open && (
        <div className="border-t border-black/5 bg-black/[0.015] px-3 py-2">
          <div className="space-y-1">
            {subs.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={s.name}
                  onChange={(e) => setSub(i, { name: e.target.value })}
                  onBlur={() => save(subs)}
                  className="min-w-0 flex-1 rounded bg-transparent px-1 py-1 text-xs text-ink-soft outline-none focus:bg-black/5"
                />
                <span className="shrink-0 text-[10px] text-ink-muted">CHF</span>
                <input
                  type="number"
                  step="1"
                  value={Math.round(s.monthly_budget * factor)}
                  onChange={(e) => setSub(i, { monthly_budget: (Number(e.target.value) || 0) / factor })}
                  onBlur={() => save(subs)}
                  className="w-20 shrink-0 rounded border border-black/10 bg-white px-2 py-1 text-right text-xs tabular-nums outline-none focus:border-ink/30"
                />
                <button
                  onClick={() => { const next = subs.filter((_, idx) => idx !== i); setSubs(next); save(next); }}
                  className="shrink-0 text-ink-muted hover:text-hp-danger"
                  aria-label="delete line"
                >✕</button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => setSubs((prev) => [...prev, { name: "New line", monthly_budget: 0 }])}
              className="text-xs text-ink-soft hover:text-ink"
            >＋ Add line</button>
            <span className="text-[11px] text-ink-muted">
              {saving ? "Saving…" : `Sum: ${CHF(localTotal)}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Tot({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-black/10 bg-surface px-3 py-2.5">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums sm:text-base ${good ? "text-hp-good" : "text-ink"}`}>{value}</div>
    </div>
  );
}
