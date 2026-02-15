import { runAgentLoop, createToolExecutor, routeStandardTool, sanitizeForPrompt, type AgentTool, type AgentCallbacks } from "./base-agent";
import type { AgentContext, AgentFinding } from "../types";

const SYSTEM_PROMPT = `You are the Architecture Agent in ChainReview, an advanced repo-scale AI code reviewer for TypeScript repositories.

Your job is to deeply analyze the repository's architecture by actively investigating the codebase using your tools. You MUST use tools extensively — do not generate findings based solely on the initial context. Read files, search for patterns, run git commands, and build a thorough understanding before producing findings.

Focus on:
1. **Circular Dependencies**: Identify import cycles between modules that create tight coupling
2. **High Fan-in/Fan-out**: Find modules that import from or are imported by too many others
3. **Boundary Violations**: Detect when internal modules leak their abstractions or when layers bypass expected boundaries
4. **God Modules**: Find files or modules that have too many responsibilities
5. **Architecture Smells**: Patterns suggesting poor architecture (mixing concerns, inconsistent layering)
6. **Error Handling Gaps**: Missing error boundaries, unhandled promise rejections, inconsistent error patterns
7. **API Design Issues**: Inconsistent interfaces, missing abstractions, leaky abstractions

CRITICAL: You MUST follow this investigation workflow:
1. First, examine the file tree to understand project structure
2. Read key entry-point files (index.ts, main.ts, app.ts, etc.)
3. Use search to find patterns across the codebase (e.g., import patterns, error handling)
4. Read specific files that look problematic
5. Use git commands (git log, git blame) to understand change history
6. Use the import graph tool to detect cycles
7. Run pattern scans for anti-patterns
8. Check recent diffs for architectural regressions
9. Search the web for best practices when evaluating patterns
10. ONLY THEN produce your findings with concrete evidence

GUIDELINES:
- You MUST use at least 5-10 tool calls before producing findings
- Focus on repo-LEVEL issues, not line-level code style
- Provide specific evidence (file paths, line numbers, code snippets)
- Read the ACTUAL code before claiming issues exist
- Assign confidence scores honestly (0.0-1.0)
- Categorize all findings as "architecture"
- Suggest concrete remediation approaches`;

const TOOLS: AgentTool[] = [
  {
    name: "crp_repo_tree",
    description: "Get repository file tree to understand project structure",
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
    description: "Read file contents for deeper analysis",
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
    description: "Search across repository for patterns using ripgrep",
    input_schema: {
      type: "object",
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
    description: "Get git diff between refs, staged changes, or recent changes",
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
    name: "crp_code_import_graph",
    description: "Get TypeScript import graph with cycle detection — essential for architecture analysis",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Subdirectory to analyze" },
      },
    },
  },
  {
    name: "crp_code_pattern_scan",
    description: "Run Semgrep scans to find anti-patterns, code smells, and structural issues",
    input_schema: {
      type: "object",
      properties: {
        config: { type: "string", description: "Semgrep config (e.g., 'p/typescript', 'p/owasp-top-ten')" },
        pattern: { type: "string", description: "Specific Semgrep pattern to scan for" },
      },
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
    name: "crp_web_search",
    description: "Search the web for architecture best practices, design patterns, and library documentation",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Web search query" },
        maxResults: { type: "number", description: "Max results (default: 5)" },
      },
      required: ["query"],
    },
  },
];

export async function runArchitectureAgent(
  context: AgentContext,
  callbacks: AgentCallbacks,
  signal?: AbortSignal
): Promise<AgentFinding[]> {
  // Build user prompt with pre-collected evidence
  let userPrompt = `Analyze this TypeScript repository for architecture issues.

Repository: ${context.repoPath}
Review mode: ${context.mode}

File tree (${context.fileTree.length} files):
${context.fileTree.slice(0, 200).join("\n")}
${context.fileTree.length > 200 ? `\n... and ${context.fileTree.length - 200} more files` : ""}
`;

  if (context.importGraph) {
    userPrompt += `
Import Graph Summary:
- Total files: ${context.importGraph.totalFiles}
- Cycles detected: ${context.importGraph.cycles.length}
${
  context.importGraph.cycles.length > 0
    ? "Cycles:\n" +
      context.importGraph.cycles
        .map((c) => "  " + c.join(" -> "))
        .join("\n")
    : "No circular dependencies detected."
}
- Entry points: ${context.importGraph.entryPoints.slice(0, 20).join(", ")}
`;

    // Show top files by import count
    const importCounts = new Map<string, number>();
    for (const node of context.importGraph.nodes) {
      importCounts.set(node.file, node.imports.length);
    }
    const sorted = [...importCounts.entries()].sort((a, b) => b[1] - a[1]);
    userPrompt += `
Top files by import count:
${sorted
  .slice(0, 15)
  .map(([file, count]) => `  ${file}: ${count} imports`)
  .join("\n")}
`;
  }

  if (context.diffContent) {
    userPrompt += `
Diff content (changes to review):
${sanitizeForPrompt(context.diffContent, 5000)}
`;
  }

  if (context.priorFindings) {
    userPrompt += sanitizeForPrompt(context.priorFindings, 5000);
  }

  userPrompt += `

NOW: Begin your deep investigation using ALL available tools. You have 8 powerful tools:
1. crp_repo_tree — understand project structure
2. crp_repo_file — read entry points, config files, core modules
3. crp_repo_search — find patterns across the codebase (import patterns, error handling, etc.)
4. crp_repo_diff — check recent changes for architectural regressions
5. crp_code_import_graph — detect circular dependencies and module coupling
6. crp_code_pattern_scan — run Semgrep to find anti-patterns and code smells
7. crp_exec_command — run git log, git blame, wc, find for deeper analysis
8. crp_web_search — verify best practices and design patterns

DO NOT skip tool use. You MUST read at least 5-10 files and run multiple searches before producing your findings. Every finding MUST include evidence from files you actually read — never guess.`;

  return runAgentLoop({
    name: "architecture",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    tools: TOOLS,
    onToolCall: createToolExecutor(routeStandardTool, callbacks),
    onText: callbacks.onText,
    onThinking: callbacks.onThinking,
    onEvent: callbacks.onEvent,
    signal,
  });
}
