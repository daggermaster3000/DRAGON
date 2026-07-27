// Thin fetch wrapper. Same-origin in prod; Vite proxies /api in dev.

export interface Lifebar {
  id: number;
  name: string;
  spent: number;
  budget: number;
  remaining: number;
  pct: number;
  over_budget: boolean;
  overspend: number;
}

export interface MonthSummary {
  income: number;
  expense: number;
  net: number;
  savings_rate: number;
}

export type Stage = "baby" | "young" | "adult" | "legendary";
export type Mood = "idle" | "happy" | "excited" | "sleepy" | "angry";

export interface Dragon {
  stage: Stage;
  mood: Mood;
  xp: number;
  cumulative_net: number;
  adherence: number;
  over_budget_count: number;
}

export interface Dashboard {
  summary: MonthSummary;
  lifebars: Lifebar[];
  dragon: Dragon;
}

export interface ImportResult {
  filename: string;
  n_rows: number;
  n_new: number;
  n_duplicate: number;
  classified: Record<string, number>;
  dragon: Dragon;
}

export type SortKey = "remaining" | "overspend" | "alphabetical";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error((detail as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  dashboard: (sort: SortKey = "remaining") =>
    fetch(`/api/dashboard?sort=${sort}`).then(json<Dashboard>),

  upload: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return fetch("/api/import", { method: "POST", body }).then(json<ImportResult>);
  },
};
