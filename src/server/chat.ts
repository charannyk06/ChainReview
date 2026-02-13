import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ToolUseBlock,
  TextBlock,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";
import { repoTree, repoFile, repoSearch } from "./tools/repo";
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

// ── Validate Finding (True SDK Streaming) ──

export async function validateFinding(
  findingJson: string,
  callbacks?: ChatCallbacks
): Promise<ValidateResult> {
  const client = new Anthropic();
  const maxTurns = 15;
  const toolCalls: ChatToolCall[] = [];

  const systemPrompt = `You are a code review validator. Your job is to challenge and verify a finding from another agent. Be skeptical — check if the evidence actually supports the claim. Read the relevant files and search for counter-evidence.

After investigation, provide your verdict as one of:
- "confirmed" — the finding is definitely valid
- "likely_valid" — the finding is probably valid but minor issues in evidence
- "uncertain" — not enough evidence to confirm or deny
- "likely_false_positive" — the evidence doesn't strongly support the claim
- "false_positive" — the finding is clearly wrong

Output your verdict in this format:
<verdict>confirmed|likely_valid|uncertain|likely_false_positive|false_positive</verdict>
<reasoning>Your detailed reasoning here</reasoning>`;

  const userPrompt = `Please validate this code review finding:\n\n${findingJson}\n\nInvestigate the code to determine if this finding is valid. Check the evidence, look for counter-evidence, and provide your verdict.`;

  const messages: MessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  // Use only read-only tools for validation
  const validatorTools = TOOLS.filter((t) =>
    ["crp_repo_file", "crp_repo_search", "crp_repo_tree", "crp_exec_command"].includes(t.name)
  );

  let answer = "";
  let turn = 0;

  while (turn < maxTurns) {
    turn++;

    const requestParams: Record<string, unknown> = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      system: systemPrompt,
      tools: validatorTools,
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
      console.error(`ChainReview [validate]: Anthropic API error on turn ${turn}: ${err.message}`);
      throw err;
    }

    const toolResults: ToolResultBlockParam[] = [];

    // Process tool_use blocks (text/thinking already streamed via SDK events)
    for (const block of assistantContent) {
      if (block.type === "text") {
        answer += (block as TextBlock).text;
      } else if (block.type === "tool_use") {
        const toolBlock = block as ToolUseBlock;

        callbacks?.onToolCall?.(toolBlock.name, toolBlock.input as Record<string, unknown>);

        try {
          const result = await handleToolCall(
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

    if (stopReason !== "tool_use") {
      break;
    }

    messages.push({ role: "assistant", content: assistantContent as any });
    messages.push({ role: "user", content: toolResults });
  }

  // Extract verdict
  const verdictMatch = answer.match(/<verdict>(.*?)<\/verdict>/);
  const reasoningMatch = answer.match(/<reasoning>([\s\S]*?)<\/reasoning>/);

  const verdict = (verdictMatch?.[1] || "uncertain") as ValidateResult["verdict"];
  const reasoning = reasoningMatch?.[1]?.trim() || answer;

  return { verdict, reasoning, toolCalls };
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
