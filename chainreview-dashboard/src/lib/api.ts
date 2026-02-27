const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.chainreview.dev";

interface FetchOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

/** Typed fetch wrapper for the ChainReview API. */
export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((error as any).error || `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Usage API ──

export interface UsageSummary {
  today: { inputTokens: number; outputTokens: number; requests: number };
  month: { inputTokens: number; outputTokens: number; requests: number };
  plan: string;
}

export interface DailyUsage {
  date: string;
  total_input_tokens: number;
  total_output_tokens: number;
  request_count: number;
}

export async function getUsageSummary(token: string): Promise<UsageSummary> {
  return apiFetch<UsageSummary>("/api/usage", { token });
}

export async function getUsageHistory(token: string, days = 30): Promise<{ days: DailyUsage[] }> {
  return apiFetch<{ days: DailyUsage[] }>(`/api/usage/history?days=${days}`, { token });
}

// ── Reviews API ──

export interface CloudReviewRun {
  id: string;
  repo_name: string;
  mode: string;
  findings_count: number;
  severity_breakdown: Record<string, number>;
  duration_ms: number;
  created_at: string;
}

export async function getReviews(token: string, limit = 20, offset = 0): Promise<{ reviews: CloudReviewRun[]; total: number }> {
  return apiFetch<{ reviews: CloudReviewRun[]; total: number }>(`/api/reviews?limit=${limit}&offset=${offset}`, { token });
}
