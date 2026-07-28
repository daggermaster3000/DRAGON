import { useEffect, useMemo, useState } from "react";
import { api, CHF, type DayPoint, type Transaction } from "../api";
import { ErrorBox } from "./DashboardView";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Monday-first weekday index (0=Mon … 6=Sun).
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function CalendarView({ refreshKey }: { refreshKey: number }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based
  const [days, setDays] = useState<DayPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dayTxns, setDayTxns] = useState<Transaction[]>([]);

  useEffect(() => {
    setSelected(null);
    setDayTxns([]);
    api.statsDaily(year, month).then((r) => setDays(r.days)).catch((e) => setError(e.message));
  }, [year, month, refreshKey]);

  const byDate = useMemo(() => Object.fromEntries(days.map((d) => [d.date, d])), [days]);
  const maxExpense = useMemo(() => Math.max(1, ...days.map((d) => d.expense)), [days]);

  // Build the grid cells (leading blanks + all days of month).
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const lead = mondayIndex(first);
  const cells: (number | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    const m = month - 1 + delta;
    setYear(year + Math.floor(m / 12));
    setMonth(((m % 12) + 12) % 12 + 1);
  }

  function pick(day: number) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSelected(iso);
    api.transactions({ date_from: iso, date_to: iso, limit: 100 }).then(setDayTxns).catch((e) => setError(e.message));
  }

  if (error) return <ErrorBox msg={error} />;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => shift(-1)} className="rounded-md px-3 py-1.5 text-sm text-ink-soft hover:bg-black/5">‹ Prev</button>
        <h2 className="text-sm font-semibold text-ink">{MONTHS[month - 1]} {year}</h2>
        <button onClick={() => shift(1)} className="rounded-md px-3 py-1.5 text-sm text-ink-soft hover:bg-black/5">Next ›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 rounded-2xl border border-black/10 bg-surface p-2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-ink-muted">{w}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dp = byDate[iso];
          const intensity = dp ? dp.expense / maxExpense : 0;
          const isSel = selected === iso;
          return (
            <button
              key={i}
              onClick={() => pick(day)}
              className={`relative flex aspect-square flex-col items-center justify-start rounded-lg border p-1 text-left transition ${
                isSel ? "border-ink" : "border-black/5 hover:border-black/20"
              }`}
              style={{ background: dp ? `rgba(208,59,59,${0.06 + intensity * 0.28})` : "transparent" }}
            >
              <span className="text-[11px] text-ink-soft">{day}</span>
              {dp && (
                <span className="mt-auto w-full truncate text-center text-[9px] tabular-nums text-ink">
                  {CHF(dp.expense)}
                </span>
              )}
              {dp && dp.income > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-hp-good" />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-muted">Redder = higher spend that day · green dot = income received. Tap a day for details.</p>

      {selected && (
        <div className="mt-4 rounded-2xl border border-black/10 bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold text-ink">{selected}</h3>
          {dayTxns.length === 0 ? (
            <p className="text-sm text-ink-muted">No transactions this day.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {dayTxns.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink">{t.payee || "—"}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{t.category_name || "—"}</span>
                  <span className={`w-20 shrink-0 text-right tabular-nums ${t.amount >= 0 ? "text-hp-good" : "text-ink"}`}>
                    {t.amount >= 0 ? "+" : ""}{CHF(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
