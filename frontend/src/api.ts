// Thin fetch wrapper. Same-origin in prod; Vite proxies /api in dev.

export interface Lifebar {
  id: number;
  name: string;
  spent: number;
  budget: number;
  remaining: number;
  pct: number;
  projected: number;
  projected_pct: number;
  over_budget: boolean;
  overspend: number;
}

export interface MonthSummary {
  income: number;
  expense: number;
  net: number;
  savings_rate: number;
  projected_net: number;
  timeframe: string;
  period_label: string;
}

export interface SeriesPoint {
  period: string;
  income: number;
  expense: number;
  net: number;
  is_current: boolean;
  projected_income?: number;
  projected_expense?: number;
  projected_net?: number;
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

export interface Transaction {
  id: number;
  date: string;
  payee: string;
  amount: number;
  currency: string;
  account: string;
  bank_category: string | null;
  category_id: number | null;
  category_name: string | null;
  subcategory: string | null;
  classified_by: string;
  needs_review: boolean;
  note: string | null;
  info: string | null;
  tags: string | null;
  split_parent_id: number | null;
}

export interface Subcategory {
  name: string;
  monthly_budget: number;
}

export interface Category {
  id: number;
  name: string;
  kind: string;
  monthly_budget: number;
  subcategories: Subcategory[];
}

export interface MonthPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface DayPoint {
  date: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

export interface CategorySlice {
  name: string;
  amount: number;
}

export interface Rule {
  id: number;
  contains: string;
  category_name: string;
  subcategory: string | null;
  priority: number;
  source: string;
}

export interface ReclassifyCounts {
  rule: number;
  bank: number;
  ai: number;
  unclassified: number;
  total: number;
}

export interface Subscription {
  payee: string;
  normalized: string;
  cadence: string;
  count: number;
  avg_amount: number;
  last_date: string;
  next_estimate: string;
  monthly_equiv: number;
  category: string | null;
}

export interface TxnQuery {
  q?: string;
  category_id?: number;
  needs_review?: boolean;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface SplitPart {
  amount: number;
  category_id: number;
  subcategory?: string | null;
  note?: string | null;
}

export interface Achievement {
  key: string;
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
  progress: number;
  unlocked_at: string | null;
  is_new: boolean;
}

export interface OracleInput {
  income_monthly: number;
  location?: string;
  household?: string;
  goals?: string;
  savings_rate_target?: number | null;
}

export interface OracleItem {
  category: string;
  monthly_budget: number;
  subcategories: Subcategory[];
}

export interface OracleProposal {
  source: "ai" | "fallback";
  rationale: string;
  items: OracleItem[];
  income_monthly: number;
  total_expense: number;
  planned_savings: number;
  observed: Record<string, number>;
}

export interface AiSettings {
  providers: string[];
  provider: string;
  ollama_base_url: string;
  ollama_model: string;
  openai_api_key_set: boolean;
  openai_api_key_hint: string;
  openai_model: string;
  anthropic_api_key_set: boolean;
  anthropic_api_key_hint: string;
  anthropic_model: string;
  mistral_api_key_set: boolean;
  mistral_api_key_hint: string;
  mistral_model: string;
}

export type PlanStatus = "on_track" | "watch" | "off_track";

export interface PlanHealth {
  month_pace: {
    day: number;
    days_in_month: number;
    spent: number;
    budget: number;
    projected: number;
    status: PlanStatus;
  };
  savings: {
    planned_monthly: number;
    ytd_actual: number;
    ytd_target: number;
    delta: number;
    status: PlanStatus;
  };
  monthly: { month: string; net: number; target: number }[];
}

export interface CategoryDetail {
  id: number;
  name: string;
  budget: number;
  spent: number;
  subcategories: { name: string; budget: number; spent: number }[];
  transactions: { id: number; date: string; payee: string; amount: number; subcategory: string | null }[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error((detail as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function qs(params: Record<string, unknown> | TxnQuery): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const api = {
  dashboard: (sort: SortKey = "remaining", timeframe = "monthly") =>
    fetch(`/api/dashboard?sort=${sort}&timeframe=${timeframe}`).then(json<Dashboard>),

  statsSeries: (timeframe = "monthly", periods = 12) =>
    fetch(`/api/stats/series?timeframe=${timeframe}&periods=${periods}`).then(json<{ series: SeriesPoint[]; timeframe: string }>),

  upload: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return fetch("/api/import", { method: "POST", body }).then(json<ImportResult>);
  },

  categories: () => fetch("/api/categories").then(json<Category[]>),

  transactions: (query: TxnQuery = {}) =>
    fetch(`/api/transactions${qs(query)}`).then(json<Transaction[]>),

  updateTransaction: (id: number, patch: Partial<Pick<Transaction, "category_id" | "subcategory" | "note" | "tags">>) =>
    fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json<Transaction>),

  statsMonthly: (months = 12) =>
    fetch(`/api/stats/monthly?months=${months}`).then(json<{ series: MonthPoint[] }>),

  statsDaily: (year: number, month: number) =>
    fetch(`/api/stats/daily?year=${year}&month=${month}`).then(json<{ year: number; month: number; days: DayPoint[] }>),

  statsCategories: (year?: number, month?: number) =>
    fetch(`/api/stats/categories${qs({ year, month })}`).then(json<{ month: string; items: CategorySlice[] }>),

  rules: () => fetch("/api/rules").then(json<Rule[]>),

  createRule: (contains: string, category_name: string, subcategory?: string) =>
    fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contains, category_name, subcategory: subcategory || null }),
    }).then(json<Rule>),

