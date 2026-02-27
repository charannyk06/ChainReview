/**
 * Azure DevOps Git integration tools for ChainReview
 *
 * Provides deep integration with Azure Repos:
 * - Fetch PR diffs, file changes, threads, and metadata
 * - Post review findings as PR comments
 * - Resolve/reactivate comment threads
 * - Fetch repo file contents directly from Azure
 */

import * as https from "https";
import { URL } from "url";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AzureConfig {
  orgUrl: string;      // e.g. https://dev.azure.com/myorg
  project: string;     // e.g. MyProject
  repoName: string;    // e.g. MyRepo
  pat: string;         // Personal Access Token
}

export interface AzurePRInfo {
  id: number;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  status: string;
  author: string;
  createdDate: string;
  url: string;
}

export interface AzurePRFile {
  path: string;
  changeType: "add" | "edit" | "delete" | "rename";
  diffContent?: string;
}

export interface AzurePRThread {
  id: number;
  status: "active" | "fixed" | "wontFix" | "closed" | "byDesign" | "pending";
  comments: Array<{
    id: number;
    content: string;
    author: string;
    publishedDate: string;
  }>;
  filePath?: string;
  lineNumber?: number;
}

// ── Input validation ──────────────────────────────────────────────────────────

/** Validate and sanitize Azure DevOps org URL — must be https */
function validateOrgUrl(orgUrl: string): string {
  const url = orgUrl.trim().replace(/\/$/, "");
  if (!url.startsWith("https://")) {
    throw new Error("Azure DevOps org URL must use HTTPS");
  }
  // Only allow Azure DevOps domains
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("dev.azure.com") &&
        !parsed.hostname.endsWith("visualstudio.com") &&
        !parsed.hostname.endsWith("azure.com")) {
      throw new Error("Invalid Azure DevOps hostname");
    }
  } catch (e: any) {
    throw new Error(`Invalid Azure DevOps org URL: ${e.message}`);
  }
  return url;
}

/** Sanitize a file path for use in Azure API — prevent injection in URL path segments */
function sanitizeAzureFilePath(filePath: string): string {
  // Normalize path separators, strip null bytes and control chars
  const clean = filePath.replace(/\0/g, "").replace(/[\x00-\x1f]/g, "");
  // Ensure starts with / for consistency
  return clean.startsWith("/") ? clean : `/${clean}`;
}

/** Sanitize project/repo name — only allow safe chars */
function sanitizeName(name: string): string {
  // Azure project/repo names can include alphanumeric, spaces, hyphens, underscores, dots
  // Reject anything suspicious
  if (/[<>'"&\x00-\x1f]/.test(name)) {
    throw new Error(`Invalid characters in Azure project/repo name: ${name}`);
  }
  return name.trim();
}

// ── HTTP helper ────────────────────────────────────────────────────────────────

const AZURE_REQUEST_TIMEOUT_MS = 30_000;

function azureRequest<T>(
  config: AzureConfig,
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    const base = validateOrgUrl(config.orgUrl);
    const project = sanitizeName(config.project);
    const url = new URL(`${base}/${encodeURIComponent(project)}/_apis/${path}`);
    const token = Buffer.from(`:${config.pat}`).toString("base64");
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: `Basic ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
      },
    };

    // Only allow HTTPS for Azure requests
    if (url.protocol !== "https:") {
      reject(new Error("Azure DevOps requests must use HTTPS"));
      return;
    }

    const req = https.request(options, (res) => {
      let data = "";
      // Cap response body to 10MB to prevent memory exhaustion
      let totalBytes = 0;
      const MAX_BYTES = 10 * 1024 * 1024;

      res.on("data", (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_BYTES) {
          req.destroy(new Error("Azure API response too large (>10MB)"));
          return;
        }
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          // Redact PAT from any error messages
          const safeData = data.slice(0, 300).replace(/[A-Za-z0-9+/]{40,}/g, "[REDACTED]");
          reject(new Error(`Azure API ${res.statusCode}: ${safeData}`));
          return;
        }
        try {
          resolve(JSON.parse(data) as T);
        } catch {
          resolve(data as unknown as T);
        }
      });
    });

    // Request timeout
    req.setTimeout(AZURE_REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Azure API request timed out after ${AZURE_REQUEST_TIMEOUT_MS}ms`));
    });

    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Tool: List open PRs ────────────────────────────────────────────────────────

