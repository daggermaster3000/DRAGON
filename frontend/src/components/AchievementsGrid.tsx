import { useEffect, useState } from "react";
import { api, type Achievement } from "../api";

export function AchievementsGrid({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.achievements().then((a) => {
      setItems(a.achievements);
      setUnlocked(a.unlocked);
      setTotal(a.total);
    }).catch(() => setItems([]));
  }, [refreshKey]);

  if (items.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Achievements</h2>
        <span className="text-xs text-ink-muted">{unlocked}/{total} unlocked</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((a) => (
          <div
            key={a.key}
            title={a.desc}
            className={`relative overflow-hidden rounded-xl border p-3 text-center transition ${
              a.unlocked ? "border-hp-good/30 bg-hp-good/5" : "border-black/10 bg-surface"
            }`}
          >
            <div className={`text-2xl ${a.unlocked ? "" : "opacity-30 grayscale"}`}>{a.icon}</div>
            <div className={`mt-1 text-[11px] font-medium ${a.unlocked ? "text-ink" : "text-ink-muted"}`}>{a.title}</div>
            <div className="mt-0.5 text-[10px] leading-tight text-ink-muted">{a.desc}</div>
            {!a.unlocked && a.progress > 0 && (
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded bg-black/10">
                <div className="h-full rounded bg-ink/40" style={{ width: `${Math.round(a.progress * 100)}%` }} />
              </div>
            )}
            {a.is_new && (
              <span className="absolute right-1 top-1 rounded bg-hp-good px-1 text-[8px] font-bold text-white">NEW</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