  deleteRule: (id: number) =>
    fetch(`/api/rules/${id}`, { method: "DELETE" }).then(json<{ deleted: number }>),

  applyRules: () => fetch("/api/rules/apply", { method: "POST" }).then(json<ReclassifyCounts>),

  subscriptions: () =>
    fetch("/api/subscriptions").then(json<{ subscriptions: Subscription[]; total_monthly_equiv: number; count: number }>),

  bulkRecategorize: (ids: number[], category_id: number) =>
    fetch("/api/transactions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, category_id }),
    }).then(json<{ updated: number }>),

  splitTransaction: (id: number, parts: SplitPart[]) =>
    fetch(`/api/transactions/${id}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parts }),
    }).then(json<{ parent_id: number; children: number }>),

  undo: () => fetch("/api/transactions/undo", { method: "POST" }).then(json<{ undone: string }>),

  categoryDetail: (categoryId: number, timeframe = "monthly") =>
    fetch(`/api/budget/${categoryId}/detail?timeframe=${timeframe}`).then(json<CategoryDetail>),

  createCategory: (name: string, monthly_budget: number, kind = "expense") =>
    fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, monthly_budget, kind }),
    }).then(json<Category>),

  updateCategory: (id: number, patch: { name?: string; monthly_budget?: number }) =>
    fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json<Category>),

  deleteCategory: (id: number) =>
    fetch(`/api/categories/${id}`, { method: "DELETE" }).then(json<{ deleted: number; transactions_detached: number }>),

  setSubcategories: (id: number, subcategories: Subcategory[]) =>
    fetch(`/api/categories/${id}/subcategories`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subcategories }),
    }).then(json<Category>),

  resetBudget: () =>
    fetch("/api/categories/reset-budget", { method: "POST" }).then(json<{ updated: number; created: number }>),

  oraclePropose: (input: OracleInput) =>
    fetch("/api/budget/oracle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then(json<OracleProposal>),

  oracleApply: (items: OracleItem[]) =>
    fetch("/api/budget/oracle/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }).then(json<{ applied: number }>),

  planHealth: () => fetch("/api/health/plan").then(json<PlanHealth>),

  getSettings: () => fetch("/api/settings").then(json<AiSettings>),

  updateSettings: (patch: Partial<Record<string, string>>) =>
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json<AiSettings>),

  testProvider: () => fetch("/api/settings/test", { method: "POST" }).then(json<{ ok: boolean; provider: string; detail: string }>),

  achievements: () =>
    fetch("/api/achievements").then(json<{ achievements: Achievement[]; unlocked: number; total: number; newly_unlocked: string[] }>),

  dragonQuip: () =>
    fetch("/api/dragon/quip").then(json<{ quip: string; source: "ai" | "fallback"; cached: boolean }>),
};

export const CHF = (n: number) =>
  "CHF " + n.toLocaleString("en-CH", { maximumFractionDigits: 0 });
