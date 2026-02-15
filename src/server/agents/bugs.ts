import { runAgentLoop, createToolExecutor, routeStandardTool, sanitizeForPrompt, type AgentTool, type AgentCallbacks, type ToolHandler } from "./base-agent";
import { codePatternScan } from "../tools/code";
import type { AgentContext, AgentFinding, Evidence } from "../types";

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

- **crp_repo_tree**: Get repository file tree to understand project structure
- **crp_repo_file**: Read file contents to examine code
- **crp_repo_search**: Search for patterns across the codebase using regex
- **crp_repo_diff**: Get git diff to find recently introduced bugs
- **crp_code_pattern_scan**: Run pattern scans for common bug patterns
- **crp_exec_command**: Execute read-only shell commands (git log, git blame, grep, etc.)
- **emit_finding**: Report a bug finding — YOU MUST CALL THIS FOR EVERY BUG

## METHODOLOGY — FOLLOW THIS EXACTLY

1. **EXPLORE** — Get the file tree to understand the project layout
2. **SEARCH** — Search for common bug patterns across the codebase:
   - \`.then(\` without \`.catch(\` (unhandled promise rejections)
   - \`catch\\s*\\(.*\\)\\s*\\{\\s*\\}\` (empty catch blocks that swallow errors)
   - \`==\\s\` without \`===\` (loose equality)
   - \`\\.length\\s*[<>=]\` (off-by-one boundary checks)
   - \`await\` inside loops (potential performance/race issues)
   - \`JSON\\.parse\` without try/catch (crash on invalid JSON)
   - \`\\!\` prefix on complex expressions (inverted logic)
   - \`as any\` or type assertions (type safety bypasses)
3. **READ** — Read each suspicious file to understand context and confirm the bug
4. **EMIT** — For each confirmed bug, call emit_finding with:
   - Clear title describing the bug
   - Exact file path and line numbers
   - Evidence showing the problematic code
   - Explanation of what could go wrong
   - Suggested fix

CRITICAL: You MUST use at least 5 tools before producing findings. You MUST call emit_finding for every bug — it is the ONLY way to report your findings.

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
    name: "crp_repo_tree",
    description: "Get repository file tree to understand project structure and find files to investigate",
    input_schema: {
      type: "object",
      properties: {
        maxDepth: { type: "number", description: "Maximum directory depth" },
        pattern: { type: "string", description: "Filter files by pattern" },
      },
    },
  },
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
    name: "crp_repo_diff",
    description: "Get git diff to review recent changes for newly introduced bugs",
    input_schema: {
      type: "object",
      properties: {
        ref1: { type: "string", description: "First git ref (commit, branch, tag)" },
        ref2: { type: "string", description: "Second git ref" },
        staged: { type: "boolean", description: "Show staged changes only" },
      },
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
    name: "crp_exec_command",
    description: "Execute a read-only shell command (wc, find, ls, cat, head, tail, grep, git log/show/blame/diff/status, npm ls, tsc --noEmit)",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" },
        timeout: { type: "number", description: "Timeout in ms (default: 10000)" },
      },
      required: ["command"],
    },
  },
  {
    name: "crp_code_call_graph",
    description: "Build function-level call graph to understand code flow — reveals which functions call which and identifies high fan-in hubs where bugs have maximum blast radius.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Subdirectory to scope analysis to" },
      },
    },
  },
  {
    name: "crp_code_symbol_lookup",
    description: "Find the definition and all references for a symbol. Useful for tracing a buggy function to everywhere it's called.",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Symbol name to look up" },
        file: { type: "string", description: "Specific file to search in first" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "crp_code_impact_analysis",
    description: "Compute blast radius of a file — find all downstream modules affected. Focus bug hunting on high-impact files.",
    input_schema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Relative file path to analyze impact for" },
        depth: { type: "number", description: "Max traversal depth (default: 3)" },
      },
      required: ["file"],
    },
  },
  {
    name: "emit_finding",
    description: "Report a bug finding. You MUST call this for each bug you discover. This is the ONLY way to report findings.",
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
 * Now accepts the full AgentContext (like security/architecture agents)
 * for rich initial context: file tree, semgrep results, diff, prior findings.
 */
export async function runBugsAgent(
  context: AgentContext,
  callbacks: BugsAgentCallbacks,
  signal?: AbortSignal,
  targetPath?: string
): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  const scopeDescription = targetPath
    ? `Focus your analysis on: ${targetPath}`
    : "Analyze the entire repository";

  // Build a rich initial message with full context (matching security/architecture agents)
  let initialMessage = `Analyze this TypeScript/JavaScript codebase for application logic bugs.

