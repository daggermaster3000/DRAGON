import { useEffect, useState } from "react";
import { api, CHF, type PlanHealth, type PlanStatus } from "../api";

const STATUS_STYLE: Record<PlanStatus, { ring: string; text: string; icon: string; label: string }> = {
  on_track: { ring: "border-hp-good/40 bg-hp-good/5", text: "text-hp-good", icon: "✓", label: "On track" },
  watch: { ring: "border-hp-warn/50 bg-hp-warn/10", text: "text-[#8a6a00]", icon: "⚠", label: "Watch" },
  off_track: { ring: "border-hp-danger/40 bg-hp-danger/5", text: "text-hp-danger", icon: "▲", label: "Off track" },
};

export function OnTrackCards({ refreshKey }: { refreshKey: number }) {
  const [plan, setPlan] = useState<PlanHealth | null>(null);

  useEffect(() => {
    api.planHealth().then(setPlan).catch(() => setPlan(null));
  }, [refreshKey]);

  if (!plan) return null;
  const mp = plan.month_pace;
  const s = plan.savings;
  const paceStyle = STATUS_STYLE[mp.status];
  const savStyle = STATUS_STYLE[s.status];
  const pacePct = mp.budget > 0 ? Math.min(100, (mp.spent / mp.budget) * 100) : 0;

  return (
    <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Spend pace this month */}
      <div className={`rounded-2xl border p-4 ${paceStyle.ring}`}>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-ink-soft">Spend pace · day {mp.day}/{mp.days_in_month}</span>
          <span className={`text-xs font-semibold ${paceStyle.text}`}>{paceStyle.icon} {paceStyle.label}</span>
        </div>
        <div className="text-lg font-semibold tabular-nums text-ink">
          {CHF(mp.spent)} <span className="text-sm font-normal text-ink-muted">/ {CHF(mp.budget)}</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded bg-black/5">
          <div className={`h-full rounded ${mp.status === "off_track" ? "bg-hp-danger" : mp.status === "watch" ? "bg-hp-warn" : "bg-hp-good"}`} style={{ width: `${pacePct}%` }} />
        </div>
        <div className="mt-1.5 text-[11px] text-ink-muted">Projected end of month: <span className="tabular-nums">{CHF(mp.projected)}</span></div>
      </div>

      {/* Savings vs plan (YTD) */}
      <div className={`rounded-2xl border p-4 ${savStyle.ring}`}>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-ink-soft">Savings vs plan · YTD</span>
          <span className={`text-xs font-semibold ${savStyle.text}`}>{savStyle.icon} {savStyle.label}</span>
        </div>
        <div className="text-lg font-semibold tabular-nums text-ink">
          {(s.ytd_actual >= 0 ? "+" : "") + CHF(s.ytd_actual)} <span className="text-sm font-normal text-ink-muted">/ {CHF(s.ytd_target)} planned</span>
        </div>
        <div className={`mt-2 text-sm font-medium ${s.delta >= 0 ? "text-hp-good" : "text-hp-danger"}`}>
          {s.delta >= 0 ? "Ahead by " : "Behind by "}{CHF(Math.abs(s.delta))}
        </div>
        <div className="mt-1 text-[11px] text-ink-muted">Plan target: {CHF(s.planned_monthly)}/mo saved</div>
      </div>
    </section>
  );
}
