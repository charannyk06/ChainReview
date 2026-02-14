import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ToolUseBlock,
  TextBlock,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";
import { repoTree, repoFile, repoSearch, repoDiff } from "./tools/repo";
import { codeImportGraph, codePatternScan } from "./tools/code";
import { execCommand } from "./tools/exec";
import { webSearch } from "./tools/web";
import { runReview } from "./orchestrator";
import type { Store } from "./store";
import type { ReviewCallbacks } from "./types";

// ── Chat Query Agent ──
// Agentic loop for answering user questions — streams text, thinking,
// and tool calls in real-time via the Anthropic SDK streaming API.

interface ChatToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: string;
}

export interface ChatQueryResult {
  answer: string;
  toolCalls: ChatToolCall[];
  /** If the chat agent spawned sub-agents, this contains the review result */
  spawnedReview?: {
    runId: string;
    findingsCount: number;
    agents: string[];
  };
}

export interface ValidateResult {
  verdict: "still_present" | "partially_fixed" | "fixed" | "unable_to_determine";
  reasoning: string;
  toolCalls: ChatToolCall[];
}

export interface GeneratePatchResult {
  patchedCode: string;
  explanation: string;
}

const BASE_SYSTEM_PROMPT = `You are a code review assistant for ChainReview. Answer questions about the repository the user has opened. You have access to a comprehensive set of tools:

- **File tree** (crp_repo_tree): Browse the repository structure
- **Read files** (crp_repo_file): Read source code with line ranges
- **Search code** (crp_repo_search): Regex search across the codebase using ripgrep
- **Git diff** (crp_repo_diff): View git changes (committed, staged, unstaged)
- **Import graph** (crp_code_import_graph): Trace TypeScript/JS module dependencies via ts-morph
- **Pattern scan** (crp_code_pattern_scan): Run Semgrep static analysis for anti-patterns and security issues
- **Shell commands** (crp_exec_command): Execute read-only commands (git log, blame, grep, find, etc.)
- **Web search** (crp_web_search): Search for security advisories, CVEs, best practices, docs
- **Spawn review agents** (crp_spawn_review): Launch specialized AI review agents (security, architecture, bugs) to do a deep code review with findings. Use this when the user asks for a code review, security audit, bug hunt, architecture analysis, or any request that warrants a thorough multi-agent review. The agents will run in parallel and produce structured findings.

Be concise and helpful. When referencing code, use specific file paths and line numbers. Format responses with markdown for readability.

IMPORTANT: Always use your tools thoroughly. Read relevant files, search for patterns, trace imports, run static analysis, and explore the codebase before answering. Do NOT give shallow answers — investigate deeply using all available tools. Continue using tools until you have enough evidence to give a comprehensive answer.

IMPORTANT: When the user asks you to review code, find bugs, check for security issues, audit architecture, or do any thorough code analysis — you MUST use the crp_spawn_review tool to launch the appropriate specialist agents. Do NOT try to do a full code review yourself — the specialist agents (security, architecture, bugs) are far more thorough and produce structured findings. Use crp_spawn_review and let the agents handle it. You can specify which agents to run and optionally a target path to focus on.`;

