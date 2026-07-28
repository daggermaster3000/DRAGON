import { useEffect, useState } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  ArcElement,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { api, CHF, type CategorySlice, type MonthPoint } from "../api";
import { ErrorBox } from "./DashboardView";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// Brand-neutral, colorblind-safe categorical palette (matches the report tokens).
const PALETTE = ["#2a78d6", "#e34948", "#1baf7a", "#fab219", "#7a5cc0", "#ec835a", "#0ca30c", "#898781", "#256abf", "#d03b3b"];

export function StatsView({ refreshKey }: { refreshKey: number }) {
  const [monthly, setMonthly] = useState<MonthPoint[]>([]);
  const [cats, setCats] = useState<CategorySlice[]>([]);
  const [catMonth, setCatMonth] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.statsMonthly(12), api.statsCategories()])
      .then(([m, c]) => {
        setMonthly(m.series);
        setCats(c.items);
        setCatMonth(c.month);
      })
      .catch((e) => setError(e.message));
  }, [refreshKey]);

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
        <h2 className="mb-3 text-sm font-semibold text-ink">
          Where the money went{catMonth && ` — ${catMonth}`}
        </h2>
        {cats.length === 0 ? (
          <Empty />
        ) : (
          <div className="mx-auto h-72 max-w-sm">
            <Doughnut
              data={doughData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: "right", labels: { boxWidth: 10, font: { size: 11 } } },
                  tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${CHF(Number(ctx.parsed))}` } },
                },
              }}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function Empty() {
  return <p className="py-8 text-center text-sm text-ink-muted">No data yet. Upload a statement.</p>;
}
