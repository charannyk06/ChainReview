const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.chainreview.dev";

export interface BillingStatus {
  plan: string;
  lastEvent: {
    event_type: string;
    plan: string;
    created_at: string;
  } | null;
}

async function apiFetch<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getBillingStatus(token: string): Promise<BillingStatus> {
  return apiFetch<BillingStatus>(token, "/api/billing/status");
}

export async function createCheckoutSession(
  token: string,
  options?: { priceId?: string; successUrl?: string; cancelUrl?: string }
): Promise<{ url: string; sessionId: string }> {
  return apiFetch<{ url: string; sessionId: string }>(token, "/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify(options || {}),
  });
}

export async function createPortalSession(
  token: string,
  options?: { returnUrl?: string }
): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(token, "/api/billing/portal", {
    method: "POST",
    body: JSON.stringify(options || {}),
  });
}
