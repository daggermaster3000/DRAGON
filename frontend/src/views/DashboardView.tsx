import { useEffect, useState } from "react";
import { api, CHF, type Dashboard, type SortKey } from "../api";
import { TIMEFRAMES, type Timeframe } from "../theme";
import { PixelDragon } from "../components/PixelDragon";
import { LifebarRow } from "../components/LifebarRow";
import { CategoryDetailPanel } from "../components/CategoryDetailPanel";
import { OnTrackCards } from "../components/OnTrackCards";
import { AchievementsGrid } from "../components/AchievementsGrid";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "remaining", label: "Remaining" },
  { key: "overspend", label: "Biggest overspend" },
  { key: "alphabetical", label: "A–Z" },
];

export function DashboardView({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [sort, setSort] = useState<SortKey>("remaining");
  const [timeframe, setTimeframe] = useState<Timeframe>("monthly");
  const [error, setError] = useState<string | null>(null);
  const [openCat, setOpenCat] = useState<number | null>(null);
  const [quip, setQuip] = useState<string | null>(null);
  const [quipLoading, setQuipLoading] = useState(false);

  useEffect(() => {
    api.dashboard(sort, timeframe).then(setData).catch((e) => setError(e.message));
  }, [sort, timeframe, refreshKey]);

  // The dragon's roast loads independently (the LLM can be slow on a Pi).
  function loadQuip() {
    setQuipLoading(true);
    api.dragonQuip()
      .then((q) => setQuip(q.quip))
      .catch(() => setQuip(null))
      .finally(() => setQuipLoading(false));
  }
  useEffect(loadQuip, [refreshKey]);

  if (error) return <ErrorBox msg={error} />;
  if (!data) return <p className="text-sm text-ink-muted">Loading…</p>;

  return (
    <>
      <OnTrackCards refreshKey={refreshKey} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{data.summary.period_label}</span>
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
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-center rounded-2xl border border-black/10 bg-surface px-3 py-6">
          <PixelDragon dragon={data.dragon} quip={quip} quipLoading={quipLoading} onPoke={loadQuip} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Income" value={CHF(data.summary.income)} />
          <Stat label="Spent" value={CHF(data.summary.expense)} />
          <Stat
            label="Net saved"
            value={(data.summary.net >= 0 ? "+" : "") + CHF(data.summary.net)}
            good={data.summary.net >= 0}
            sub={`est. ${data.summary.projected_net >= 0 ? "+" : ""}${CHF(data.summary.projected_net)}`}
          />
          <Stat label="Savings rate" value={`${data.summary.savings_rate}%`} good={data.summary.net >= 0} />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Category health</h2>
          <div className="flex gap-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`rounded-md px-2 py-1 text-xs transition ${
                  sort === s.key ? "bg-ink text-white" : "text-ink-soft hover:bg-black/5"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-surface px-4 py-2 divide-y divide-black/5">
          {data.lifebars.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              No spending in this period yet. Upload a statement to begin.
            </p>
          ) : (
            data.lifebars.map((b) => (
              <LifebarRow key={b.id} bar={b} onClick={() => setOpenCat(openCat === b.id ? null : b.id)} />
            ))
          )}
        </div>
        {openCat !== null && <CategoryDetailPanel categoryId={openCat} onClose={() => setOpenCat(null)} />}
      </section>

      <AchievementsGrid refreshKey={refreshKey} />
    </>
  );
}

function Stat({ label, value, good, sub }: { label: string; value: string; good?: boolean; sub?: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-surface px-4 py-3">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${good ? "text-hp-good" : "text-ink"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-ink-muted" style={{ color: "#7856c4" }}>{sub}</div>}
    </div>
  );
}

export function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-hp-danger/30 bg-hp-danger/10 px-3 py-2 text-sm text-hp-danger">{msg}</div>
  );
}
