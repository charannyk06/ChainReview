import { createMiddleware } from "hono/factory";
import type { Env, Variables } from "../index";
import { getSupabaseAdmin } from "../lib/supabase";

/**
 * Usage tracking middleware (runs AFTER the response is sent).
 * Parses Anthropic response headers/body for token counts and records to Supabase.
 */
export const usageMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const startMs = Date.now();
  await next();

  // Only track successful LLM proxy responses
  if (c.res.status !== 200) return;

  const userId = c.get("userId");
  if (!userId) return;

  // For streaming responses, we can't easily parse token counts from the body.
  // Instead, we record a base usage record and update it via a webhook or
  // parse the final SSE event. For non-streaming, parse the JSON body.
  const isStreaming = c.res.headers.get("content-type")?.includes("text/event-stream");

  if (isStreaming) {
    // For streaming: record a placeholder usage entry with streaming marker.
    // The extension can optionally POST final token counts to /api/usage/record.
    recordUsage(c.env, {
      userId,
      model: "unknown",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startMs,
      streaming: true,
    });
    return;
  }

  // For non-streaming responses, try to clone and parse
  try {
    const clone = c.res.clone();
    const body = await clone.json() as {
      model?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    if (body?.usage) {
      recordUsage(c.env, {
        userId,
        model: body.model || "unknown",
        inputTokens: body.usage.input_tokens || 0,
        outputTokens: body.usage.output_tokens || 0,
        latencyMs: Date.now() - startMs,
        streaming: false,
      });
    }
  } catch {
    // Parsing failed — skip usage recording
  }
});

interface UsageRecord {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  streaming: boolean;
}

/** Fire-and-forget insert into usage tables. Errors are logged, not thrown. */
function recordUsage(env: Env, record: UsageRecord) {
  const supabase = getSupabaseAdmin(env);
  const today = new Date().toISOString().slice(0, 10);

  // Insert detailed record
  Promise.resolve(
    supabase
      .from("usage_records")
      .insert({
        user_id: record.userId,
        model: record.model,
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
        latency_ms: record.latencyMs,
        tool_name: record.streaming ? "streaming" : "messages",
      })
  )
    .then(({ error }) => {
      if (error) {
        console.error("Failed to insert usage_record:", error.message);
      }
    })
    .catch((err: unknown) => {
      console.error("usage_records insert threw:", err);
    });

  // Upsert daily aggregate
  Promise.resolve(
    supabase.rpc("increment_daily_usage", {
      p_user_id: record.userId,
      p_date: today,
      p_input_tokens: record.inputTokens,
      p_output_tokens: record.outputTokens,
    })
  )
    .then(({ error }) => {
      if (error) {
        console.error("Failed to increment_daily_usage:", error.message);
      }
    })
    .catch((err: unknown) => {
      console.error("increment_daily_usage rpc threw:", err);
    });
}
