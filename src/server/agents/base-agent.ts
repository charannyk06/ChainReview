import type Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ToolUseBlock,
  TextBlock,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import { createAnthropicClient } from "../lib/anthropic-client";
import { repoTree, repoFile, repoSearch, repoDiff } from "../tools/repo";
import { codeImportGraph, codePatternScan } from "../tools/code";
import { codeCallGraph, codeSymbolLookup, codeImpactAnalysis } from "../tools/graph";
import { execCommand } from "../tools/exec";
import { webSearch } from "../tools/web";
import type { AgentName, AgentFinding, AuditEvent } from "../types";

/**
 * Sanitize user-controlled text before embedding in LLM prompts.
 * Prevents prompt injection by:
 * 1. Escaping XML-like tags that could break structured prompt boundaries
 * 2. Truncating excessively long strings that could push instructions out of context
 * 3. Removing control characters
 */
export function sanitizeForPrompt(text: string, maxLength = 2000): string {
  if (!text) return "";
  // Remove control characters except newline and tab
  let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Escape XML/HTML-like tags that could break prompt structure
  // Specifically neutralize </findings>, </system>, etc.
  sanitized = sanitized.replace(/<\/?([a-zA-Z_][a-zA-Z0-9_-]*)\s*>/g, "‹$1›");
  // Truncate to prevent context overflow attacks
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + "… [truncated]";
  }
  return sanitized;
}

export interface AgentTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** Standard callback interface used by all agents with runAgentLoop */
export interface AgentCallbacks {
  onText: (text: string) => void;
  onThinking?: (text: string) => void;
  onEvent: (event: Omit<AuditEvent, "id" | "timestamp">) => void;
  onToolCall: (tool: string, args: Record<string, unknown>) => void;
  onToolResult: (tool: string, result: string) => void;
}

/** Tool handler function — maps tool name + args to a result */
export type ToolHandler = (name: string, args: Record<string, unknown>) => Promise<unknown>;

/**
 * Create an onToolCall wrapper for runAgentLoop that unifies:
 * 1. Emitting onToolCall callback (tool_call_start)
 * 2. Executing the tool via the handler
 * 3. Emitting onToolResult callback (tool_call_end)
 * 4. Returning the result to the agent loop
 *
 * Error handling is consistent: onToolResult fires with the error message,
 * then the error re-throws for runAgentLoop to mark as is_error.
 */
export function createToolExecutor(
  handler: ToolHandler,
  callbacks: Pick<AgentCallbacks, "onToolCall" | "onToolResult">,
): (name: string, args: Record<string, unknown>) => Promise<unknown> {
  return async (name, args) => {
    callbacks.onToolCall(name, args);
    try {
      const result = await handler(name, args);
      const resultStr = typeof result === "string" ? result : JSON.stringify(result);
      callbacks.onToolResult(name, resultStr);
      return result;
    } catch (err: any) {
      callbacks.onToolResult(name, `Error: ${err.message}`);
      throw err;
    }
  };
}

/**
 * Route standard CRP tool calls to their backend implementations.
 * Handles the 8 tools common to all agents. Agents with additional
 * tools should handle those first, then fall through to this function.
 */