export async function azureListPRs(args: {
  orgUrl: string;
  project: string;
  repoName: string;
  pat: string;
  status?: "active" | "completed" | "abandoned" | "all";
}): Promise<AzurePRInfo[]> {
  const config: AzureConfig = {
    orgUrl: args.orgUrl,
    project: args.project,
    repoName: args.repoName,
    pat: args.pat,
  };

  const status = args.status || "active";
  const data = await azureRequest<{ value: any[] }>(
    config,
    `git/repositories/${encodeURIComponent(args.repoName)}/pullrequests?searchCriteria.status=${status}&api-version=7.1`
  );

  return (data.value || []).map((pr) => ({
    id: pr.pullRequestId,
    title: pr.title,
    description: pr.description || "",
    sourceBranch: pr.sourceRefName?.replace("refs/heads/", "") || "",
    targetBranch: pr.targetRefName?.replace("refs/heads/", "") || "",
    status: pr.status,
    author: pr.createdBy?.displayName || "Unknown",
    createdDate: pr.creationDate,
    url: pr.url,
  }));
}

// ── Tool: Get PR info + diff ───────────────────────────────────────────────────

export async function azureGetPR(args: {
  orgUrl: string;
  project: string;
  repoName: string;
  pat: string;
  prId: number;
}): Promise<{ pr: AzurePRInfo; files: AzurePRFile[]; diff: string }> {
  const config: AzureConfig = {
    orgUrl: args.orgUrl,
    project: args.project,
    repoName: args.repoName,
    pat: args.pat,
  };

  const repoEnc = encodeURIComponent(args.repoName);

  // Fetch PR metadata
  const pr = await azureRequest<any>(
    config,
    `git/repositories/${repoEnc}/pullrequests/${args.prId}?api-version=7.1`
  );

  // Fetch changed files (iterations)
  const iterationsData = await azureRequest<{ value: any[] }>(
    config,
    `git/repositories/${repoEnc}/pullrequests/${args.prId}/iterations?api-version=7.1`
  );

  const iterations = iterationsData.value || [];
  const latestIteration = iterations[iterations.length - 1];
  const iterationId = latestIteration?.id || 1;

  // Fetch file changes for latest iteration
  const changesData = await azureRequest<{ changeEntries: any[] }>(
    config,
    `git/repositories/${repoEnc}/pullrequests/${args.prId}/iterations/${iterationId}/changes?api-version=7.1`
  );

  const files: AzurePRFile[] = (changesData.changeEntries || []).map((entry: any) => ({
    path: entry.item?.path || "",
    changeType: entry.changeType?.toLowerCase() === "add" ? "add"
      : entry.changeType?.toLowerCase() === "delete" ? "delete"
      : entry.changeType?.toLowerCase() === "rename" ? "rename"
      : "edit",
  }));

  // Build unified diff by fetching each changed file's content
  const diffParts: string[] = [];

  for (const file of files.slice(0, 20)) { // limit to 20 files
    if (!file.path || file.changeType === "delete") continue;
    try {
      // Get diff for this file from the PR iteration
      const fileDiff = await azureRequest<any>(
        config,
        `git/repositories/${repoEnc}/diffs/commits?baseVersion=${encodeURIComponent(pr.targetRefName)}&targetVersion=${encodeURIComponent(pr.sourceRefName)}&baseVersionType=branch&targetVersionType=branch&path=${encodeURIComponent(file.path)}&api-version=7.1`
      );

      if (fileDiff.blocks) {
        const lines: string[] = [`--- a${file.path}`, `+++ b${file.path}`];
        for (const block of fileDiff.blocks) {
          if (block.changeType === 0) continue; // unchanged
          lines.push(`@@ -${block.mOriginalStart || 0},${block.mOriginalCount || 0} +${block.mModifiedStart || 0},${block.mModifiedCount || 0} @@`);
          for (const line of block.originalLines || []) lines.push(`-${line}`);
          for (const line of block.modifiedLines || []) lines.push(`+${line}`);
        }
        if (lines.length > 2) {
          diffParts.push(lines.join("\n"));
          file.diffContent = lines.join("\n");
        }
      }
    } catch {
      // Skip files that fail to diff
    }
  }

  return {
    pr: {
      id: pr.pullRequestId,
      title: pr.title,
      description: pr.description || "",
      sourceBranch: pr.sourceRefName?.replace("refs/heads/", "") || "",
      targetBranch: pr.targetRefName?.replace("refs/heads/", "") || "",
      status: pr.status,
      author: pr.createdBy?.displayName || "Unknown",
      createdDate: pr.creationDate,
      url: pr.url,
    },
    files,
    diff: diffParts.join("\n\n"),
  };
}

