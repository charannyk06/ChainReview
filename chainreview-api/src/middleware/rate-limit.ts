import { createMiddleware } from "hono/factory";
import type { Env, Variables } from "../index";
import { getSupabaseAdmin } from "../lib/supabase";

/** Rate limits by plan tier */
const PLAN_LIMITS: Record<string, { requestsPerMinute: number; tokensPerDay: number }> = {
  free: { requestsPerMinute: 10, tokensPerDay: 100_000 },
  pro: { requestsPerMinute: 60, tokensPerDay: 10_000_000 },
};

// NOTE: This in-memory Map is scoped to a single worker/isolate. In a multi-worker
// deployment (e.g., Cloudflare Workers with multiple isolates, or horizontal scaling),
// each worker will have its own independent copy of this map. This means a user could
// exceed the per-minute limit by up to N times the configured limit if there are N
// workers. For production, replace with a shared store (KV, Durable Objects, or Redis).
const requestCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * Token-bucket rate limiting middleware.
 * Checks per-minute request rate (in-memory) and daily token usage (Supabase).
 */
export const rateLimitMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Fetch user plan from Supabase profiles
  const supabase = getSupabaseAdmin(c.env);
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();

  const plan = profile?.plan || "free";
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  // ── Per-minute request rate (in-memory sliding window) ──
  const now = Date.now();
  const windowKey = `rpm:${userId}`;
  const window = requestCounts.get(windowKey);

  if (window && now < window.resetAt) {
    if (window.count >= limits.requestsPerMinute) {
      return c.json(
        {
          error: "Rate limit exceeded",
          detail: `${limits.requestsPerMinute} requests/minute for ${plan} plan`,
          retryAfter: Math.ceil((window.resetAt - now) / 1000),
        },
        429
      );
    }
    window.count++;
  } else {
    requestCounts.set(windowKey, { count: 1, resetAt: now + 60_000 });
  }

  // ── Daily token usage check (Supabase) ──
  const today = new Date().toISOString().slice(0, 10);
  const { data: dailyUsage } = await supabase
    .from("usage_daily")
    .select("total_input_tokens, total_output_tokens")
    .eq("user_id", userId)
    .eq("date", today)
    .single();

  if (dailyUsage) {
    const totalTokens =
      (dailyUsage.total_input_tokens || 0) + (dailyUsage.total_output_tokens || 0);
    if (totalTokens >= limits.tokensPerDay) {
      return c.json(
        {
          error: "Daily token limit exceeded",
          detail: `${limits.tokensPerDay.toLocaleString()} tokens/day for ${plan} plan`,
          usage: totalTokens,
        },
        429
      );
    }
  }

  // Set plan on context for downstream use
  c.set("userPlan", plan);
  await next();
});
