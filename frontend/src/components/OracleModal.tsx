import { useState } from "react";
import { api, CHF, type OracleProposal } from "../api";

export function OracleModal({ onClose, onApplied }: { onClose: () => void; onApplied: () => void }) {
  const [income, setIncome] = useState("");
  const [location, setLocation] = useState("");
  const [household, setHousehold] = useState("");
  const [goals, setGoals] = useState("");
  const [savingsRate, setSavingsRate] = useState("");
  const [proposal, setProposal] = useState<OracleProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function propose() {
    if (!Number(income)) { setError("Enter your monthly income."); return; }
    setBusy(true); setError(null);
    try {
      const p = await api.oraclePropose({
        income_monthly: Number(income),
        location, household, goals,
        savings_rate_target: savingsRate ? Number(savingsRate) : null,
      });
      setProposal(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  async function apply() {
    if (!proposal) return;
    setBusy(true); setError(null);
    try {
      await api.oracleApply(proposal.items.map((i) => ({ category: i.category, monthly_budget: i.monthly_budget, subcategories: i.subcategories })));
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-black/10 bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">🔮 Budget oracle</h2>
          <button onClick={onClose} className="text-sm text-ink-muted hover:text-ink" aria-label="close">✕</button>
        </div>
        <p className="mb-4 text-xs text-ink-muted">
          Tell the oracle about you. It keeps your fixed costs (rent, insurance, taxes) at what you actually spend and proposes the rest — groceries, leisure, savings, investing.
        </p>

        {!proposal ? (
          <div className="space-y-3">
            <Field label="Net monthly income (CHF)">
              <input type="number" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="5000"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Location (canton/city)">
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Zurich"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" />
              </Field>
              <Field label="Target savings rate (%)">
                <input type="number" value={savingsRate} onChange={(e) => setSavingsRate(e.target.value)} placeholder="20"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" />
              </Field>
            </div>
            <Field label="Household (renter/owner, car, family…)">
              <input value={household} onChange={(e) => setHousehold(e.target.value)} placeholder="renter, no car, single"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" />
            </Field>
            <Field label="Goals">
              <textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} placeholder="save for a house deposit, invest CHF 500/mo, build a 6-month emergency fund"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" />
            </Field>
            {error && <p className="text-xs text-hp-danger">{error}</p>}
            <button onClick={propose} disabled={busy}
              className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-50">
              {busy ? "Consulting the oracle…" : "🔮 Propose a budget"}
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <Mini label="Income" value={CHF(proposal.income_monthly)} />
              <Mini label="Budgeted" value={CHF(proposal.total_expense)} />
              <Mini label="Saves/mo" value={(proposal.planned_savings >= 0 ? "+" : "") + CHF(proposal.planned_savings)} good={proposal.planned_savings >= 0} />
            </div>
            <p className="mb-3 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-ink-soft">
              {proposal.rationale || "Proposed budget below."}
              {proposal.source === "fallback" && <span className="ml-1 text-ink-muted">(offline heuristic — enable the AI provider for a smarter plan)</span>}
            </p>
            <div className="mb-4 max-h-56 overflow-y-auto rounded-lg border border-black/10">
              <ul className="divide-y divide-black/5">
                {proposal.items.filter((i) => i.monthly_budget > 0).map((i) => (
                  <li key={i.category} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span className="text-ink">{i.category}</span>
                    <span className="tabular-nums text-ink-soft">{CHF(i.monthly_budget)}/mo</span>
                  </li>
                ))}
              </ul>
            </div>
            {error && <p className="mb-2 text-xs text-hp-danger">{error}</p>}
            <div className="flex justify-between gap-2">
              <button onClick={() => setProposal(null)} className="rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-black/5">← Edit inputs</button>
              <div className="flex gap-2">
                <button onClick={propose} disabled={busy} className="rounded-lg border border-black/10 px-3 py-2 text-sm text-ink-soft hover:bg-black/5 disabled:opacity-50">Regenerate</button>
                <button onClick={apply} disabled={busy} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-50">
                  {busy ? "Applying…" : "Apply budget"}
                </button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">Applying overwrites your category budgets. You can fine-tune afterwards in the Budget tab.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-ink-muted">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Mini({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-lg border border-black/10 px-2 py-1.5 text-center">
      <div className="text-[10px] text-ink-muted">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${good ? "text-hp-good" : "text-ink"}`}>{value}</div>
    </div>
  );
}
