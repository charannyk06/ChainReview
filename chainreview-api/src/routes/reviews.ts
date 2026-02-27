import { Hono } from "hono";
import type { Env, Variables } from "../index";
import { authMiddleware } from "../middleware/auth";
import { getSupabaseAdmin } from "../lib/supabase";

const reviews = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Only these severity keys are allowed in severityBreakdown. */
const VALID_SEVERITY_KEYS = new Set(["critical", "high", "medium", "low", "info"]);

/**
 * POST /api/reviews/sync — Sync a review run summary from the extension.
 */
reviews.post("/api/reviews/sync", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    repoName: string;
    mode: string;
    findingsCount: number;
    severityBreakdown: Record<string, number>;
    durationMs: number;
  }>();

  if (!body.repoName || body.findingsCount == null) {
    return c.json({ error: "repoName and findingsCount required" }, 400);
  }

  // Validate severityBreakdown keys if provided
  if (body.severityBreakdown && typeof body.severityBreakdown === "object") {
    const invalidKeys = Object.keys(body.severityBreakdown).filter(
      (key) => !VALID_SEVERITY_KEYS.has(key)
    );
    if (invalidKeys.length > 0) {
      return c.json(
        {
          error: `Invalid severity keys: ${invalidKeys.join(", ")}. Allowed: ${[...VALID_SEVERITY_KEYS].join(", ")}`,
        },
        400
      );
    }

    // Validate that all values are non-negative integers
    for (const [key, value] of Object.entries(body.severityBreakdown)) {
      if (!Number.isInteger(value) || value < 0) {
        return c.json(
          { error: `severityBreakdown["${key}"] must be a non-negative integer` },
          400
        );
      }
    }
  }

  const supabase = getSupabaseAdmin(c.env);

  const { error } = await supabase.from("review_runs_cloud").insert({
    user_id: userId,
    repo_name: body.repoName,
    mode: body.mode || "repo",
    findings_count: body.findingsCount,
    severity_breakdown: body.severityBreakdown || {},
    duration_ms: body.durationMs || 0,
  });

  if (error) {
    return c.json({ error: "Failed to sync review" }, 500);
  }

  return c.json({ ok: true });
});

/**
 * GET /api/reviews — List user's cloud-synced review runs.
 * Query: ?limit=20&offset=0
 */
reviews.get("/api/reviews", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const supabase = getSupabaseAdmin(c.env);

  const { data, error, count } = await supabase
    .from("review_runs_cloud")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return c.json({ error: "Failed to fetch reviews" }, 500);
  }

  return c.json({ reviews: data || [], total: count || 0 });
});

export { reviews };
