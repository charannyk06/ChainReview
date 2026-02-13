import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as path from "path";
import { createStore } from "./store";
import { repoOpen, repoTree, repoFile, repoSearch, repoDiff } from "./tools/repo";
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
    const result = await codePatternScan(args);
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
      "evidence_collected",
      "finding_emitted",
      "patch_proposed",
      "patch_validated",
      "human_accepted",
      "human_rejected",
      "false_positive_marked",
    ]).describe("Event type"),
    agent: z.enum(["architecture", "security", "validator"]).optional().describe("Agent name"),
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
  },
  async (args) => {
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
    });
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

// ── Chat Query Tool (with real-time streaming) ──
// Streams thinking, text, tool calls, and tool results via stderr
// so the extension can push them to the webview incrementally.

server.tool(
  "crp.chat.query",
  "Ask a question about the repository",
  {
    query: z.string().describe("The user's question about the repository"),
    runId: z.string().optional().describe("Optional review run ID for context"),
  },
  async (args) => {
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
    });
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

// ── Start server ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ChainReview CRP server started");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