const TOOLS = [
  {
    name: "crp_repo_tree",
    description: "Get repository file tree",
    input_schema: {
      type: "object" as const,
      properties: {
        maxDepth: { type: "number", description: "Maximum directory depth" },
        pattern: { type: "string", description: "Filter files by pattern" },
      },
    },
  },
  {
    name: "crp_repo_file",
    description: "Read file contents",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Relative path to the file" },
        startLine: { type: "number", description: "Start line (1-based)" },
        endLine: { type: "number", description: "End line (1-based)" },
      },
      required: ["path"],
    },
  },
  {
    name: "crp_repo_search",
    description: "Search across repository for patterns using ripgrep",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string", description: "Search pattern (regex)" },
        glob: { type: "string", description: "Glob pattern to filter files" },
        maxResults: { type: "number", description: "Maximum results" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "crp_repo_diff",
    description: "Get git diff. Use ref1='HEAD~5' ref2='HEAD' to see recent committed changes, or staged=true for staged changes, or no args for unstaged changes.",
    input_schema: {
      type: "object" as const,
      properties: {
        ref1: { type: "string", description: "First git ref (e.g. HEAD~5, a commit hash, or branch name)" },
        ref2: { type: "string", description: "Second git ref (e.g. HEAD)" },
        staged: { type: "boolean", description: "Show staged changes" },
      },
    },
  },
  {
    name: "crp_code_import_graph",
    description: "Trace TypeScript/JavaScript module dependencies using ts-morph to understand how files connect and what imports what",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Subdirectory to analyze (relative to repo root)" },
      },
    },
  },
  {
    name: "crp_code_pattern_scan",
    description: "Run Semgrep static analysis to find code patterns, anti-patterns, and security issues",
    input_schema: {
      type: "object" as const,
      properties: {
        config: { type: "string", description: "Semgrep config (e.g. 'auto', 'p/security-audit')" },
        pattern: { type: "string", description: "Specific Semgrep pattern to scan for" },
      },
    },
  },
  {
    name: "crp_exec_command",
    description: "Execute a read-only shell command (allowlisted: wc, find, ls, cat, head, tail, grep, git log/show/blame/diff/status, npm ls, tsc --noEmit, etc.)",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "Shell command to execute" },
        timeout: { type: "number", description: "Timeout in ms (default: 10000)" },
      },
      required: ["command"],
    },
  },
  {
    name: "crp_web_search",
    description: "Search the web for information (security advisories, best practices, documentation, CVEs, etc.)",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Web search query" },
        maxResults: { type: "number", description: "Max results (default: 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "crp_spawn_review",
    description: "Launch specialist review agents to do a deep code review. Use when user asks for code review, security audit, bug hunt, or architecture analysis. Agents run in parallel and produce structured findings. ALWAYS use this for review/audit requests — don't try to do a full review yourself.",
    input_schema: {
      type: "object" as const,
      properties: {
        agents: {
          type: "array",
          items: { type: "string", enum: ["security", "architecture", "bugs"] },
          description: "Which agents to run. Options: 'security' (vulnerability scanning), 'architecture' (design patterns, coupling, structure), 'bugs' (logic errors, edge cases, reliability). If omitted, runs all agents.",
        },
        targetPath: {
          type: "string",
          description: "Optional subdirectory to focus the review on (e.g., 'src/auth/', 'lib/api'). If omitted, reviews the entire repo.",
        },
      },
    },
  },
];

/** Context needed for the spawn_review tool — injected by chatQuery caller */
interface SpawnReviewContext {
  store: Store;
  reviewCallbacks: ReviewCallbacks;
}

/** Result of a spawned review (stored during the chat loop) */
interface SpawnedReviewResult {
  runId: string;
  findingsCount: number;
  agents: string[];
}

