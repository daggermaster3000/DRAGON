import { useEffect, useRef } from "react";
import { DRAGONS, PALETTE, STAGE_LABEL, type Stage } from "../dragonSprites";
import type { Dragon, Mood } from "../api";

const SCALE = 10; // px per sprite pixel

const MOOD_ANIM: Record<Mood, string> = {
  idle: "animate-bob",
  happy: "animate-bob",
  excited: "animate-excited",
  sleepy: "animate-sleepy",
  angry: "animate-angry",
};

const MOOD_LINE: Record<Mood, string> = {
  idle: "…",
  happy: "Nice savings!",
  excited: "New data! ✨",
  sleepy: "zzz…",
  angry: "Over budget!",
};

function renderSprite(canvas: HTMLCanvasElement, sprite: string[]) {
  const rows = sprite.length;
  const cols = Math.max(...sprite.map((r) => r.length));
  canvas.width = cols * SCALE;
  canvas.height = rows * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < rows; y++) {
    const row = sprite[y];
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    }
  }
}

export function PixelDragon({
  dragon,
  quip,
  quipLoading,
  onPoke,
}: {
  dragon: Dragon;
  quip?: string | null;
  quipLoading?: boolean;
  onPoke?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stage: Stage = dragon.stage;

  useEffect(() => {
    if (canvasRef.current) renderSprite(canvasRef.current, DRAGONS[stage]);
  }, [stage]);

  const bubble = quipLoading ? "…" : quip || MOOD_LINE[dragon.mood];

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {/* Speech bubble: the dragon's roast about the day's spending */}
      <div className="relative max-w-[240px] rounded-xl border border-black/10 bg-surface px-3 py-2 text-center text-xs leading-snug text-ink-soft shadow-sm">
        <span className={quipLoading ? "animate-flash" : ""}>{bubble}</span>
        <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-black/10 bg-surface" />
      </div>

      <div className={dragon.mood === "sleepy" ? "" : "origin-bottom"}>
        <canvas
          ref={canvasRef}
          className={`pixelated h-auto max-w-full ${MOOD_ANIM[dragon.mood]}`}
          aria-label={`${STAGE_LABEL[stage]}, ${dragon.mood}`}
        />
      </div>

      <div className="text-center">
        <div className="font-pixel text-[11px] text-ink">{STAGE_LABEL[stage]}</div>
        <div className="mt-1 text-xs text-ink-muted">
          {dragon.xp.toLocaleString()} XP · {dragon.adherence}% on budget
        </div>
        {onPoke && (
          <button
            onClick={onPoke}
            disabled={quipLoading}
            className="mt-2 rounded-md border border-black/10 px-2 py-1 text-[11px] text-ink-soft transition hover:bg-black/5 disabled:opacity-50"
          >
            👉 Poke the dragon
          </button>
        )}
      </div>
    </div>
  );
}
