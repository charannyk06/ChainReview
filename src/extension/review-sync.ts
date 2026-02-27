import * as vscode from "vscode";
import { getAuthState } from "./auth-state";
import type { Finding } from "./types";

const PROXY_URL_DEFAULT = "https://api.chainreview.dev";

interface ReviewSyncPayload {
  repoName: string;
  mode: string;
  findingsCount: number;
  severityBreakdown: Record<string, number>;
  durationMs: number;
}

/**
 * Optionally sync a review run summary to ChainReview cloud.
 * Only sends data when:
 * 1. User is in managed mode and authenticated
 * 2. User has opted in via `chainreview.syncReviews` setting
 */
export async function syncReviewToCloud(
  findings: Finding[],
  mode: string,
  durationMs: number
): Promise<void> {
  // Check opt-in setting
  const config = vscode.workspace.getConfiguration("chainreview");
  const syncEnabled = config.get<boolean>("syncReviews", false);
  if (!syncEnabled) return;

  // Check auth state
  const authState = getAuthState();
  if (authState.mode !== "managed" || !authState.jwt) return;

  // Build severity breakdown
  const severityBreakdown: Record<string, number> = {};
  for (const finding of findings) {
    const sev = finding.severity || "info";
    severityBreakdown[sev] = (severityBreakdown[sev] || 0) + 1;
  }

  // Get repo name from workspace
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const repoName = workspaceFolder?.name || "unknown";

  const proxyUrl = process.env.CHAINREVIEW_PROXY_URL || PROXY_URL_DEFAULT;

  const payload: ReviewSyncPayload = {
    repoName,
    mode,
    findingsCount: findings.length,
    severityBreakdown,
    durationMs,
  };

  try {
    const res = await fetch(`${proxyUrl}/api/reviews/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authState.jwt}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn(`ChainReview: Review sync failed (${res.status}): ${res.statusText}`);
    }
  } catch (err: any) {
    console.warn("ChainReview: Review sync error:", err.message);
  }
}

/**
 * Record final token usage from a streaming LLM response to the cloud.
 * Fire-and-forget — failures are silently logged.
 */
export async function recordStreamingUsage(opts: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  toolName?: string;
}): Promise<void> {
  const authState = getAuthState();
  if (authState.mode !== "managed" || !authState.jwt) return;

  const proxyUrl = process.env.CHAINREVIEW_PROXY_URL || PROXY_URL_DEFAULT;

  try {
    await fetch(`${proxyUrl}/api/usage/record`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authState.jwt}`,
      },
      body: JSON.stringify({
        model: opts.model,
        inputTokens: opts.inputTokens,
        outputTokens: opts.outputTokens,
        latencyMs: opts.latencyMs,
        toolName: opts.toolName || "streaming",
      }),
    });
  } catch {
    // Silent — usage recording is best-effort
  }
}
