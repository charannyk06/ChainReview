import { Hono } from "hono";
import type { Env, Variables } from "../index";
import { authMiddleware } from "../middleware/auth";
import { getSupabaseAdmin } from "../lib/supabase";

const usage = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Maximum allowed value for token count fields. */
const MAX_TOKEN_VALUE = 10_000_000;

/**
 * GET /api/usage — Current user's usage summary.
 * Returns today's usage, this month's total, and plan limits.
 */
usage.get("/api/usage", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const supabase = getSupabaseAdmin(c.env);

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";

  // Today's usage
  const { data: todayUsage } = await supabase
    .from("usage_daily")
    .select("total_input_tokens, total_output_tokens, request_count")
    .eq("user_id", userId)
    .eq("date", today)
    .single();

  // This month's usage (aggregate)
  const { data: monthRows } = await supabase
    .from("usage_daily")
    .select("total_input_tokens, total_output_tokens, request_count")
    .eq("user_id", userId)
    .gte("date", monthStart)
    .lte("date", today);

  const monthUsage = (monthRows || []).reduce(
    (acc, row) => ({
      inputTokens: acc.inputTokens + (row.total_input_tokens || 0),
      outputTokens: acc.outputTokens + (row.total_output_tokens || 0),
      requests: acc.requests + (row.request_count || 0),
    }),
    { inputTokens: 0, outputTokens: 0, requests: 0 }
  );

  // User plan
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();

  const plan = profile?.plan || "free";

  return c.json({
    today: {
      inputTokens: todayUsage?.total_input_tokens || 0,
      outputTokens: todayUsage?.total_output_tokens || 0,
      requests: todayUsage?.request_count || 0,
    },
    month: monthUsage,
    plan,
  });
});

/**
 * GET /api/usage/history — Daily usage breakdown for charts.
 * Query: ?days=30 (default 30, max 90)
 */
usage.get("/api/usage/history", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const days = Math.min(parseInt(c.req.query("days") || "30", 10), 90);
  const supabase = getSupabaseAdmin(c.env);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from("usage_daily")
    .select("date, total_input_tokens, total_output_tokens, request_count")
    .eq("user_id", userId)
    .gte("date", startStr)
    .order("date", { ascending: true })
    .limit(days);

  if (error) {
    return c.json({ error: "Failed to fetch usage history" }, 500);
  }

  return c.json({
    days: rows || [],
  });
});

/**
 * POST /api/usage/record — Record final token counts from streaming responses.
 * Called by the extension after a streaming LLM call completes.
 */
usage.post("/api/usage/record", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs?: number;
    toolName?: string;
  }>();

  if (!body.model || body.inputTokens == null || body.outputTokens == null) {
    return c.json({ error: "model, inputTokens, outputTokens required" }, 400);
  }

  // Validate that token counts are non-negative integers within bounds
  if (
    !Number.isInteger(body.inputTokens) ||
    !Number.isInteger(body.outputTokens) ||
    body.inputTokens < 0 ||
    body.outputTokens < 0 ||
    body.inputTokens > MAX_TOKEN_VALUE ||
    body.outputTokens > MAX_TOKEN_VALUE
  ) {
    return c.json(
      {
        error: "inputTokens and outputTokens must be non-negative integers <= 10,000,000",
      },
      400
    );
  }

  const supabase = getSupabaseAdmin(c.env);
  const today = new Date().toISOString().slice(0, 10);

  // Insert detailed record
  await supabase.from("usage_records").insert({
    user_id: userId,
    model: body.model,
    input_tokens: body.inputTokens,
    output_tokens: body.outputTokens,
    latency_ms: body.latencyMs || 0,
    tool_name: body.toolName || "streaming",
  });

  // Upsert daily aggregate
  await supabase.rpc("increment_daily_usage", {
    p_user_id: userId,
    p_date: today,
    p_input_tokens: body.inputTokens,
    p_output_tokens: body.outputTokens,
  });

  return c.json({ ok: true });
});

export { usage };