// ── Tool: Get PR threads (existing comments) ───────────────────────────────────

export async function azureGetPRThreads(args: {
  orgUrl: string;
  project: string;
  repoName: string;
  pat: string;
  prId: number;
}): Promise<AzurePRThread[]> {
  const config: AzureConfig = {
    orgUrl: args.orgUrl,
    project: args.project,
    repoName: args.repoName,
    pat: args.pat,
  };

  const data = await azureRequest<{ value: any[] }>(
    config,
    `git/repositories/${encodeURIComponent(args.repoName)}/pullrequests/${args.prId}/threads?api-version=7.1`
  );

  return (data.value || []).map((thread: any) => ({
    id: thread.id,
    status: thread.status || "active",
    filePath: thread.threadContext?.filePath,
    lineNumber: thread.threadContext?.rightFileStart?.line,
    comments: (thread.comments || [])
      .filter((c: any) => !c.isDeleted)
      .map((c: any) => ({
        id: c.id,
        content: c.content || "",
        author: c.author?.displayName || "Unknown",
        publishedDate: c.publishedDate,
      })),
  }));
}

// ── Tool: Post PR comment (finding) ───────────────────────────────────────────

export async function azurePostPRComment(args: {
  orgUrl: string;
  project: string;
  repoName: string;
  pat: string;
  prId: number;
  filePath: string;
  lineNumber: number;
  comment: string;
  severity?: "critical" | "high" | "medium" | "low" | "info";
}): Promise<{ threadId: number; commentId: number }> {
  const config: AzureConfig = {
    orgUrl: args.orgUrl,
    project: args.project,
    repoName: args.repoName,
    pat: args.pat,
  };

  const severityEmoji: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🔵",
    info: "⚪",
  };

  const emoji = severityEmoji[args.severity || "medium"];
  const safePath = sanitizeAzureFilePath(args.filePath);
  // Sanitize comment content — strip null bytes
  const safeComment = args.comment.replace(/\0/g, "").slice(0, 4000);
  const content = `${emoji} **ChainReview** — ${args.severity?.toUpperCase() || "FINDING"}\n\n${safeComment}\n\n*Reviewed by [ChainReview](https://chainreview.dev) · Multi-Agent AI Code Reviewer*`;

  const body = {
    comments: [{ parentCommentId: 0, content, commentType: 1 }],
    status: "active",
    threadContext: {
      filePath: safePath,
      rightFileStart: { line: args.lineNumber, offset: 1 },
      rightFileEnd: { line: args.lineNumber, offset: 1 },
    },
  };

  const result = await azureRequest<any>(
    config,
    `git/repositories/${encodeURIComponent(args.repoName)}/pullrequests/${args.prId}/threads?api-version=7.1`,
    "POST",
    body
  );

  return {
    threadId: result.id,
    commentId: result.comments?.[0]?.id,
  };
}

// ── Tool: Post PR summary comment ─────────────────────────────────────────────

