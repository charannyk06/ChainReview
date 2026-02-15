import { runAgentLoop, createToolExecutor, routeStandardTool, type AgentTool, type AgentCallbacks, type ToolHandler } from "./base-agent";
import { codePatternScan } from "../tools/code";
import type { AgentFinding, Evidence } from "../types";

/**
 * Bugs Agent
 * 
 * Focuses on application logic and data flow bugs:
 * - Null/undefined handling gaps
 * - Off-by-one errors
 * - Race conditions
 * - Incorrect conditionals
 * - Promise/async errors
 * - Type coercion bugs
 * - Error handling gaps
 * - State management issues
 */

const SYSTEM_PROMPT = `You are the Bugs Agent in ChainReview, an advanced repo-scale AI code reviewer.

Your mission is to find **application logic bugs** — the subtle errors that cause incorrect behavior, data corruption, or unexpected crashes. These are NOT security vulnerabilities or architectural issues — those are handled by other agents.

## BUG CATEGORIES TO HUNT

### 1. NULL/UNDEFINED HANDLING
- Optional chaining missing where needed
- Null checks that don't cover all cases
- Accessing properties on potentially undefined objects
- Array methods on potentially empty arrays

### 2. OFF-BY-ONE ERRORS
- Loop boundary issues (< vs <=)
- Array index calculations
- String slicing edge cases
- Pagination/offset math

### 3. RACE CONDITIONS
- Async operations without proper sequencing
- State updates that can interleave
- Missing await on promises
- Event handlers that assume order

### 4. INCORRECT CONDITIONALS
- Inverted boolean logic
- Missing edge cases in if/else chains
- Truthy/falsy confusion (0, "", false, null)
- Operator precedence mistakes

### 5. PROMISE/ASYNC ERRORS
- Unhandled promise rejections
- Missing try/catch in async functions
- Fire-and-forget promises that should be awaited
- Promise.all vs Promise.allSettled misuse

### 6. TYPE COERCION BUGS
- == vs === comparisons
- Implicit string/number conversions
- JSON.parse without validation
- parseInt without radix

### 7. ERROR HANDLING GAPS
- Swallowed exceptions (empty catch blocks)
- Missing error propagation
- Incomplete error recovery
- Resource cleanup in error paths

### 8. STATE MANAGEMENT
- Stale closures
- React state update batching issues
- Mutable state shared across async boundaries
- Missing dependency array items

## TOOLS AVAILABLE

- **crp_repo_file**: Read file contents to examine code
- **crp_repo_search**: Search for patterns across the codebase
- **crp_code_pattern_scan**: Run pattern scans for common bug patterns
- **emit_finding**: Report a bug finding

## METHODOLOGY

1. Start by searching for common bug patterns:
   - \`.then(\` without \`.catch(\`
   - \`catch\\s*\\(.*\\)\\s*\\{\\s*\\}\` (empty catch)
   - \`==\\s\` without \`===\`
   - \`\\.length\\s*[<>=]\` (boundary checks)
   - \`await\` inside loops
   - \`JSON\\.parse\` without try/catch

2. Read suspicious files to understand context

3. For each real bug found, emit a finding with:
   - Clear title describing the bug
   - Exact file path and line numbers
   - Evidence showing the problematic code
   - Explanation of what could go wrong
   - Suggested fix

## OUTPUT RULES

- Only report REAL bugs with clear negative consequences
- Include code evidence in every finding
- Estimate severity based on impact:
  - **critical**: Data loss, corruption, or crash
  - **high**: Incorrect behavior affecting users
  - **medium**: Edge case failures
  - **low**: Minor issues, code smell
- Set confidence based on certainty:
  - 0.9+: Definite bug
  - 0.7-0.9: Very likely bug
  - 0.5-0.7: Possible bug, needs review`;