async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  spawnCtx?: SpawnReviewContext,
): Promise<unknown> {
  switch (name) {
    case "crp_repo_tree":
      return repoTree(args as any);
    case "crp_repo_file":
      return repoFile(args as any);
    case "crp_repo_search":
      return repoSearch(args as any);
    case "crp_repo_diff":
      return repoDiff(args as any);
    case "crp_code_import_graph":
      return codeImportGraph(args as any);
    case "crp_code_pattern_scan":
      return codePatternScan(args as any);
    case "crp_exec_command":
      return execCommand(args as any);
    case "crp_web_search":
      return webSearch(args as any);
    case "crp_spawn_review": {
      if (!spawnCtx) {
        return { error: "Review spawning not available — store context not provided" };
      }
      const agents = (args.agents as string[] | undefined) || ["security", "architecture", "bugs"];
      const targetPath = args.targetPath as string | undefined;
      const { store, reviewCallbacks } = spawnCtx;

      // Get the repo path from the most recent run or active repo
      const runs = store.getReviewRuns(1);
      const repoPath = runs[0]?.repoPath;
      if (!repoPath) {
        return { error: "No repository path available. Run a review first or open a repo." };
      }

      const options = {
        agents: agents as ("security" | "architecture" | "bugs")[],
        targetPath,
      };

      const result = await runReview(repoPath, "repo", store, reviewCallbacks, options);

      const spawnResult: SpawnedReviewResult = {
        runId: result.runId,
        findingsCount: result.findings.length,
        agents,
      };

      return {
        status: "complete",
        runId: result.runId,
        findingsCount: result.findings.length,
        agents,
        summary: result.findings.length > 0
          ? `Review complete: ${result.findings.length} finding(s) from ${agents.join(", ")} agent(s). Findings are now visible in the Findings tab.`
          : `Review complete: no issues found by ${agents.join(", ")} agent(s). The code looks clean.`,
        _spawnResult: spawnResult, // Internal: for chatQuery to pick up
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function buildContextPrompt(store: Store, runId: string): string {
  const findings = store.getFindings(runId);
  if (findings.length === 0) return "";

  const findingSummary = findings
    .map(
      (f) =>
        `- [${f.severity.toUpperCase()}] ${f.title} (confidence: ${Math.round(f.confidence * 100)}%, agent: ${f.agent})`
    )
    .join("\n");

  return `\n\nContext from the current review run:\n\nFindings discovered so far:\n${findingSummary}\n\nYou can reference these findings in your answers and use tools to investigate further.`;
}

// ── Streaming Chat Callbacks ──
// Real-time callbacks fired incrementally as tokens stream in via the SDK.
// onTextDelta fires per-token for true real-time streaming.
// onText fires once per text block with the complete text (for compatibility).

export interface ChatCallbacks {
  /** Fires per token/chunk as text streams in (true real-time) */
  onTextDelta?: (delta: string) => void;
  /** Fires once per complete text block after all deltas */
  onText?: (text: string) => void;
  /** Fires per token/chunk as thinking streams in (true real-time) */
  onThinkingDelta?: (delta: string) => void;
  /** Fires once per complete thinking block */
  onThinking?: (text: string) => void;
  /** Fires when a tool call starts (with tool name and args) */
  onToolCall?: (tool: string, args: Record<string, unknown>) => void;
  /** Fires when a tool call finishes with its result */
  onToolResult?: (tool: string, result: string) => void;
}

// ── Helper: run a streaming API call and wire up SDK events to callbacks ──

async function runStreamingTurn(
  client: Anthropic,
  requestParams: Record<string, unknown>,
  callbacks?: ChatCallbacks,
): Promise<{ assistantContent: any[]; stopReason: string | null }> {
  const stream: MessageStream = client.messages.stream(requestParams as any);

  // Track accumulated text per-block for the final onText callback
  let currentTextContent = "";
  let currentThinkingContent = "";
  let inThinking = false;
  let inText = false;

  // Listen to SDK streaming events for true real-time delivery
  stream.on("contentBlockStart", (event: any) => {
    const block = event.contentBlock;
    if (block?.type === "thinking") {
      inThinking = true;
      inText = false;
      currentThinkingContent = "";
    } else if (block?.type === "text") {
      inText = true;
      inThinking = false;
      currentTextContent = "";
    } else {
      inText = false;
      inThinking = false;
    }
  });

  stream.on("contentBlockDelta", (event: any) => {
    const delta = event.delta;
    if (!delta) return;

    if (delta.type === "thinking_delta" && delta.thinking) {
      currentThinkingContent += delta.thinking;
      callbacks?.onThinkingDelta?.(delta.thinking);
    } else if (delta.type === "text_delta" && delta.text) {
      currentTextContent += delta.text;
      callbacks?.onTextDelta?.(delta.text);
    }
  });

  stream.on("contentBlockStop", () => {
    if (inThinking && currentThinkingContent) {
      callbacks?.onThinking?.(currentThinkingContent);
      currentThinkingContent = "";
      inThinking = false;
    }
    if (inText && currentTextContent) {
      callbacks?.onText?.(currentTextContent);
      currentTextContent = "";
      inText = false;
    }
  });

  // Wait for the complete message to process tool_use blocks
  const finalMessage = await stream.finalMessage();

  return {
    assistantContent: finalMessage.content as any[],
    stopReason: finalMessage.stop_reason,
  };
}

// ── Main Chat Query (True SDK Streaming) ──

export interface ChatQueryOptions {
  /** Review-level callbacks for when the chat agent spawns sub-agents */
  reviewCallbacks?: ReviewCallbacks;
}

export async function chatQuery(
  query: string,
  runId?: string,
  store?: Store,
  callbacks?: ChatCallbacks,
  options?: ChatQueryOptions,
): Promise<ChatQueryResult> {
  const client = new Anthropic();
  // Allow up to 50 turns for deep investigation — the agent stops naturally
  // when stop_reason !== "tool_use", so this is just a safety ceiling
  const maxTurns = 50;
  const toolCalls: ChatToolCall[] = [];

  // Build system prompt with optional review context
  let systemPrompt = BASE_SYSTEM_PROMPT;
  if (runId && store) {
    systemPrompt += buildContextPrompt(store, runId);
  }

  const messages: MessageParam[] = [
    { role: "user", content: query },
  ];

  let answer = "";
  let turn = 0;
  let spawnedReview: SpawnedReviewResult | undefined;

  // Build spawn context if store + review callbacks are available
  const spawnCtx: SpawnReviewContext | undefined =
    store && options?.reviewCallbacks
      ? { store, reviewCallbacks: options.reviewCallbacks }
      : undefined;

  while (turn < maxTurns) {
    turn++;

    // Use the SDK streaming API for true real-time token delivery
    const requestParams: Record<string, unknown> = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      system: systemPrompt,
      tools: TOOLS,
      messages,
      thinking: {
        type: "enabled",
        budget_tokens: 4096,
      },
    };

    let assistantContent: any[];
    let stopReason: string | null;

    try {
      const result = await runStreamingTurn(client, requestParams, callbacks);
      assistantContent = result.assistantContent;
      stopReason = result.stopReason;
    } catch (err: any) {
      console.error(`ChainReview [chat]: Anthropic API error on turn ${turn}: ${err.message}`);
      if (err.status) console.error(`  Status: ${err.status}`);
      if (err.error) console.error(`  Detail: ${JSON.stringify(err.error)}`);
      throw err;
    }

    const toolResults: ToolResultBlockParam[] = [];

    // Process tool_use blocks (text/thinking already streamed via events)
    for (const block of assistantContent) {
      if (block.type === "text") {
        // Accumulate answer from final content (already streamed via deltas)
        answer += (block as TextBlock).text;
      } else if (block.type === "tool_use") {
        const toolBlock = block as ToolUseBlock;

        // Emit tool call start
        callbacks?.onToolCall?.(toolBlock.name, toolBlock.input as Record<string, unknown>);

        try {
          const result = await handleToolCall(
            toolBlock.name,
            toolBlock.input as Record<string, unknown>,
            spawnCtx,
          );
          const resultStr =
            typeof result === "string" ? result : JSON.stringify(result);

          // Check if the result contains a spawned review result
          if (typeof result === "object" && result && (result as any)._spawnResult) {
            spawnedReview = (result as any)._spawnResult;
          }

          // Emit tool result
          callbacks?.onToolResult?.(toolBlock.name, resultStr.slice(0, 500));

          toolCalls.push({
            tool: toolBlock.name,
            args: toolBlock.input as Record<string, unknown>,
            result: resultStr.slice(0, 1000),
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: resultStr,
          });
        } catch (err: any) {
          callbacks?.onToolResult?.(toolBlock.name, `Error: ${err.message}`);

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: `Error: ${err.message}`,
            is_error: true,
          });

          toolCalls.push({
            tool: toolBlock.name,
            args: toolBlock.input as Record<string, unknown>,
            result: `Error: ${err.message}`,
          });
        }
      }
    }

    // If no tool use, we're done
    if (stopReason !== "tool_use") {
      break;
    }

    // Continue the tool loop — add assistant message and tool results
    messages.push({ role: "assistant", content: assistantContent as any });
    messages.push({ role: "user", content: toolResults });
  }

  return { answer, toolCalls, spawnedReview };
}

// ── Validate Finding (Full Agent Loop with Forced Investigation) ──

// Full tool suite for the validator — same tools as the orchestrator validator agent
const VALIDATOR_TOOLS = [
  {
    name: "crp_repo_tree",
    description: "Get repository file tree to understand project structure and find related files",
    input_schema: {
      type: "object" as const,
      properties: {
        maxDepth: { type: "number", description: "Maximum directory depth" },
        pattern: { type: "string", description: "Filter files by pattern" },
      },
    },
  },
  {
    name: "crp_repo_file",
    description: "Read file contents to verify findings and check for mitigating factors",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Relative path to the file" },
        startLine: { type: "number", description: "Start line (1-based)" },
        endLine: { type: "number", description: "End line (1-based)" },
      },
      required: ["path"],
    },
  },
  {
    name: "crp_repo_search",
    description: "Search repository for related patterns, mitigations, and validation code",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string", description: "Search pattern (regex)" },
        glob: { type: "string", description: "Glob pattern to filter files" },
        maxResults: { type: "number", description: "Maximum results" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "crp_repo_diff",
    description: "Get git diff. Use ref1='HEAD~5' ref2='HEAD' to see recent committed changes, or staged=true for staged changes, or no args for unstaged changes. PREFER crp_exec_command with 'git diff HEAD~5 -- <file>' for checking specific files.",
    input_schema: {
      type: "object" as const,
      properties: {
        ref1: { type: "string", description: "First git ref (e.g. HEAD~5, a commit hash, or branch name)" },
        ref2: { type: "string", description: "Second git ref (e.g. HEAD)" },
        staged: { type: "boolean", description: "Show staged changes" },
      },
    },
  },
  {
    name: "crp_code_import_graph",
    description: "Trace module dependencies to understand if flagged code is actually reachable and how it connects to the rest of the system",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Subdirectory to analyze" },
      },
    },
  },
  {
    name: "crp_code_pattern_scan",
    description: "Run Semgrep to check if the flagged issue is a known anti-pattern or if mitigations exist",
    input_schema: {
      type: "object" as const,
      properties: {
        config: { type: "string", description: "Semgrep config" },
        pattern: { type: "string", description: "Specific pattern to scan" },
      },
    },
  },
  {
    name: "crp_exec_command",
    description: "Execute read-only shell commands for deeper investigation (git log, git blame, grep, find, wc, npm ls, etc.)",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "Shell command to execute" },
        timeout: { type: "number", description: "Timeout in ms (default: 10000)" },
      },
      required: ["command"],
    },
  },
  {
    name: "crp_web_search",
    description: "Search the web to verify if flagged patterns are actually dangerous, check CVE databases, and find best practices",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Web search query" },
        maxResults: { type: "number", description: "Max results (default: 5)" },
      },
      required: ["query"],
    },
  },
];

