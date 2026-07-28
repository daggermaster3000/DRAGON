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

export function PixelDragon({ dragon }: { dragon: Dragon }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stage: Stage = dragon.stage;

  useEffect(() => {
    if (canvasRef.current) renderSprite(canvasRef.current, DRAGONS[stage]);
  }, [stage]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-black/10 bg-surface px-2 py-1 text-[10px] font-pixel text-ink-soft shadow-sm">
          {MOOD_LINE[dragon.mood]}
        </div>
        <div className={dragon.mood === "sleepy" ? "" : "origin-bottom"}>
          <canvas
            ref={canvasRef}
            className={`pixelated h-auto max-w-full ${MOOD_ANIM[dragon.mood]}`}
            aria-label={`${STAGE_LABEL[stage]}, ${dragon.mood}`}
          />
        </div>
      </div>
      <div className="text-center">
        <div className="font-pixel text-[11px] text-ink">{STAGE_LABEL[stage]}</div>
        <div className="mt-1 text-xs text-ink-muted">
          {dragon.xp.toLocaleString()} XP · {dragon.adherence}% on budget
        </div>
      </div>
    </div>
  );
}
