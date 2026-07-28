import { useEffect, useState } from "react";
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Chart, Doughnut } from "react-chartjs-2";
import { api, CHF, type CategorySlice, type MonthPoint, type PlanHealth, type Subscription } from "../api";
import { ErrorBox } from "./DashboardView";

ChartJS.register(
  CategoryScale, LinearScale, BarController, BarElement, ArcElement,
  LineController, LineElement, PointElement, Tooltip, Legend,
);

// Brand-neutral, colorblind-safe categorical palette (matches the report tokens).
const PALETTE = ["#2a78d6", "#e34948", "#1baf7a", "#fab219", "#7a5cc0", "#ec835a", "#0ca30c", "#898781", "#256abf", "#d03b3b"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function StatsView({ refreshKey }: { refreshKey: number }) {
  const now = new Date();
  const [monthly, setMonthly] = useState<MonthPoint[]>([]);
  const [cats, setCats] = useState<CategorySlice[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [subTotal, setSubTotal] = useState(0);
  const [plan, setPlan] = useState<PlanHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Selected month for the category pie.
  const [catY, setCatY] = useState(now.getFullYear());
  const [catM, setCatM] = useState(now.getMonth() + 1);

  useEffect(() => {
    Promise.all([api.statsMonthly(12), api.subscriptions(), api.planHealth()])
      .then(([m, s, p]) => {
        setMonthly(m.series);
        setSubs(s.subscriptions);
        setSubTotal(s.total_monthly_equiv);
        setPlan(p);
      })
      .catch((e) => setError(e.message));
  }, [refreshKey]);

  useEffect(() => {
    api.statsCategories(catY, catM).then((c) => setCats(c.items)).catch((e) => setError(e.message));
  }, [catY, catM, refreshKey]);

  function shiftCatMonth(delta: number) {
    const idx = catM - 1 + delta;
    setCatY(catY + Math.floor(idx / 12));
    setCatM(((idx % 12) + 12) % 12 + 1);
  }

  if (error) return <ErrorBox msg={error} />;

  const barData = {
    labels: monthly.map((m) => m.month.slice(2)),
    datasets: [
      { label: "Income", data: monthly.map((m) => m.income), backgroundColor: "#2a78d6", borderRadius: 3 },
      { label: "Spend", data: monthly.map((m) => m.expense), backgroundColor: "#e34948", borderRadius: 3 },
    ],
  };

  const doughData = {
    labels: cats.map((c) => c.name),
    datasets: [{ data: cats.map((c) => c.amount), backgroundColor: cats.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 0 }],
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-black/10 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Income vs. spend — last 12 months</h2>
        {monthly.length === 0 ? (
          <Empty />
        ) : (
          <div className="h-64">
            <Bar
              data={barData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } },
                scales: { y: { ticks: { callback: (v) => CHF(Number(v)) } } },
              }}
            />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-black/10 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Net savings vs plan</h2>
        {!plan || plan.monthly.length === 0 ? (
          <Empty />
        ) : (
          <div className="h-64">
            <Chart
              type="bar"
              data={{
                labels: plan.monthly.map((m) => m.month.slice(2)),
                datasets: [
                  {
                    type: "bar" as const,
                    label: "Actual net",
                    data: plan.monthly.map((m) => m.net),
                    backgroundColor: plan.monthly.map((m) => (m.net >= 0 ? "#1baf7a" : "#e34948")),
                    borderRadius: 3,
                    order: 2,
                  },
                  {
                    type: "line" as const,
                    label: "Plan target",
                    data: plan.monthly.map((m) => m.target),
                    borderColor: "#2a78d6",
                    borderDash: [5, 4],
                    borderWidth: 2,
                    pointRadius: 0,
                    order: 1,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } },
                scales: { y: { ticks: { callback: (v) => CHF(Number(v)) } } },
              }}
            />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-black/10 bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Where the money went</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => shiftCatMonth(-1)} className="rounded-md px-2 py-1 text-sm text-ink-soft hover:bg-black/5" aria-label="previous month">‹</button>
            <span className="min-w-[72px] text-center text-xs font-medium tabular-nums text-ink">{MONTHS[catM - 1]} {catY}</span>
            <button onClick={() => shiftCatMonth(1)} className="rounded-md px-2 py-1 text-sm text-ink-soft hover:bg-black/5" aria-label="next month">›</button>
          </div>
        </div>
        {cats.length === 0 ? (
          <Empty />
        ) : (
          <div className="mx-auto h-80 w-full max-w-md sm:h-72">
            <Doughnut
              data={doughData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: "bottom", labels: { boxWidth: 10, padding: 8, font: { size: 11 } } },
                  tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${CHF(Number(ctx.parsed))}` } },
                },
              }}
            />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-black/10 bg-surface p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">Recurring payments</h2>
          {subs.length > 0 && (
            <span className="text-xs text-ink-muted">≈ {CHF(subTotal)}/mo across {subs.length}</span>
          )}
        </div>
        {subs.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-black/5">
            {subs.map((s) => (
              <li key={s.normalized} className="flex items-center gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ink">{s.payee}</div>
                  <div className="mt-0.5 text-[11px] text-ink-muted">
                    {s.cadence} · {s.count}× · {s.category || "—"} · next ~{s.next_estimate}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm tabular-nums text-ink">{CHF(s.avg_amount)}</div>
                  <div className="text-[11px] text-ink-muted">≈ {CHF(s.monthly_equiv)}/mo</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-ink-muted">Detected from repeat charges with a steady cadence and amount. Eyeball — not every match is a true subscription.</p>
      </section>
    </div>
  );
}

function Empty() {
  return <p className="py-8 text-center text-sm text-ink-muted">No data yet. Upload a statement.</p>;
}