export async function routeStandardTool(
  name: string,
  args: Record<string, unknown>,
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
    case "crp_code_call_graph":
      return codeCallGraph(args as any);
    case "crp_code_symbol_lookup":
      return codeSymbolLookup(args as any);
    case "crp_code_impact_analysis":
      return codeImpactAnalysis(args as any);
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
  /** Override the model for this agent (default: claude-haiku-4-5-20251001) */
  model?: string;
  /** AbortSignal for cancellation — when aborted, the agent loop stops immediately */
  signal?: AbortSignal;
  /**
   * Force the model to use tools for the first N turns before allowing text-only output.
   * Uses tool_choice: { type: "any" } to guarantee tool calls happen.
   * Set to 0 to disable forced tool use (e.g., for validator spot-checks).
   * Default: 3 for investigation agents, 0 for validators.
   */
  forcedToolTurns?: number;
  /**
   * Enable confidence-based iteration: after the agent produces findings,
   * evaluate if the investigation was thorough enough and ask for deeper
   * analysis if confidence is low. Capped at maxConfidenceRounds extra rounds.
   * Default: true for investigation agents, false for validators.
   */
  enableConfidenceCheck?: boolean;
  /** Maximum extra confidence rounds (default: 2) */
  maxConfidenceRounds?: number;
  /**
   * Skip appending the FINDING_EXTRACTION_PROMPT to the user prompt.
   * Use for agents that have their own finding emission mechanism (e.g., bugs agent's emit_finding tool).
   * When true, the agent loop still returns text-extracted findings as a fallback,
   * but doesn't inject conflicting instructions about <findings> tags.
   * Default: false
   */
  skipFindingExtractionPrompt?: boolean;
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
  const client = createAnthropicClient();
  // No artificial limit — agents run until they naturally stop (stop_reason !== "tool_use")
  // A safety ceiling of 200 prevents infinite loops but never constrains real analysis
  const maxTurns = opts.maxTurns ?? 200;
  const enableThinking = opts.enableThinking ?? true;
  // Agents default to Haiku 4.5 for cost efficiency.
  // Validator/orchestrator can override with Opus 4.6 for critical reasoning.
  const model = opts.model ?? "claude-haiku-4-5-20251001";
  // Force tool use for the first N turns to ensure agents actively investigate
  // before producing findings. Without this, fast models like Haiku will skip
  // tool calls entirely and produce findings solely from the initial context.
  const forcedToolTurns = opts.forcedToolTurns ?? 3;

  const messages: MessageParam[] = [
    {
      role: "user",
      content: opts.skipFindingExtractionPrompt
        ? opts.userPrompt
        : opts.userPrompt + FINDING_EXTRACTION_PROMPT,
    },
  ];

  // NOTE: agent_started event is emitted by the orchestrator before calling
  // this loop. We do NOT emit it here to avoid duplicate "started" events in UI.

  let turn = 0;
  let toolCallCount = 0;
  let allText = "";

  while (turn < maxTurns) {
    turn++;

    // Check for cancellation before each API call
    if (opts.signal?.aborted) {
      break;
    }

    // Build request params with optional extended thinking
    const requestParams: Record<string, unknown> = {
      model,
      max_tokens: enableThinking ? 16000 : 8192,
      system: opts.systemPrompt,
      tools: opts.tools,
      messages,
    };

    // Force tool use during investigation phase to ensure agents actually
    // read files, search code, and run scans before producing findings.
    // After enough tool calls, let the model decide when to stop.
    // NOTE: Anthropic API does not allow thinking + forced tool_choice together,
    // so we disable thinking during forced tool turns and re-enable it after.
    const inForcedPhase = forcedToolTurns > 0 && toolCallCount < forcedToolTurns;

    if (inForcedPhase) {
      requestParams.tool_choice = { type: "any" };
      // Thinking is incompatible with forced tool_choice — skip it
    } else if (enableThinking) {
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
        toolCallCount++;

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

    // If no tool calls were made this turn and we're past forced turns, we're done.
    // When tool_choice is "any", the model always produces at least one tool_use,
    // so this condition only triggers after forced investigation is complete.
    if (toolResults.length === 0 && response.stop_reason !== "tool_use") {
      break;
    }

    // If the model used tools, continue the conversation with results
    if (toolResults.length > 0) {
      messages.push({
        role: "assistant",
        content: assistantContent as any,
      });

      messages.push({
        role: "user",
        content: toolResults,
      });
    } else {
      // No tools, not forced — break
      break;
    }
  }

  // Extract findings from the accumulated text
  let findings = extractFindings(allText);

  // ── Confidence-based iteration ──
  // FastCode-inspired: if the agent didn't investigate deeply enough,
  // prompt it to continue. This catches cases where agents produce
  // findings too quickly without sufficient evidence.
  const enableConfidenceCheck = opts.enableConfidenceCheck ?? (opts.name !== "validator");
  const maxConfidenceRounds = opts.maxConfidenceRounds ?? 2;

  if (enableConfidenceCheck && !opts.signal?.aborted) {
    let confidenceRound = 0;

    while (confidenceRound < maxConfidenceRounds && !opts.signal?.aborted) {
      // Evaluate investigation quality
      const needsMore = evaluateInvestigationQuality(findings, toolCallCount);
      if (!needsMore) break;

      confidenceRound++;
      opts.onEvent({
        type: "evidence_collected",
        agent: opts.name,
        data: {
          kind: "confidence_iteration",
          round: confidenceRound,
          reason: needsMore,
          message: `Confidence check: ${needsMore}. Requesting deeper investigation (round ${confidenceRound}/${maxConfidenceRounds})`,
        },
      });

      // Inject follow-up prompt asking for deeper analysis
      messages.push({
        role: "assistant",
        content: allText.slice(-2000) || "I'll continue my investigation.",
      });

      messages.push({
        role: "user",
        content: `Your investigation may not be thorough enough: ${needsMore}

Please use more tools to deepen your analysis:
- Read more files, especially high-criticality ones
- Use crp_code_symbol_lookup to trace key functions
- Use crp_code_call_graph for structural insight
- Search for more patterns with crp_repo_search
- Then update your findings with stronger evidence and higher confidence.

Continue your analysis and then provide your COMPLETE updated findings.`,
      });

      // Run additional turns
      let extraTurn = 0;
      const extraMaxTurns = 10;
      while (extraTurn < extraMaxTurns && !opts.signal?.aborted) {
        extraTurn++;
        turn++;

        const extraParams: Record<string, unknown> = {
          model,
          max_tokens: enableThinking ? 16000 : 8192,
          system: opts.systemPrompt,
          tools: opts.tools,
          messages,
        };

        if (enableThinking) {
          extraParams.thinking = {
            type: "enabled",
            budget_tokens: 4096,
          };
        }

        let extraResponse;
        try {
          extraResponse = await client.messages.create(extraParams as any);
        } catch {
          break;
        }

        if (opts.signal?.aborted) break;

        const extraContent = extraResponse.content;
        const extraToolResults: ToolResultBlockParam[] = [];

        for (const block of extraContent) {
          if (block.type === "thinking") {
            const t = (block as any).thinking || "";
            if (t && opts.onThinking) opts.onThinking(t);
          } else if (block.type === "text") {
            opts.onText((block as TextBlock).text);
            allText += (block as TextBlock).text;
          } else if (block.type === "tool_use") {
            const tb = block as ToolUseBlock;
            toolCallCount++;
            try {
              const result = await opts.onToolCall(tb.name, tb.input as Record<string, unknown>);
              const resultStr = typeof result === "string" ? result : JSON.stringify(result);
              extraToolResults.push({ type: "tool_result", tool_use_id: tb.id, content: resultStr });
            } catch (err: any) {
              extraToolResults.push({ type: "tool_result", tool_use_id: tb.id, content: `Error: ${err.message}`, is_error: true });
            }
          }
        }

        if (extraToolResults.length > 0) {
          messages.push({ role: "assistant", content: extraContent as any });
          messages.push({ role: "user", content: extraToolResults });
        } else {
          break;
        }
      }

      // Re-extract findings from all accumulated text
      findings = extractFindings(allText);
    }
  }

  // NOTE: We do NOT emit finding_emitted events here — the orchestrator
  // handles finding storage and event emission after this function returns.
  // Emitting here would create DUPLICATE finding_emitted events in the timeline.

  return findings;
}

/**
 * Evaluate whether the agent's investigation was thorough enough.
 * Returns a reason string if more investigation is needed, null otherwise.
 */
function evaluateInvestigationQuality(
  findings: AgentFinding[],
  toolCallCount: number,
): string | null {
  // If too few tool calls, agent probably didn't investigate enough
  if (toolCallCount < 3) {
    return `Only ${toolCallCount} tool calls made — agents should investigate with at least 5-10 tool calls`;
  }

  // If findings have very low average confidence, need more evidence
  if (findings.length > 0) {
    const avgConfidence = findings.reduce((sum, f) => sum + (f.confidence || 0), 0) / findings.length;
    if (avgConfidence < 0.5) {
      return `Average finding confidence is ${(avgConfidence * 100).toFixed(0)}% — investigate further to improve confidence`;
    }
  }

  // If findings have no evidence, the agent is making claims without proof
  const noEvidence = findings.filter((f) => !f.evidence || f.evidence.length === 0);
  if (noEvidence.length > findings.length * 0.5 && findings.length > 0) {
    return `${noEvidence.length}/${findings.length} findings lack code evidence — read the actual code to verify`;
  }

  return null; // Investigation quality is acceptable
}

function extractFindings(text: string): AgentFinding[] {
  // Try to extract from ALL <findings> tags and merge results
  const tagRegex = /<findings>([\s\S]*?)<\/findings>/g;
  const allTagFindings: AgentFinding[] = [];
  let tagMatch;
  while ((tagMatch = tagRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(tagMatch[1]);
      if (Array.isArray(parsed)) {
        allTagFindings.push(...parsed);
      }
    } catch {
      // Skip malformed blocks, continue to next
    }
  }
  if (allTagFindings.length > 0) {
    return allTagFindings;
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