export async function azurePostPRSummary(args: {
  orgUrl: string;
  project: string;
  repoName: string;
  pat: string;
  prId: number;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  validatedCount: number;
  falsePositivesRemoved: number;
}): Promise<{ threadId: number }> {
  const config: AzureConfig = {
    orgUrl: args.orgUrl,
    project: args.project,
    repoName: args.repoName,
    pat: args.pat,
  };

  const {
    totalFindings, criticalCount, highCount, mediumCount, lowCount,
    validatedCount, falsePositivesRemoved
  } = args;

  const statusIcon = criticalCount > 0 ? "🔴" : highCount > 0 ? "🟠" : totalFindings > 0 ? "🟡" : "✅";

  const content = [
    `## ${statusIcon} ChainReview — Multi-Agent Code Review`,
    "",
    `**${totalFindings} finding${totalFindings !== 1 ? "s" : ""}** across ${criticalCount + highCount + mediumCount + lowCount} issues (${falsePositivesRemoved} false positives removed by Validator Agent)`,
    "",
    "| Severity | Count |",
    "|----------|-------|",
    `| 🔴 Critical | ${criticalCount} |`,
    `| 🟠 High | ${highCount} |`,
    `| 🟡 Medium | ${mediumCount} |`,
    `| 🔵 Low | ${lowCount} |`,
    "",
    `✅ ${validatedCount} findings validated by Validator Agent — all inline comments are evidence-backed.`,
    "",
    "*Powered by [ChainReview](https://chainreview.dev) · 5 specialized agents: Architecture, Security, Bugs, Explainer, Validator*",
  ].join("\n");

  const body = {
    comments: [{ parentCommentId: 0, content, commentType: 1 }],
    status: "closed",
  };

  const result = await azureRequest<any>(
    config,
    `git/repositories/${encodeURIComponent(args.repoName)}/pullrequests/${args.prId}/threads?api-version=7.1`,
    "POST",
    body
  );

  return { threadId: result.id };
}

// ── Tool: Update thread status ─────────────────────────────────────────────────

export async function azureUpdateThreadStatus(args: {
  orgUrl: string;
  project: string;
  repoName: string;
  pat: string;
  prId: number;
  threadId: number;
  status: "active" | "fixed" | "wontFix" | "closed" | "byDesign" | "pending";
}): Promise<void> {
  const config: AzureConfig = {
    orgUrl: args.orgUrl,
    project: args.project,
    repoName: args.repoName,
    pat: args.pat,
  };

  await azureRequest<any>(
    config,
    `git/repositories/${encodeURIComponent(args.repoName)}/pullrequests/${args.prId}/threads/${args.threadId}?api-version=7.1`,
    "PATCH",
    { status: args.status }
  );
}

// ── Tool: Get file content from Azure repo ────────────────────────────────────

export async function azureGetFileContent(args: {
  orgUrl: string;
  project: string;
  repoName: string;
  pat: string;
  filePath: string;
  branch?: string;
}): Promise<string> {
  const config: AzureConfig = {
    orgUrl: args.orgUrl,
    project: args.project,
    repoName: sanitizeName(args.repoName),
    pat: args.pat,
  };

  const branch = args.branch || "main";
  const safePath = sanitizeAzureFilePath(args.filePath);
  const data = await azureRequest<any>(
    config,
    `git/repositories/${encodeURIComponent(config.repoName)}/items?path=${encodeURIComponent(safePath)}&versionDescriptor.versionType=branch&versionDescriptor.version=${encodeURIComponent(branch)}&$format=text&api-version=7.1`
  );

  return typeof data === "string" ? data : JSON.stringify(data);
}

// ── Tool: Resolve all ChainReview threads ────────────────────────────────────

export async function azureResolveAllChainReviewThreads(args: {
  orgUrl: string;
  project: string;
  repoName: string;
  pat: string;
  prId: number;
}): Promise<{ resolved: number }> {
  const threads = await azureGetPRThreads(args);

  const chainReviewThreads = threads.filter((t) =>
    t.comments.some((c) => c.content.includes("ChainReview"))
  );

  let resolved = 0;
  for (const thread of chainReviewThreads) {
    if (thread.status === "active") {
      try {
        await azureUpdateThreadStatus({ ...args, threadId: thread.id, status: "fixed" });
        resolved++;
      } catch {
        // Skip
      }
    }
  }

  return { resolved };
}