const TOOLS: AgentTool[] = [
  {
    name: "crp_repo_file",
    description: "Read file contents to examine code for bugs",
    input_schema: {
      type: "object",
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
    description: "Search the codebase for bug patterns using regex",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern to search" },
        glob: { type: "string", description: "Glob pattern to filter files (e.g., '**/*.ts')" },
        maxResults: { type: "number", description: "Maximum results to return" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "crp_code_pattern_scan",
    description: "Run structured pattern scans for common bug patterns",
    input_schema: {
      type: "object",
      properties: {
        patterns: {
          type: "array",
          items: { type: "string" },
          description: "List of pattern names or regex patterns to scan",
        },
        glob: { type: "string", description: "Glob pattern to filter files" },
      },
      required: ["patterns"],
    },
  },
  {
    name: "emit_finding",
    description: "Report a bug finding. Call this for each bug discovered.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short descriptive title for the bug" },
        description: { type: "string", description: "Detailed explanation of the bug and its impact" },
        filePath: { type: "string", description: "Relative path to the file" },
        lineStart: { type: "number", description: "Starting line number" },
        lineEnd: { type: "number", description: "Ending line number" },
        severity: { 
          type: "string", 
          enum: ["critical", "high", "medium", "low", "info"],
          description: "Bug severity" 
        },
        confidence: { 
          type: "number", 
          description: "Confidence score 0.0-1.0" 
        },
        category: {
          type: "string",
          enum: ["null-handling", "off-by-one", "race-condition", "conditional", "async", "type-coercion", "error-handling", "state-management"],
          description: "Bug category"
        },
        evidence: { type: "string", description: "Code snippet showing the bug" },
        suggestedFix: { type: "string", description: "How to fix the bug" },
      },
      required: ["title", "description", "filePath", "severity", "confidence", "category", "evidence"],
    },
  },
];

export interface BugsAgentCallbacks extends AgentCallbacks {
  onFinding: (finding: AgentFinding) => void;
}

/**
 * Run the Bugs Agent to find application logic bugs.
 */
export async function runBugsAgent(
  targetPath: string | undefined,
  runId: string,
  callbacks: BugsAgentCallbacks,
  signal?: AbortSignal,
  priorFindings?: string
): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  const scopeDescription = targetPath
    ? `Focus your analysis on: ${targetPath}`
    : "Analyze the entire repository";

  const initialMessage = `You are reviewing a TypeScript/JavaScript codebase for application logic bugs.

${scopeDescription}

Start by searching for common bug patterns:
1. Search for unhandled promises: \`.then(\` without error handling
2. Search for empty catch blocks: catch blocks that swallow errors
3. Search for loose equality: == instead of ===
4. Search for potential null access: property access without null checks
5. Search for async issues: await in loops, missing await

For each real bug you find, read the surrounding code to understand context, then emit a finding.
${priorFindings || ""}
Begin your analysis now.`;

  // Tool handler: routes standard tools + handles bugs-specific virtual tools
  const bugsToolHandler: ToolHandler = async (name, args) => {
    switch (name) {
      case "emit_finding": {
        const findingId = `bugs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const evidenceArr: Evidence[] = [];
        if (args.evidence) {
          evidenceArr.push({
            filePath: (args.filePath as string) || "unknown",
            startLine: (args.lineStart as number) || 1,
            endLine: (args.lineEnd as number) || 1,
            snippet: args.evidence as string,
          });
        }

        const finding: AgentFinding = {
          title: args.title as string,
          description: args.description as string + (args.suggestedFix ? `\n\n**Suggested Fix:** ${args.suggestedFix}` : ""),
          severity: args.severity as "critical" | "high" | "medium" | "low" | "info",
          confidence: args.confidence as number,
          category: "bugs",
          evidence: evidenceArr,
        };

        findings.push(finding);
        callbacks.onFinding(finding);

        callbacks.onEvent({
          type: "finding_emitted",
          agent: "bugs",
          data: { findingId, title: finding.title, severity: finding.severity },
        });

        return JSON.stringify({
          success: true,
          message: `Finding recorded: ${finding.title}`,
          findingId,
        });
      }

      case "crp_code_pattern_scan": {
        // Bugs agent uses array-of-patterns schema; run each pattern separately
        const patterns = args.patterns as string[] | undefined;
        if (patterns && patterns.length > 0) {
          const allResults: any[] = [];
          for (const pat of patterns.slice(0, 5)) {
            try {
              const result = await codePatternScan({ pattern: pat });
              allResults.push(...result.results);
            } catch {
              // Individual pattern failure is non-fatal
            }
          }
          return { results: allResults, totalResults: allResults.length };
        }
        return codePatternScan({});
      }

      default:
        return routeStandardTool(name, args);
    }
  };

  // NOTE: The orchestrator already emits agent_started for bugs — don't duplicate it here.

  await runAgentLoop({
    name: "bugs",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: initialMessage,
    tools: TOOLS,
    onToolCall: createToolExecutor(bugsToolHandler, callbacks),
    onText: callbacks.onText,
    onThinking: callbacks.onThinking,
    onEvent: callbacks.onEvent,
    maxTurns: 25,
    signal,
    model: "claude-haiku-4-5-20251001",
  });

  // Emit completion event
  callbacks.onEvent({
    type: "agent_completed",
    agent: "bugs",
    data: { findingCount: findings.length },
  });

  return findings;
}
