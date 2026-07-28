// Single source of truth for chart + gauge colors so the dashboard, stats, and
// lifebars stay visually consistent (and match the Tailwind tokens + dragon).

export const C = {
  income: "#2a78d6",
  expense: "#e34948",
  net: "#1baf7a",
  good: "#0ca30c",
  warn: "#fab219",
  danger: "#d03b3b",
  projection: "#7856c4", // dragon-wing purple — the "estimate/pace" accent
  grid: "#e1e0d9",
  ink: "#0b0b0b",
  muted: "#898781",
};

// Colorblind-safe categorical palette for the category pie.
export const CATEGORICAL = [
  "#2a78d6", "#e34948", "#1baf7a", "#fab219", "#7a5cc0",
  "#ec835a", "#0ca30c", "#898781", "#256abf", "#d03b3b",
];

export const TIMEFRAMES = [
  { key: "monthly", label: "Month" },
  { key: "quarterly", label: "Quarter" },
  { key: "annual", label: "Year" },
] as const;

export type Timeframe = "monthly" | "quarterly" | "annual";
