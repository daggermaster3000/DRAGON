import { useEffect, useMemo, useState } from "react";
import { api, CHF, type Category } from "../api";
import { ErrorBox } from "./DashboardView";

export function BudgetView({ onChanged }: { onChanged: () => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newBudget, setNewBudget] = useState("");

  function load() {
    api.categories().then(setCats).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  const expense = useMemo(() => cats.filter((c) => c.kind === "expense"), [cats]);
  const income = useMemo(() => cats.filter((c) => c.kind === "income"), [cats]);
  const totalExpense = expense.reduce((s, c) => s + c.monthly_budget, 0);
  const totalIncome = income.reduce((s, c) => s + c.monthly_budget, 0);
  const plannedNet = totalIncome - totalExpense;

  async function saveBudget(c: Category, value: string) {
    const n = Number(value);
    if (Number.isNaN(n) || n === c.monthly_budget) return;
    try {
      await api.updateCategory(c.id, { monthly_budget: n });
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function rename(c: Category, value: string) {
    const name = value.trim();
    if (!name || name === c.name) return;
    try {
      await api.updateCategory(c.id, { name });
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      load();
    }
  }

  async function remove(c: Category) {
    if (!confirm(`Delete "${c.name}"? Its transactions become uncategorized (flagged for review).`)) return;
    await api.deleteCategory(c.id);
    load();
    onChanged();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.createCategory(newName.trim(), Number(newBudget) || 0);
      setNewName("");
      setNewBudget("");
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div>
      {error && <div className="mb-3"><ErrorBox msg={error} /></div>}

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Tot label="Income / mo" value={CHF(totalIncome)} />
        <Tot label="Expense budget / mo" value={CHF(totalExpense)} />
        <Tot label="Planned savings / mo" value={(plannedNet >= 0 ? "+" : "") + CHF(plannedNet)} good={plannedNet >= 0} />
      </div>

      <Group title="Expense categories" cats={expense} onBudget={saveBudget} onRename={rename} onRemove={remove} />

      <form onSubmit={add} className="mb-6 mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-black/10 bg-surface p-3">
        <label className="flex-1 min-w-[140px] text-xs text-ink-muted">
          New category
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Coffee habit"
            className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-ink/30" />
        </label>
        <label className="w-28 text-xs text-ink-muted">
          Budget / mo
          <input value={newBudget} onChange={(e) => setNewBudget(e.target.value)} type="number" step="1" placeholder="0"
            className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm tabular-nums" />
        </label>
        <button className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85">Add</button>
      </form>

      <Group title="Income categories" cats={income} onBudget={saveBudget} onRename={rename} onRemove={remove} />
      <p className="mt-2 text-xs text-ink-muted">Edits update your lifebars and the plan-tracking targets immediately.</p>
    </div>
  );
}

function Group({
  title, cats, onBudget, onRename, onRemove,
}: {
  title: string;
  cats: Category[];
  onBudget: (c: Category, v: string) => void;
  onRename: (c: Category, v: string) => void;
  onRemove: (c: Category) => void;
}) {
  return (
    <div className="mb-4">
      <h2 className="mb-2 text-sm font-semibold text-ink">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-surface">
        <ul className="divide-y divide-black/5">
          {cats.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2">
              <input
                defaultValue={c.name}
                onBlur={(e) => onRename(c, e.target.value)}
                className="min-w-0 flex-1 rounded bg-transparent px-1 py-1 text-sm text-ink outline-none focus:bg-black/5"
              />
              <div className="flex shrink-0 items-center gap-1 text-sm text-ink-soft">
                <span className="text-xs text-ink-muted">CHF</span>
                <input
                  defaultValue={c.monthly_budget}
                  type="number"
                  step="1"
                  onBlur={(e) => onBudget(c, e.target.value)}
                  className="w-20 rounded border border-black/10 bg-white px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-ink/30"
                />
                <span className="text-xs text-ink-muted">/mo</span>
              </div>
              <button onClick={() => onRemove(c)} className="shrink-0 text-ink-muted hover:text-hp-danger" aria-label="delete category">✕</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Tot({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-black/10 bg-surface px-3 py-2.5">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className={`mt-0.5 text-base font-semibold tabular-nums ${good ? "text-hp-good" : "text-ink"}`}>{value}</div>
    </div>
  );
}
