import { useMemo, useState } from "react";
import { api, CHF, type Category, type Transaction } from "../api";

interface Part {
  amount: string;
  category_id: number;
}

export function SplitModal({
  txn,
  categories,
  onClose,
  onDone,
}: {
  txn: Transaction;
  categories: Category[];
  onClose: () => void;
  onDone: () => void;
}) {
  const expenseCats = useMemo(() => categories.filter((c) => c.kind === "expense"), [categories]);
  const defaultCat = txn.category_id ?? expenseCats[0]?.id ?? 0;
  const [parts, setParts] = useState<Part[]>([
    { amount: (txn.amount / 2).toFixed(2), category_id: defaultCat },
    { amount: (txn.amount - Number((txn.amount / 2).toFixed(2))).toFixed(2), category_id: defaultCat },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sum = parts.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remainder = Number((txn.amount - sum).toFixed(2));
  const balanced = Math.abs(remainder) <= 0.01;

  function setPart(i: number, patch: Partial<Part>) {
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function addPart() {
    setParts((prev) => [...prev, { amount: remainder ? remainder.toFixed(2) : "0", category_id: defaultCat }]);
  }
  function removePart(i: number) {
    setParts((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  async function submit() {
    setError(null);
    if (!balanced) {
      setError(`Parts must sum to ${CHF(txn.amount)} (off by ${CHF(remainder)}).`);
      return;
    }
    setBusy(true);
    try {
      await api.splitTransaction(txn.id, parts.map((p) => ({ amount: Number(p.amount), category_id: p.category_id })));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Split failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-ink">Split transaction</h2>
        <p className="mt-0.5 mb-3 text-xs text-ink-muted">{txn.payee} · {CHF(txn.amount)} · {txn.date}</p>

        <div className="space-y-2">
          {parts.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={p.amount}
                onChange={(e) => setPart(i, { amount: e.target.value })}
                className="w-24 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm tabular-nums"
              />
              <select
                value={p.category_id}
                onChange={(e) => setPart(i, { category_id: Number(e.target.value) })}
                className="flex-1 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs text-ink-soft"
              >
                {expenseCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button onClick={() => removePart(i)} disabled={parts.length <= 2} className="text-ink-muted hover:text-hp-danger disabled:opacity-30" aria-label="remove part">✕</button>
            </div>
          ))}
        </div>

        <button onClick={addPart} className="mt-2 text-xs text-ink-soft hover:text-ink">＋ Add part</button>

        <div className={`mt-3 text-xs ${balanced ? "text-hp-good" : "text-hp-danger"}`}>
          {balanced ? "Balanced ✓" : `Remaining: ${CHF(remainder)}`}
        </div>
        {error && <div className="mt-2 text-xs text-hp-danger">{error}</div>}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:bg-black/5">Cancel</button>
          <button onClick={submit} disabled={busy || !balanced} className="rounded-lg bg-ink px-4 py-1.5 text-sm text-white hover:bg-ink/85 disabled:opacity-50">
            {busy ? "Splitting…" : "Split"}
          </button>
        </div>
      </div>
    </div>
  );
}
