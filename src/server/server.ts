import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as path from "path";
import { createStore } from "./store";
import { repoOpen, repoTree, repoFile, repoSearch, repoDiff, hasActiveRepo } from "./tools/repo";
import { codeImportGraph, codePatternScan } from "./tools/code";
import { patchPropose, patchValidate, applyPatchToFile } from "./tools/patch";
import { recordEvent } from "./tools/audit";
import { runReview, cancelActiveReview } from "./orchestrator";
import { chatQuery, validateFinding, generatePatchFix } from "./chat";
import { execCommand } from "./tools/exec";
import { webSearch } from "./tools/web";

// Initialize store
const dbPath = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".chainreview",
  "chainreview.db"
);

// Ensure directory exists
import * as fs from "fs";
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const store = createStore(dbPath);

// Create MCP server
const server = new McpServer({
  name: "chainreview-crp",
  version: "0.1.0",
});

// ── Repo Context Tools ──

server.tool(
  "crp.repo.open",
  "Open/initialize a repository for review",
  { repoPath: z.string().describe("Absolute path to the git repository") },
  async (args) => {
    const result = await repoOpen(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.tool(
  "crp.repo.tree",
  "Get repository file tree",
  {
    maxDepth: z.number().optional().describe("Maximum directory depth to traverse"),
    pattern: z.string().optional().describe("Filter files by pattern"),
  },
  async (args) => {
    await ensureRepoOpen();
    const result = await repoTree(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.tool(
  "crp.repo.file",
  "Read file contents",
  {
    path: z.string().describe("Relative path to the file"),
    startLine: z.number().optional().describe("Start line (1-based)"),
    endLine: z.number().optional().describe("End line (1-based)"),
  },
  async (args) => {
    await ensureRepoOpen();
    const result = await repoFile(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.tool(
  "crp.repo.search",
  "Search across repository using ripgrep",
  {
    pattern: z.string().describe("Search pattern (regex)"),
    glob: z.string().optional().describe("Glob pattern to filter files"),
    maxResults: z.number().optional().describe("Maximum number of results"),
  },
  async (args) => {
    await ensureRepoOpen();
    const result = await repoSearch(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.tool(
  "crp.repo.diff",
  "Get diff (staged, unstaged, or between refs)",
  {
    ref1: z.string().optional().describe("First git ref"),
    ref2: z.string().optional().describe("Second git ref"),
    staged: z.boolean().optional().describe("Show staged changes"),
  },
  async (args) => {
    await ensureRepoOpen();
    const result = await repoDiff(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── Structure + Scanning Tools ──

server.tool(
  "crp.code.import_graph",
  "Extract TypeScript import graph with cycle detection",
  {
    path: z.string().optional().describe("Subdirectory to analyze (relative)"),
  },
  async (args) => {
    await ensureRepoOpen();
    const result = await codeImportGraph(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.tool(
  "crp.code.pattern_scan",
  "Run Semgrep pattern scan",
  {
    config: z.string().optional().describe("Semgrep config (default: auto)"),
    pattern: z.string().optional().describe("Specific pattern to scan for"),
  },
  async (args) => {
    await ensureRepoOpen();
    const result = await codePatternScan(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── Call Graph + Symbol Resolution Tools (FastCode-inspired) ──

server.tool(
  "crp.code.call_graph",
  "Build a function-level call graph showing which functions call which, with fan-in/fan-out metrics per file. Fan-in = how many files depend on this file. Fan-out = how many files this file depends on.",
  {
    path: z.string().optional().describe("Subdirectory to analyze (relative to repo root)"),
  },
  async (args) => {
    await ensureRepoOpen();
    const { codeCallGraph } = await import("./tools/graph");
    const result = await codeCallGraph(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.tool(
  "crp.code.symbol_lookup",
  "Find the definition and all references/usages of a symbol (function, class, variable, interface) across the codebase. Returns definition location, all reference locations, and whether the symbol is exported.",
  {
    symbol: z.string().describe("Symbol name to look up (e.g. function name, class name)"),
    file: z.string().optional().describe("Optional file path to narrow the search"),
  },
  async (args) => {
    await ensureRepoOpen();
    const { codeSymbolLookup } = await import("./tools/graph");
    const result = await codeSymbolLookup(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.tool(
  "crp.code.impact_analysis",
  "Analyze the blast radius of changing a file — shows all files that transitively depend on it via function calls. Useful for understanding the downstream impact of modifications.",
  {
    file: z.string().describe("Relative file path to analyze impact for"),
    depth: z.number().optional().describe("Max traversal depth (default: 3)"),
  },
  async (args) => {
    await ensureRepoOpen();
    const { codeImpactAnalysis } = await import("./tools/graph");
    const result = await codeImpactAnalysis(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── Patch + Validation Tools ──

server.tool(
  "crp.patch.propose",
  "Generate a unified diff patch for a finding",
  {
    findingId: z.string().describe("ID of the finding to patch"),
    filePath: z.string().describe("Relative path to the file"),
    originalCode: z.string().describe("Original code section"),
    patchedCode: z.string().describe("Patched code section"),
    description: z.string().describe("Description of the patch"),
    runId: z.string().describe("Current review run ID"),
  },
  async (args) => {
    const { runId, ...patchArgs } = args;
    await ensureRepoOpen({ runId });
    const result = await patchPropose(patchArgs, store, runId);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.tool(
  "crp.patch.validate",
  "Validate a patch (apply clean + syntax check)",
  {
    patchId: z.string().describe("ID of the patch to validate"),
  },
  async (args) => {
    await ensureRepoOpen();
    const result = await patchValidate(args, store);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── Audit Tool ──

server.tool(
  "crp.review.record_event",
  "Record a chain-of-review event",
  {
    runId: z.string().describe("Review run ID"),
    type: z.enum([
      "agent_started",
      "agent_completed",
      "evidence_collected",
      "finding_emitted",
      "finding_explained",
      "patch_proposed",
      "patch_validated",
      "patch_generated",
      "human_accepted",
      "human_rejected",
      "false_positive_marked",
      "issue_fixed",
      "handoff_to_agent",
      "validation_completed",
    ]).describe("Event type"),
    agent: z.enum(["architecture", "security", "validator", "bugs", "explainer", "system"]).optional().describe("Agent name"),
    data: z.record(z.unknown()).describe("Event data"),
  },
  async (args) => {
    const result = await recordEvent(
      {
        runId: args.runId,
        type: args.type,
        agent: args.agent,
        data: args.data as Record<string, unknown>,
      },
      store
    );
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── Stream event to stderr for real-time extension pickup ──
function streamEvent(event: Record<string, unknown>) {
  const line = JSON.stringify({ __crp_stream: true, ...event });
  process.stderr.write(line + "\n");
}

// ── High-level Orchestration Tool (with stderr streaming) ──

server.tool(
  "crp.review.run",
  "Run a full review pipeline (evidence collection + agents + validation)",
  {
    repoPath: z.string().describe("Absolute path to the git repository"),
    mode: z.enum(["repo", "diff"]).describe("Review mode"),
    agents: z.array(z.enum(["security", "architecture", "bugs"])).optional().describe("Which agents to run. If omitted, runs all agents."),
  },
  async (args) => {
    requireApiKey("crp.review.run");
    const options = args.agents && args.agents.length > 0 ? { agents: args.agents as ("security" | "architecture" | "bugs")[] } : undefined;
    const result = await runReview(args.repoPath, args.mode, store, {
      onEvent: (event) => {
        streamEvent({ type: "event", event });
      },
      onFinding: (finding) => {
        streamEvent({ type: "finding", finding });
      },
      onToolCall: (_agent, _tool, _toolArgs) => {},
      onToolResult: (_agent, _tool, _toolResult) => {},
      onText: (_agent, _text, _done) => {},
      onPatch: (patch) => {
        streamEvent({ type: "patch", patch });
      },
    }, options);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  }
);

// ── Cancel Review Tool ──

server.tool(
  "crp.review.cancel",
  "Cancel the currently running review",
  {},
  async () => {
    cancelActiveReview();
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ cancelled: true }) }],
    };
  }
);

// ── Patch Apply Tool (for extension host) ──

server.tool(
  "crp.patch.apply",
  "Apply a validated patch to the file on disk",
  {
    patchId: z.string().describe("ID of the patch to apply"),
  },
  async (args) => {
    await ensureRepoOpen();
    const result = await applyPatchToFile(args.patchId, store);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── Query Tools (for extension host) ──

server.tool(
  "crp.review.get_findings",
  "Get all findings for a review run",
  {
    runId: z.string().describe("Review run ID"),
  },
  async (args) => {
    const findings = store.getFindings(args.runId);
    return { content: [{ type: "text" as const, text: JSON.stringify(findings) }] };
  }
);

server.tool(
  "crp.review.get_events",
  "Get all events for a review run",
  {
    runId: z.string().describe("Review run ID"),
  },
  async (args) => {
    const events = store.getEvents(args.runId);
    return { content: [{ type: "text" as const, text: JSON.stringify(events) }] };
  }
);

// ── Review History Tools ──

server.tool(
  "crp.review.list_runs",
  "List past review runs with summary stats",
  {
    limit: z.number().optional().describe("Max runs to return (default: 50)"),
  },
  async (args) => {
    const runs = store.getReviewRuns(args.limit);
    return { content: [{ type: "text" as const, text: JSON.stringify(runs) }] };
  }
);

server.tool(
  "crp.review.delete_run",
  "Delete a review run and all associated data",
  {
    runId: z.string().describe("Review run ID to delete"),
  },
  async (args) => {
    store.deleteRun(args.runId);
    return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, runId: args.runId }) }] };
  }
);

// ── Chat Message Persistence Tools ──

server.tool(
  "crp.review.save_chat_messages",
  "Save chat messages for a review run (persists to SQLite for task history)",
  {
    runId: z.string().describe("Review run ID"),
    messagesJson: z.string().describe("JSON-serialized chat messages array"),
  },
  async (args) => {
    store.saveChatMessages(args.runId, args.messagesJson);
    return { content: [{ type: "text" as const, text: JSON.stringify({ saved: true, runId: args.runId }) }] };
  }
);

server.tool(
  "crp.review.get_chat_messages",
  "Get saved chat messages for a review run",
  {
    runId: z.string().describe("Review run ID"),
  },
  async (args) => {
    const messagesJson = store.getChatMessages(args.runId);
    return { content: [{ type: "text" as const, text: messagesJson || "[]" }] };
  }
);

// ── Ensure Repo is Open ──
// CRP tools (repo, code, exec) require an active repo path.
// If the server process restarted or no review was run yet, we need to
// re-open the repo. This looks up the repo path from the most recent run
// in the store, or from the finding's evidence if a runId isn't available.

async function ensureRepoOpen(hint?: { runId?: string; findingJson?: string }): Promise<void> {
  if (hasActiveRepo()) return; // Already open, nothing to do

  // Strategy 1: Look up repo path from a specific run
  if (hint?.runId) {
    const repoPath = store.getRunRepoPath(hint.runId);
    if (repoPath) {
      await repoOpen({ repoPath });
      return;
    }
  }

  // Strategy 2: Get the most recent run's repo path
  const runs = store.getReviewRuns(1);
  if (runs.length > 0 && runs[0].repoPath) {
    await repoOpen({ repoPath: runs[0].repoPath });
    return;
  }

  throw new Error(
    "No repository is open and no previous review runs found. " +
    "Please run a code review first, or open a repo with crp.repo.open."
  );
}

// ── API Key Guard ──
// Gives a clear error for LLM-dependent tools instead of cryptic SDK failures

function requireApiKey(toolName: string): void {
  const hasByokKey = !!process.env.ANTHROPIC_API_KEY;
  const hasManagedAuth =
    process.env.CHAINREVIEW_MODE === "managed" &&
    !!process.env.CHAINREVIEW_JWT &&
    !!process.env.CHAINREVIEW_PROXY_URL;

  if (!hasByokKey && !hasManagedAuth) {
    throw new Error(
      `${toolName} requires authentication. ` +
      `Either set ANTHROPIC_API_KEY (via VS Code settings, env variable, .env file, or ~/.anthropic/api_key), ` +
      `or sign in to ChainReview for managed mode.`
    );
  }
}

// ── Chat Query Tool (with real-time streaming) ──
// Streams thinking, text, tool calls, and tool results via stderr
// so the extension can push them to the webview incrementally.

server.tool(
  "crp.chat.query",
  "Ask a question about the repository",
  {
    query: z.string().describe("The user's question about the repository"),
    runId: z.string().optional().describe("Optional review run ID for context"),
    conversationHistory: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })).optional().describe("Previous conversation messages for multi-turn context"),
  },
  async (args) => {
    requireApiKey("crp.chat.query");
    await ensureRepoOpen({ runId: args.runId });
    const result = await chatQuery(args.query, args.runId, store, {
      onTextDelta: (delta) => {
        streamEvent({ type: "chatTextDelta", delta });
      },
      onThinkingDelta: (delta) => {
        streamEvent({ type: "chatThinkingDelta", delta });
      },
      onThinking: (text) => {
        streamEvent({ type: "chatThinking", text });
      },
      onText: (text) => {
        streamEvent({ type: "chatText", text });
      },
      onToolCall: (tool, toolArgs) => {
        streamEvent({ type: "chatToolCall", tool, args: toolArgs });
      },
      onToolResult: (tool, resultStr) => {
        streamEvent({ type: "chatToolResult", tool, result: resultStr });
      },
    }, {
      // Review callbacks — used when chat agent decides to spawn sub-agents
      // These stream events through the same stderr pipeline so the extension
      // can display agent cards, tool calls, and findings in real-time
      reviewCallbacks: {
        onEvent: (event) => {
          streamEvent({ type: "event", event });
        },
        onFinding: (finding) => {
          streamEvent({ type: "finding", finding });
        },
        onToolCall: (_agent, _tool, _toolArgs) => {},
        onToolResult: (_agent, _tool, _toolResult) => {},
        onText: (_agent, _text, _done) => {},
        onPatch: (patch) => {
          streamEvent({ type: "patch", patch });
        },
      },
    }, args.conversationHistory);

    // If the chat agent spawned a review, include the review result
    // The extension uses this to transition UI state
    if (result.spawnedReview) {
      streamEvent({
        type: "chatSpawnedReview",
        ...result.spawnedReview,
      });
    }

    // ── Flush sentinel: signal that all streaming events have been emitted ──
    // This helps the extension know stderr is complete before processing the MCP result.
    // Without this, stderr events (especially final text deltas) may arrive AFTER
    // the MCP result due to stdio buffering, causing the answer to be silently dropped.
    streamEvent({ type: "chatStreamComplete" });

    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── Validate Finding Tool (with real-time streaming) ──

server.tool(
  "crp.review.validate_finding",
  "Run a validator agent to challenge and verify a finding",
  {
    findingJson: z.string().describe("JSON-serialized finding to validate"),
  },
  async (args) => {
    requireApiKey("crp.review.validate_finding");
    await ensureRepoOpen({ findingJson: args.findingJson });
    const result = await validateFinding(args.findingJson, {
      onTextDelta: (delta) => {
        streamEvent({ type: "validateTextDelta", delta });
      },
      onThinkingDelta: (delta) => {
        streamEvent({ type: "validateThinkingDelta", delta });
      },
      onThinking: (text) => {
        streamEvent({ type: "validateThinking", text });
      },
      onText: (text) => {
        streamEvent({ type: "validateText", text });
      },
      onToolCall: (tool, toolArgs) => {
        streamEvent({ type: "validateToolCall", tool, args: toolArgs });
      },
      onToolResult: (tool, resultStr) => {
        streamEvent({ type: "validateToolResult", tool, result: resultStr });
      },
    });

    // Flush sentinel for validate stream
    streamEvent({ type: "validateStreamComplete" });

    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── Patch Generation Tool (LLM-powered) ──

server.tool(
  "crp.patch.generate",
  "Generate a fixed version of code using LLM analysis",
  {
    filePath: z.string().describe("Path to the file being patched"),
    originalCode: z.string().describe("Original code snippet"),
    findingTitle: z.string().describe("Title of the finding"),
    findingDescription: z.string().describe("Description of the issue"),
  },
  async (args) => {
    requireApiKey("crp.patch.generate");
    const result = await generatePatchFix(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── Shell Command Execution Tool ──

server.tool(
  "crp.exec.command",
  "Execute a read-only shell command (allowlisted: wc, find, ls, cat, head, tail, grep, git log/show/blame/diff/status, npm ls, tsc --noEmit, etc.)",
  {
    command: z.string().describe("Shell command to execute"),
    timeout: z.number().optional().describe("Timeout in ms (default: 10000)"),
  },
  async (args) => {
    await ensureRepoOpen();
    const result = await execCommand(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── Web Search Tool ──

server.tool(
  "crp.web.search",
  "Search the web for information (security advisories, best practices, documentation, CVEs, etc.)",
  {
    query: z.string().describe("Web search query"),
    maxResults: z.number().optional().describe("Max results (default: 5)"),
  },
  async (args) => {
    const result = await webSearch(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── Azure DevOps Tools ──

import {
  azureListPRs,
  azureGetPR,
  azureGetPRThreads,
  azurePostPRComment,
  azurePostPRSummary,
  azureUpdateThreadStatus,
  azureGetFileContent,
  azureResolveAllChainReviewThreads,
} from "./tools/azure";

const azureSchema = {
  orgUrl: z.string().describe("Azure DevOps org URL, e.g. https://dev.azure.com/myorg"),
  project: z.string().describe("Azure DevOps project name"),
  repoName: z.string().describe("Azure Git repository name"),
  pat: z.string().describe("Azure DevOps Personal Access Token"),
};

server.tool(
  "crp.azure.list_prs",
  "List pull requests in an Azure DevOps Git repository",
  {
    ...azureSchema,
    status: z.enum(["active", "completed", "abandoned", "all"]).optional().describe("PR status filter (default: active)"),
  },
  async (args) => {
    const prs = await azureListPRs(args);
    return { content: [{ type: "text", text: JSON.stringify(prs, null, 2) }] };
  }
);

server.tool(
  "crp.azure.get_pr",
  "Fetch a pull request with its unified diff and changed file list from Azure DevOps",
  {
    ...azureSchema,
    prId: z.number().describe("Pull request ID"),
  },
  async (args) => {
    const result = await azureGetPR(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "crp.azure.get_pr_threads",
  "Get all comment threads on an Azure DevOps pull request",
  {
    ...azureSchema,
    prId: z.number().describe("Pull request ID"),
  },
  async (args) => {
    const threads = await azureGetPRThreads(args);
    return { content: [{ type: "text", text: JSON.stringify(threads, null, 2) }] };
  }
);

server.tool(
  "crp.azure.post_pr_comment",
  "Post a ChainReview finding as an inline comment on an Azure DevOps pull request",
  {
    ...azureSchema,
    prId: z.number().describe("Pull request ID"),
    filePath: z.string().describe("File path in the repo, e.g. /src/index.ts"),
    lineNumber: z.number().describe("Line number for the inline comment"),
    comment: z.string().describe("Finding description / comment text"),
    severity: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
  },
  async (args) => {
    const result = await azurePostPRComment(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.tool(
  "crp.azure.post_pr_summary",
  "Post a ChainReview summary comment on an Azure DevOps pull request with findings breakdown",
  {
    ...azureSchema,
    prId: z.number().describe("Pull request ID"),
    totalFindings: z.number(),
    criticalCount: z.number(),
    highCount: z.number(),
    mediumCount: z.number(),
    lowCount: z.number(),
    validatedCount: z.number(),
    falsePositivesRemoved: z.number(),
  },
  async (args) => {
    const result = await azurePostPRSummary(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.tool(
  "crp.azure.update_thread_status",
  "Update the status of an Azure DevOps PR comment thread (e.g. mark as fixed)",
  {
    ...azureSchema,
    prId: z.number().describe("Pull request ID"),
    threadId: z.number().describe("Thread ID"),
    status: z.enum(["active", "fixed", "wontFix", "closed", "byDesign", "pending"]),
  },
  async (args) => {
    await azureUpdateThreadStatus(args);
    return { content: [{ type: "text", text: `Thread ${args.threadId} updated to ${args.status}` }] };
  }
);

server.tool(
  "crp.azure.get_file",
  "Fetch a file's content directly from an Azure DevOps Git repository",
  {
    ...azureSchema,
    filePath: z.string().describe("File path in the repo, e.g. /src/index.ts"),
    branch: z.string().optional().describe("Branch name (default: main)"),
  },
  async (args) => {
    const content = await azureGetFileContent(args);
    return { content: [{ type: "text", text: content }] };
  }
);

server.tool(
  "crp.azure.resolve_all_threads",
  "Resolve all active ChainReview comment threads on an Azure DevOps pull request (use before re-review)",
  {
    ...azureSchema,
    prId: z.number().describe("Pull request ID"),
  },
  async (args) => {
    const result = await azureResolveAllChainReviewThreads(args);
    return { content: [{ type: "text", text: `Resolved ${result.resolved} ChainReview threads` }] };
  }
);

// ── Start server ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log API key status so the extension can see it in stderr
  if (process.env.ANTHROPIC_API_KEY) {
    console.error("ChainReview CRP server started (API key: present)");
  } else {
    console.error("ChainReview CRP server started (WARNING: ANTHROPIC_API_KEY not set — LLM features will fail)");
  }
  if (process.env.BRAVE_SEARCH_API_KEY) {
    console.error("ChainReview: Brave Search API key: present");
  }
}

// Ensure database is cleanly closed on process exit
process.on("SIGINT", () => { store.close(); process.exit(0); });
process.on("SIGTERM", () => { store.close(); process.exit(0); });
process.on("exit", () => { try { store.close(); } catch { /* already closed */ } });

main().catch((err) => {
  console.error("Fatal error:", err);
  store.close();
  process.exit(1);
});
