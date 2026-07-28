import { useState } from "react";
import { type ImportResult } from "./api";
import { UploadButton } from "./components/UploadButton";
import { DashboardView } from "./views/DashboardView";
import { TransactionsView } from "./views/TransactionsView";
import { CalendarView } from "./views/CalendarView";
import { StatsView } from "./views/StatsView";
import { RulesView } from "./views/RulesView";
import { BudgetView } from "./views/BudgetView";

type Tab = "dashboard" | "transactions" | "calendar" | "stats" | "budget" | "rules";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "🐉 Dashboard" },
  { key: "transactions", label: "Transactions" },
  { key: "calendar", label: "Calendar" },
  { key: "stats", label: "Stats" },
  { key: "budget", label: "Budget" },
  { key: "rules", label: "Rules" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  function onImported(r: ImportResult) {
    setFlash(`Imported ${r.n_new} new (${r.n_duplicate} duplicates skipped).`);
    setRefreshKey((k) => k + 1); // every view keys off this to reload
    setTimeout(() => setFlash(null), 5000);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-pixel text-sm text-ink sm:text-base">Budget Dragon</h1>
          <p className="mt-1 text-xs text-ink-muted">Feed it good habits. Watch it grow.</p>
        </div>
        <UploadButton onImported={onImported} />
      </header>

      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-black/10 bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
              tab === t.key ? "bg-ink text-white" : "text-ink-soft hover:bg-black/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {flash && (
        <div className="mb-4 rounded-lg border border-hp-good/30 bg-hp-good/10 px-3 py-2 text-sm text-ink-soft">{flash}</div>
      )}

      {tab === "dashboard" && <DashboardView refreshKey={refreshKey} />}
      {tab === "transactions" && <TransactionsView refreshKey={refreshKey} />}
      {tab === "calendar" && <CalendarView refreshKey={refreshKey} />}
      {tab === "stats" && <StatsView refreshKey={refreshKey} />}
      {tab === "budget" && <BudgetView onChanged={() => setRefreshKey((k) => k + 1)} />}
      {tab === "rules" && <RulesView onReclassified={() => setRefreshKey((k) => k + 1)} />}
    </div>
  );
}
