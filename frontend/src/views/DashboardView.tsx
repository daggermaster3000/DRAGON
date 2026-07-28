import { useEffect, useState } from "react";
import { api, CHF, type Dashboard, type SortKey } from "../api";
import { PixelDragon } from "../components/PixelDragon";
import { LifebarRow } from "../components/LifebarRow";
import { CategoryDetailPanel } from "../components/CategoryDetailPanel";
import { OnTrackCards } from "../components/OnTrackCards";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "remaining", label: "Remaining" },
  { key: "overspend", label: "Biggest overspend" },
  { key: "alphabetical", label: "A–Z" },
];

export function DashboardView({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [sort, setSort] = useState<SortKey>("remaining");
  const [error, setError] = useState<string | null>(null);
  const [openCat, setOpenCat] = useState<number | null>(null);

  useEffect(() => {
    api.dashboard(sort).then(setData).catch((e) => setError(e.message));
  }, [sort, refreshKey]);

  if (error) return <ErrorBox msg={error} />;
  if (!data) return <p className="text-sm text-ink-muted">Loading…</p>;

  return (
    <>
      <OnTrackCards refreshKey={refreshKey} />
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-center rounded-2xl border border-black/10 bg-surface py-6">
          <PixelDragon dragon={data.dragon} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Income (mo)" value={CHF(data.summary.income)} />
          <Stat label="Spent (mo)" value={CHF(data.summary.expense)} />
          <Stat label="Net saved" value={(data.summary.net >= 0 ? "+" : "") + CHF(data.summary.net)} good={data.summary.net >= 0} />
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
              No spending yet this month. Upload a statement to begin.
            </p>
          ) : (
            data.lifebars.map((b) => (
              <LifebarRow key={b.id} bar={b} onClick={() => setOpenCat(openCat === b.id ? null : b.id)} />
            ))
          )}
        </div>
        {openCat !== null && <CategoryDetailPanel categoryId={openCat} onClose={() => setOpenCat(null)} />}
      </section>
    </>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-black/10 bg-surface px-4 py-3">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${good ? "text-hp-good" : "text-ink"}`}>{value}</div>
    </div>
  );
}

export function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-hp-danger/30 bg-hp-danger/10 px-3 py-2 text-sm text-hp-danger">{msg}</div>
  );
}