/** Route validator tool calls to the actual CRP tool backends */
async function handleValidatorToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "crp_repo_tree":
      return repoTree(args as any);
    case "crp_repo_file":
      return repoFile(args as any);
    case "crp_repo_search":
      return repoSearch(args as any);
    case "crp_repo_diff":
      return repoDiff(args as any);
    case "crp_code_import_graph":
      return codeImportGraph(args as any);
    case "crp_code_pattern_scan":
      return codePatternScan(args as any);
    case "crp_exec_command":
      return execCommand(args as any);
    case "crp_web_search":
      return webSearch(args as any);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const VALIDATOR_SYSTEM_PROMPT = `You are the Verification Agent in ChainReview. Your job is to check whether a previously reported bug has been FIXED in the CURRENT code.

A code review found a bug. The developer may have made changes to fix it. You must read the CURRENT state of the code and determine if the bug is still present or has been resolved.

CRITICAL: You MUST use your tools to investigate the CURRENT code BEFORE giving a verdict. Do NOT guess. Read the actual files, check git history, and compare against the original finding.

## Investigation Steps (MANDATORY — do ALL of these)

Step 1: CHECK GIT FOR CHANGES to the files mentioned in the finding.
  Use crp_exec_command with EACH of these git commands:
  - "git log --oneline -10 -- <file_path>" to see recent commits touching the relevant file(s)
  - "git diff HEAD~5 -- <file_path>" to see what changed in the relevant file(s) over the last 5 commits
  - "git diff" to check for any unstaged changes
  - "git diff --cached" to check for any staged changes
  If any of these show changes to the relevant files, the developer likely attempted a fix.

Step 2: READ THE CURRENT CODE at the exact file paths and line ranges from the finding evidence.
  Use crp_repo_file to read the CURRENT state of each file mentioned.
  Compare what you see NOW against what the finding described — is the buggy pattern still there?

Step 3: DETERMINE THE VERDICT by comparing:
  - The finding's description of the bug pattern
  - The CURRENT code you just read
  - The git changes you found (if any)
  If the code no longer matches the bug pattern described, it is FIXED.
  If the code still has the exact same issue, it is STILL_PRESENT.
  If some changes were made but the fix is incomplete, it is PARTIALLY_FIXED.

Step 4 (optional): Use crp_repo_search to check if the fix moved the logic elsewhere.

## KEY RULES
- If git shows changes to the relevant files AND the current code no longer has the bug pattern → verdict is "fixed"
- If git shows NO changes to the relevant files AND the code still matches the bug → verdict is "still_present"
- If git shows changes but the bug pattern partially remains → verdict is "partially_fixed"
- ONLY use "unable_to_determine" if your tools genuinely failed or returned errors

Verdict options:
- "still_present" — the bug described in the finding is still present in the current code, no fix has been applied
- "partially_fixed" — some changes were made that address part of the issue, but the fix is incomplete
- "fixed" — the code has been changed and the reported bug is no longer present
- "unable_to_determine" — tools failed or the code has changed so significantly that the finding can't be evaluated

Output format (you MUST use these exact tags):
<verdict>still_present|partially_fixed|fixed|unable_to_determine</verdict>
<reasoning>
Detailed explanation comparing the original finding against the current state of the code.
Cite specific git changes you found (or lack thereof).
Cite the current code at the relevant lines.
Explain WHY the bug is or is not still present.
</reasoning>`;

