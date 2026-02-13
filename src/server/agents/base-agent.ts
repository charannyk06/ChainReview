import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ToolUseBlock,
  TextBlock,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import type { AgentName, AgentFinding, AuditEvent } from "../types";

export interface AgentTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AgentLoopOptions {
  name: AgentName;
  systemPrompt: string;
  userPrompt: string;
  tools: AgentTool[];
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  onToolResult?: (tool: string, result: string) => void;
  onText: (text: string) => void;
  onThinking?: (text: string) => void;
  onEvent: (event: Omit<AuditEvent, "id" | "timestamp">) => void;
  maxTurns?: number;
  enableThinking?: boolean;
  /** AbortSignal for cancellation — when aborted, the agent loop stops immediately */
  signal?: AbortSignal;
}

const FINDING_EXTRACTION_PROMPT = `

After your analysis, you MUST output your findings as a JSON array wrapped in <findings> tags.
Each finding should have this structure:
{
  "category": "architecture" | "security" | "bugs",
  "severity": "critical" | "high" | "medium" | "low" | "info",
  "title": "Short descriptive title",
  "description": "Detailed explanation of the issue, impact, and suggested remediation",
  "confidence": 0.0 to 1.0,
  "evidence": [
    {
      "filePath": "relative/path/to/file.ts",
      "startLine": 1,
      "endLine": 10,
      "snippet": "relevant code snippet"
    }
  ]
}

Example:
<findings>
[
  {
    "category": "architecture",
    "severity": "high",
    "title": "Circular dependency between auth and api modules",
    "description": "The auth module imports from api, and api imports from auth, creating a circular dependency that can cause initialization issues and makes the code harder to maintain.",
    "confidence": 0.92,
    "evidence": [
      {
        "filePath": "src/auth/index.ts",
        "startLine": 3,
        "endLine": 3,
        "snippet": "import { apiClient } from '../api';"
      }
    ]
  }
]
</findings>
`;

export async function runAgentLoop(
  opts: AgentLoopOptions
): Promise<AgentFinding[]> {
  const client = new Anthropic();
  // No artificial limit — agents run until they naturally stop (stop_reason !== "tool_use")
  // A safety ceiling of 200 prevents infinite loops but never constrains real analysis
  const maxTurns = opts.maxTurns ?? 200;
  const enableThinking = opts.enableThinking ?? true;

  const messages: MessageParam[] = [
    {
      role: "user",
      content: opts.userPrompt + FINDING_EXTRACTION_PROMPT,
    },
  ];

  // NOTE: agent_started event is emitted by the orchestrator before calling
  // this loop. We do NOT emit it here to avoid duplicate "started" events in UI.

  let turn = 0;
  let allText = "";

  while (turn < maxTurns) {
    turn++;

    // Check for cancellation before each API call
    if (opts.signal?.aborted) {
      break;
    }

    // Build request params with optional extended thinking
    const requestParams: Record<string, unknown> = {
      model: "claude-sonnet-4-20250514",
      max_tokens: enableThinking ? 16000 : 8192,
      system: opts.systemPrompt,
      tools: opts.tools,
      messages,
    };

    if (enableThinking) {
      requestParams.thinking = {
        type: "enabled",
        budget_tokens: 4096,
      };
    }

    let response;
    try {
      response = await client.messages.create(requestParams as any);
    } catch (err: any) {
      // If cancelled while waiting for API response, stop gracefully
      if (opts.signal?.aborted) {
        break;
      }
      // Log the error to stderr for visibility
      console.error(`ChainReview [${opts.name}]: Anthropic API error on turn ${turn}: ${err.message}`);
      if (err.status) console.error(`  Status: ${err.status}`);
      if (err.error) console.error(`  Detail: ${JSON.stringify(err.error)}`);
      throw err;
    }

    // Check for cancellation after API call returns
    if (opts.signal?.aborted) {
      break;
    }

    // Process content blocks
    const assistantContent = response.content;
    const toolResults: ToolResultBlockParam[] = [];

    for (const block of assistantContent) {
      if (block.type === "thinking") {
        // Extended thinking block — emit to UI as reasoning
        const thinkingText = (block as any).thinking || "";
        if (thinkingText && opts.onThinking) {
          opts.onThinking(thinkingText);
        }
      } else if (block.type === "text") {
        const textBlock = block as TextBlock;
        opts.onText(textBlock.text);
        allText += textBlock.text;
      } else if (block.type === "tool_use") {
        const toolBlock = block as ToolUseBlock;

        // NOTE: We do NOT emit evidence_collected here — the orchestrator's
        // agentCallbacks.onToolCall handler already emits tool_call_start/end
        // events via emitEvent(). Emitting here would create DUPLICATE events
        // in the timeline and duplicate tool_call blocks in the UI.

        // Execute the tool via the agent's onToolCall wrapper.
        // The wrapper in architecture.ts/security.ts already calls both
        // callbacks.onToolCall (tool_call_start) and callbacks.onToolResult
        // (tool_call_end), so we do NOT call opts.onToolResult here to avoid
        // duplicate events in the UI timeline.
        try {
          const result = await opts.onToolCall(
            toolBlock.name,
            toolBlock.input as Record<string, unknown>
          );
          const resultStr =
            typeof result === "string" ? result : JSON.stringify(result);

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: resultStr,
          });
        } catch (err: any) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: `Error: ${err.message}`,
            is_error: true,
          });
        }
      }
    }

    // If no tool use, we're done
    if (response.stop_reason !== "tool_use") {
      break;
    }

    // Add assistant message and tool results for next turn
    messages.push({
      role: "assistant",
      content: assistantContent as any,
    });

    messages.push({
      role: "user",
      content: toolResults,
    });
  }

  // Extract findings from the accumulated text
  const findings = extractFindings(allText);

  // NOTE: We do NOT emit finding_emitted events here — the orchestrator
  // handles finding storage and event emission after this function returns.
  // Emitting here would create DUPLICATE finding_emitted events in the timeline.

  return findings;
}

function extractFindings(text: string): AgentFinding[] {
  // Try to extract from <findings> tags
  const tagMatch = text.match(/<findings>([\s\S]*?)<\/findings>/);
  if (tagMatch) {
    try {
      return JSON.parse(tagMatch[1]);
    } catch {
      // Fall through to other extraction methods
    }
  }

  // Try to find a JSON array in the text
  const jsonMatch = text.match(/\[[\s\S]*?\{[\s\S]*?"category"[\s\S]*?\}[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Fall through
    }
  }

  // No findings extracted
  return [];
}
