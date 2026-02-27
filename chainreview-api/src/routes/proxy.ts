import { Hono } from "hono";
import type { Env, Variables } from "../index";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { usageMiddleware } from "../middleware/usage";
import { proxyToAnthropic } from "../lib/anthropic";

const proxy = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Models allowed through the proxy. Reject anything not on this list. */
const MODEL_ALLOWLIST = [
  "claude-opus-4-6",
  "claude-sonnet-4-5-20250929",
  "claude-haiku-4-5-20251001",
];

/**
 * LLM Proxy: POST /v1/messages
 * Mimics the Anthropic API surface so the SDK's `baseURL` parameter
 * is all that's needed to route traffic through this proxy.
 *
 * Flow:
 * 1. Verify JWT (authMiddleware)
 * 2. Check rate limits (rateLimitMiddleware)
 * 3. Forward to Anthropic with server-managed API key
 * 4. Stream response back to client
 * 5. Record usage (usageMiddleware -- after response)
 */
proxy.post(
  "/v1/messages",
  authMiddleware,
  rateLimitMiddleware,
  usageMiddleware,
  async (c) => {
    const body = await c.req.text();

    // Validate that the body is valid JSON with required fields
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body);
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    // Validate `messages` is a non-empty array
    if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) {
      return c.json({ error: "Invalid request: messages must be a non-empty array" }, 400);
    }

    // Validate `model` is a string
    if (typeof parsed.model !== "string" || parsed.model.trim().length === 0) {
      return c.json({ error: "Invalid request: model must be a non-empty string" }, 400);
    }

    // Enforce model allowlist
    if (!MODEL_ALLOWLIST.includes(parsed.model)) {
      return c.json(
        {
          error: "Model not allowed",
          detail: `Allowed models: ${MODEL_ALLOWLIST.join(", ")}`,
        },
        400
      );
    }

    return proxyToAnthropic(c.env, c.req.raw, body);
  }
);

// NOTE: CORS preflight is handled by the global cors() middleware in index.ts.
// No duplicate OPTIONS handler needed here.

export { proxy };