export async function validateFinding(
  findingJson: string,
  callbacks?: ChatCallbacks
): Promise<ValidateResult> {
  const client = new Anthropic();
  const maxTurns = 25;
  const toolCalls: ChatToolCall[] = [];

  // Parse finding to build a more structured prompt
  let findingTitle = "Unknown";
  let findingDesc = "";
  let evidenceFiles: string[] = [];
  try {
    const parsed = JSON.parse(findingJson);
    findingTitle = parsed.title || "Unknown";
    findingDesc = parsed.description || "";
    evidenceFiles = (parsed.evidence || []).map((e: any) =>
      `${e.filePath}:${e.startLine}-${e.endLine}`
    );
  } catch {
    // If parsing fails, use raw JSON
  }

  // Build file-specific git commands for the prompt
  const evidenceFilePaths = [...new Set(
    ((() => { try { return JSON.parse(findingJson)?.evidence || []; } catch { return []; } })())
      .map((e: any) => e.filePath)
      .filter(Boolean)
  )] as string[];

  const gitCmdsToRun = evidenceFilePaths.length > 0
    ? evidenceFilePaths.map(f => `  - git log --oneline -10 -- ${f}\n  - git diff HEAD~5 -- ${f}`).join("\n")
    : `  - git log --oneline -10\n  - git diff HEAD~5`;

  const userPrompt = `Verify whether this previously reported bug has been FIXED in the current code.

## Finding: ${findingTitle}
${findingDesc}

## Evidence files: ${evidenceFiles.join(", ") || "See finding JSON below"}

## Full finding JSON:
${findingJson}

## YOUR INVESTIGATION PLAN (follow this EXACTLY):

STEP 1 — Check git history for changes to the relevant files. Run these commands with crp_exec_command:
${gitCmdsToRun}
  - git diff
  - git diff --cached

STEP 2 — Read the CURRENT code at each evidence location using crp_repo_file.
${evidenceFilePaths.map(f => `  - Read file: ${f}`).join("\n") || "  - Read the file(s) from the finding evidence"}

STEP 3 — Compare what the finding described vs what the code looks like NOW:
  - Does the CURRENT code still have the bug pattern described in the finding?
  - Did git show any changes to the relevant files?
  - If the code changed AND no longer has the bug → verdict is "fixed"
  - If the code has NOT changed → verdict is "still_present"

Give your verdict using <verdict> tags.`;

  const messages: MessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  let answer = "";
  let turn = 0;
  let toolCallCount = 0;
  // Force at least 3 tool turns before allowing text-only response
  // (must check git log + git diff + read current file at minimum)
  const FORCED_TOOL_TURNS = 3;

  while (turn < maxTurns) {
    turn++;

    // Build request — force tool use during investigation phase
    const inForcedPhase = toolCallCount < FORCED_TOOL_TURNS;
    const requestParams: Record<string, unknown> = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      system: VALIDATOR_SYSTEM_PROMPT,
      tools: VALIDATOR_TOOLS,
      messages,
    };

    if (inForcedPhase) {
      // Force tool use — Haiku must investigate before producing text
      // NOTE: Anthropic API does not allow thinking + forced tool_choice together
      requestParams.tool_choice = { type: "any" };
    } else {
      // After forced phase, enable thinking for better reasoning
      requestParams.thinking = {
        type: "enabled",
        budget_tokens: 4096,
      };
    }

    let assistantContent: any[];
    let stopReason: string | null;

    try {
      const result = await runStreamingTurn(client, requestParams, callbacks);
      assistantContent = result.assistantContent;
      stopReason = result.stopReason;
    } catch (err: any) {
      console.error(`ChainReview [validate]: Anthropic API error on turn ${turn}: ${err.message}`);
      throw err;
    }

    const toolResults: ToolResultBlockParam[] = [];

    for (const block of assistantContent) {
      if (block.type === "text") {
        answer += (block as TextBlock).text;
      } else if (block.type === "tool_use") {
        const toolBlock = block as ToolUseBlock;
        toolCallCount++;

        callbacks?.onToolCall?.(toolBlock.name, toolBlock.input as Record<string, unknown>);

        try {
          const result = await handleValidatorToolCall(
            toolBlock.name,
            toolBlock.input as Record<string, unknown>
          );
          const resultStr =
            typeof result === "string" ? result : JSON.stringify(result);

          callbacks?.onToolResult?.(toolBlock.name, resultStr.slice(0, 500));

          toolCalls.push({
            tool: toolBlock.name,
            args: toolBlock.input as Record<string, unknown>,
            result: resultStr.slice(0, 1000),
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: resultStr,
          });
        } catch (err: any) {
          callbacks?.onToolResult?.(toolBlock.name, `Error: ${err.message}`);

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: `Error: ${err.message}`,
            is_error: true,
          });

          toolCalls.push({
            tool: toolBlock.name,
            args: toolBlock.input as Record<string, unknown>,
            result: `Error: ${err.message}`,
          });
        }
      }
    }

    // If no tool calls were made and we're past forced phase, we're done
    if (toolResults.length === 0 && stopReason !== "tool_use") {
      break;
    }

    // Continue if tools were called
    if (toolResults.length > 0) {
      messages.push({ role: "assistant", content: assistantContent as any });
      messages.push({ role: "user", content: toolResults });
    } else {
      break;
    }
  }

  // Extract verdict with robust parsing
  const verdict = extractVerdict(answer);
  const reasoning = extractReasoning(answer);

  return { verdict, reasoning, toolCalls };
}