Repository: ${context.repoPath}
Review mode: ${context.mode}

${scopeDescription}

File tree (${context.fileTree.length} files):
${context.fileTree
  .filter(
    (f) =>
      f.endsWith(".ts") ||
      f.endsWith(".tsx") ||
      f.endsWith(".js") ||
      f.endsWith(".jsx")
  )
  .slice(0, 150)
  .join("\n")}
${context.fileTree.length > 150 ? `\n... and ${context.fileTree.length - 150} more files` : ""}
`;

  if (context.semgrepResults && context.semgrepResults.length > 0) {
    initialMessage += `
Semgrep Scan Results (${context.semgrepResults.length} findings — use these as starting points):
${context.semgrepResults
  .map(
    (r, i) =>
      `${i + 1}. [${sanitizeForPrompt(r.severity, 20)}] ${sanitizeForPrompt(r.ruleId, 100)}
   File: ${sanitizeForPrompt(r.filePath, 200)}:${r.startLine}-${r.endLine}
   Message: ${sanitizeForPrompt(r.message, 500)}
   Code: ${sanitizeForPrompt(r.snippet, 500)}`
  )
  .join("\n\n")}
`;
  }

  if (context.diffContent) {
    initialMessage += `
Diff content (recent changes — check these for newly introduced bugs):
${sanitizeForPrompt(context.diffContent, 5000)}
`;
  }

  // Inject module criticality — bugs in high-fan-in files have widest blast radius
  if (context.criticalFiles && context.criticalFiles.length > 0) {
    initialMessage += `
## High-Impact Modules (bugs here affect the most code — prioritize these)
${context.criticalFiles
  .slice(0, 10)
  .map(
    (f, i) =>
      `${i + 1}. ${f.file} — Fan-in: ${f.fanIn}, Fan-out: ${f.fanOut} (${f.reason})`
  )
  .join("\n")}
`;
  }

  // Inject blast radius for diff reviews
  if (context.impactedModules && context.impactedModules.length > 0) {
    initialMessage += `
## Change Blast Radius
Recently changed files affect these downstream modules — check for introduced bugs:
${context.impactedModules
  .slice(0, 10)
  .map(
    (m) =>
      `- ${m.file} (distance: ${m.distance} hop${m.distance > 1 ? "s" : ""}, fan-in: ${m.fanIn})`
  )
  .join("\n")}
`;
  }

  if (context.priorFindings) {
    initialMessage += sanitizeForPrompt(context.priorFindings, 5000);
  }

  initialMessage += `

NOW: Begin your deep investigation using ALL available tools. You have 10 powerful tools:
1. crp_repo_tree — understand project structure, find files to investigate
2. crp_repo_file — read files to examine code for bugs
3. crp_repo_search — search for bug patterns (empty catches, loose equality, unhandled promises, null access)
4. crp_repo_diff — check recent changes for newly introduced bugs
5. crp_code_pattern_scan — run pattern scans for common bug patterns
6. crp_exec_command — use git log, git blame for deeper analysis
7. crp_code_call_graph — build call graph to trace code flow and find high-impact functions
8. crp_code_symbol_lookup — find all usages of a buggy function
9. crp_code_impact_analysis — compute how many modules a buggy file affects
10. emit_finding — report each bug you find (REQUIRED for every bug)

CRITICAL INSTRUCTIONS:
- You MUST use at least 5-10 tool calls BEFORE emitting any findings
- You MUST read the actual code before reporting any bug
- You MUST call emit_finding for EVERY bug you discover — this is the ONLY way to report findings
- Every finding MUST include real code evidence from files you read
- START by investigating the highest-impact modules listed above
- Search for these patterns: .then( without .catch(, empty catch blocks, == instead of ===, missing null checks, await in loops, JSON.parse without try/catch, missing await on promises
- Use crp_code_symbol_lookup to trace buggy functions to all call sites

Begin your investigation now. Use tools aggressively.`;

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
    forcedToolTurns: 5,
  });

  // Emit completion event
  callbacks.onEvent({
    type: "agent_completed",
    agent: "bugs",
    data: { findingCount: findings.length },
  });

  return findings;
}
