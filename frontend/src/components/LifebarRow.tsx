import type { Lifebar } from "../api";

const CHF = (n: number) =>
  "CHF " + n.toLocaleString("en-CH", { maximumFractionDigits: 0 });

// RPG segmented health bar. Green -> amber as it fills; red + flash when over.
function barColor(pct: number, over: boolean): string {
  if (over) return "bg-hp-danger";
  if (pct >= 85) return "bg-hp-warn";
  return "bg-hp-good";
}

export function LifebarRow({ bar, onClick }: { bar: Lifebar; onClick?: () => void }) {
  const fill = Math.min(100, bar.pct);
  const over = bar.over_budget;
  return (
    <div
      className={`py-2 ${onClick ? "cursor-pointer -mx-2 rounded-lg px-2 hover:bg-black/[0.03]" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink">{bar.name}</span>
        <span className={`text-xs tabular-nums ${over ? "font-semibold text-hp-danger" : "text-ink-soft"}`}>
          {CHF(bar.spent)} / {CHF(bar.budget)}
          {over && <span className="ml-1">▲ {CHF(bar.overspend)} over</span>}
        </span>
      </div>
      <div
        className={`h-4 w-full overflow-hidden rounded-md border border-black/10 bg-[repeating-linear-gradient(90deg,#e1e0d9_0,#e1e0d9_2px,#ecebe4_2px,#ecebe4_10px)] ${
          over ? "animate-flash" : ""
        }`}
        role="progressbar"
        aria-valuenow={Math.round(bar.pct)}
        aria-valuemax={100}
        aria-label={`${bar.name} budget used`}
      >
        <div
          className={`h-full rounded-md transition-[width] duration-500 ${barColor(bar.pct, over)}`}
          style={{ width: `${fill}%` }}
        />
      </div>
    </div>
  );
}