/** Robustly extract verdict from LLM output — tries multiple patterns */
function extractVerdict(text: string): ValidateResult["verdict"] {
  const validVerdicts = new Set([
    "still_present", "partially_fixed", "fixed", "unable_to_determine",
  ]);

  // Try <verdict> tags first
  const tagMatch = text.match(/<verdict>\s*([\w_]+)\s*<\/verdict>/);
  if (tagMatch && validVerdicts.has(tagMatch[1])) {
    return tagMatch[1] as ValidateResult["verdict"];
  }

  // Try **Verdict:** pattern
  const boldMatch = text.match(/\*?\*?[Vv]erdict\*?\*?:\s*`?([\w_]+)`?/);
  if (boldMatch && validVerdicts.has(boldMatch[1])) {
    return boldMatch[1] as ValidateResult["verdict"];
  }

  // Try "verdict: X" or "Verdict: X" plain text
  const plainMatch = text.match(/[Vv]erdict\s*[:=]\s*"?([\w_]+)"?/);
  if (plainMatch && validVerdicts.has(plainMatch[1])) {
    return plainMatch[1] as ValidateResult["verdict"];
  }

  // Inference from strong language in the text
  const lower = text.toLowerCase();
  if (lower.includes("fixed") && (lower.includes("has been fixed") || lower.includes("is fixed") || lower.includes("no longer present") || lower.includes("been resolved"))) {
    return "fixed";
  }
  if (lower.includes("partially") && (lower.includes("partially fixed") || lower.includes("partial fix") || lower.includes("incomplete fix"))) {
    return "partially_fixed";
  }
  if (lower.includes("still present") || lower.includes("still exists") || lower.includes("not fixed") || lower.includes("bug remains")) {
    return "still_present";
  }
  if (lower.includes("unable to determine") || lower.includes("cannot determine") || lower.includes("inconclusive")) {
    return "unable_to_determine";
  }

  // Last resort — if the agent investigated but couldn't decide clearly,
  // default to "unable_to_determine" instead of biasing toward "still_present"
  return "unable_to_determine";
}

