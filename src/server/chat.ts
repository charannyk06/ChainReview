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
import type { Store } from "./store";

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
}

export interface ValidateResult {
  verdict: "confirmed" | "likely_valid" | "uncertain" | "likely_false_positive" | "false_positive";
  reasoning: string;
  toolCalls: ChatToolCall[];
}

export interface GeneratePatchResult {
  patchedCode: string;
  explanation: string;
}

const BASE_SYSTEM_PROMPT = `You are a code review assistant for ChainReview. Answer questions about the repository the user has opened. You have access to tools for reading files, searching code, viewing the file tree, running shell commands, and searching the web.

Be concise and helpful. When referencing code, use specific file paths and line numbers. Format responses with markdown for readability.

IMPORTANT: Always use your tools thoroughly. Read relevant files, search for patterns, and explore the codebase before answering. Do NOT give shallow answers — investigate deeply using all available tools. Continue using tools until you have enough evidence to give a comprehensive answer.`;

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
];

async function handleToolCall(
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
    case "crp_exec_command":
      return execCommand(args as any);
    case "crp_web_search":
      return webSearch(args as any);
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

export async function chatQuery(
  query: string,
  runId?: string,
  store?: Store,
  callbacks?: ChatCallbacks
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
            toolBlock.input as Record<string, unknown>
          );
          const resultStr =
            typeof result === "string" ? result : JSON.stringify(result);

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

  return { answer, toolCalls };
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
    description: "Get git diff to check if flagged code was recently changed or if there are pending fixes",
    input_schema: {
      type: "object" as const,
      properties: {
        ref1: { type: "string", description: "First git ref" },
        ref2: { type: "string", description: "Second git ref" },
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

const VALIDATOR_SYSTEM_PROMPT = `You are the Validator Agent in ChainReview. Your job is to INDEPENDENTLY VERIFY whether a code review finding is a real bug or a false positive.

CRITICAL: You MUST use your tools to investigate BEFORE giving a verdict. Do NOT guess. Read the actual code, search for mitigating factors, and build real evidence.

Investigation checklist (you MUST do at least steps 1-3):
1. READ the file(s) mentioned in the evidence using crp_repo_file — verify the code actually matches the claim
2. SEARCH the codebase using crp_repo_search for mitigating factors (input validation, error handlers, sanitization, middleware, type guards)
3. CHECK context using crp_exec_command (git blame, git log) to understand the history and intent
4. TRACE dependencies using crp_code_import_graph if the finding relates to architecture or module coupling
5. SCAN for patterns using crp_code_pattern_scan if the finding relates to a security anti-pattern
6. CHECK git diff using crp_repo_diff to see if a fix is already in progress

After thorough investigation, provide your verdict. You MUST commit to a definitive verdict — "uncertain" is only acceptable if tools genuinely fail to return data.

Verdict options:
- "confirmed" — the code clearly has this issue, evidence verified
- "likely_valid" — strong evidence supports the finding, minor caveats
- "likely_false_positive" — mitigating factors exist that address the concern
- "false_positive" — the finding is definitively wrong, code is safe

Output format (you MUST use these exact tags):
<verdict>confirmed|likely_valid|likely_false_positive|false_positive</verdict>
<reasoning>
Detailed explanation citing specific files, line numbers, and code you found.
Reference your tool call results as evidence for your conclusion.
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

  const userPrompt = `Validate this code review finding by investigating the actual code. You have 8 powerful tools — USE THEM.

Finding: ${findingTitle}
${findingDesc}

Evidence files to check: ${evidenceFiles.join(", ") || "See finding JSON below"}

Full finding JSON:
${findingJson}

REQUIRED INVESTIGATION STEPS:
1. First, use crp_repo_file to READ the files mentioned in the evidence
2. Then use crp_repo_search to search for mitigating factors (validation, sanitization, error handling)
3. Use crp_exec_command with "git blame" or "git log" on the relevant files for context
4. Based on what you find, give a DEFINITIVE verdict — confirmed, likely_valid, likely_false_positive, or false_positive

DO NOT skip tools. DO NOT guess. Investigate first, then decide.`;

  const messages: MessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  let answer = "";
  let turn = 0;
  let toolCallCount = 0;
  // Force at least 2 tool turns before allowing text-only response
  const FORCED_TOOL_TURNS = 2;

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
    "confirmed", "likely_valid", "uncertain", "likely_false_positive", "false_positive",
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
  if (lower.includes("confirmed") && (lower.includes("the finding is valid") || lower.includes("is a real bug") || lower.includes("is confirmed"))) {
    return "confirmed";
  }
  if (lower.includes("false positive") && (lower.includes("the finding is a false positive") || lower.includes("not a real"))) {
    return "false_positive";
  }
  if (lower.includes("likely valid") || lower.includes("probably valid") || lower.includes("evidence supports")) {
    return "likely_valid";
  }
  if (lower.includes("likely false positive") || lower.includes("probably false positive") || lower.includes("mitigated")) {
    return "likely_false_positive";
  }

  // Last resort — if the agent investigated but couldn't decide
  return "likely_valid";
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