/** Extract reasoning from LLM output — tries tags then falls back to full text */
function extractReasoning(text: string): string {
  // Try <reasoning> tags
  const tagMatch = text.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
  if (tagMatch?.[1]?.trim()) {
    return tagMatch[1].trim();
  }

  // Try **Reasoning:** section
  const sectionMatch = text.match(/\*?\*?[Rr]easoning\*?\*?:\s*([\s\S]+?)(?=<verdict>|$)/);
  if (sectionMatch?.[1]?.trim()) {
    return sectionMatch[1].trim();
  }

  // Fall back to the full answer, stripping verdict tags
  return text.replace(/<verdict>[\s\S]*?<\/verdict>/, "").trim() || "Investigation completed — see tool calls for evidence.";
}

// ── Generate Patch Fix (Phase 4) ──

export async function generatePatchFix(args: {
  filePath: string;
  originalCode: string;
  findingTitle: string;
  findingDescription: string;
}): Promise<GeneratePatchResult> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001", // Haiku for fast patch generation
    max_tokens: 4096,
    system: `You are a code fix generator. Given a code snippet and a description of an issue, produce the fixed version of the code. Output ONLY the fixed code wrapped in <fixed_code> tags, followed by a brief explanation in <explanation> tags. Do not change anything unrelated to the fix.`,
    messages: [
      {
        role: "user",
        content: `File: ${args.filePath}\n\nIssue: ${args.findingTitle}\n${args.findingDescription}\n\nOriginal code:\n\`\`\`\n${args.originalCode}\n\`\`\`\n\nPlease provide the fixed version of this code.`,
      },
    ],
  });

  let text = "";
  for (const block of response.content) {
    if (block.type === "text") {
      text += (block as TextBlock).text;
    }
  }

  const codeMatch = text.match(/<fixed_code>([\s\S]*?)<\/fixed_code>/);
  const explanationMatch = text.match(/<explanation>([\s\S]*?)<\/explanation>/);

  return {
    patchedCode: codeMatch?.[1]?.trim() || args.originalCode,
    explanation: explanationMatch?.[1]?.trim() || "Fix applied",
  };
}
