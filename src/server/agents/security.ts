import { runAgentLoop, type AgentTool } from "./base-agent";
import { repoTree, repoFile, repoSearch, repoDiff } from "../tools/repo";
import { codeImportGraph, codePatternScan } from "../tools/code";
import { execCommand } from "../tools/exec";
import { webSearch } from "../tools/web";
import type { AgentContext, AgentFinding, AuditEvent } from "../types";

const SYSTEM_PROMPT = `You are the Security Agent in ChainReview, an advanced repo-scale AI code reviewer for TypeScript repositories.

Your job is to deeply investigate the codebase for security vulnerabilities by actively using your tools. You MUST use tools extensively — do not just rely on the initial context or Semgrep results. Read files, search for patterns, check dependencies, and verify claims before producing findings.

Focus on:
1. **Injection Vulnerabilities**: SQL injection, command injection, XSS, template injection
2. **Authentication & Authorization**: Weak auth patterns, missing access controls, insecure session handling
3. **Data Exposure**: Hardcoded secrets, sensitive data in logs, unprotected PII, exposed API keys
4. **Input Validation**: Missing validation on user inputs, unsafe deserialization, type coercion
5. **Dependency Risks**: Known vulnerable patterns, unsafe use of third-party libraries
6. **Cryptography Issues**: Weak algorithms, improper key management
7. **Path Traversal**: File access without proper sandboxing
8. **Command Injection**: Shell execution without proper sanitization
9. **Import Chain Attacks**: Dependencies pulling in unexpected code through deep import chains

CRITICAL: You MUST follow this investigation workflow:
1. First, get the file tree to understand the project layout
2. Search for security-sensitive patterns: eval, exec, spawn, readFile, SQL, cookie, token, password, secret, env, cors, helmet
3. Read ALL files that match security-sensitive patterns
4. Check package.json for dependency versions and known vulnerabilities
5. Use the import graph to trace how sensitive modules are connected
6. Use Semgrep pattern scan for OWASP top-ten issues
7. Check git diffs for recently introduced security risks
8. Search the web for known CVEs in detected dependencies
9. Use git log to check for recently changed security-critical code
10. ONLY THEN produce your findings with concrete evidence from code you read

GUIDELINES:
- You MUST use at least 5-10 tool calls before producing findings
- Prioritize findings by actual exploitability and real-world impact
- Provide EXACT code snippets from files you read as evidence
- Explain what an attacker could actually do
- Suggest concrete remediation steps with code examples
- Assign confidence scores honestly (0.0-1.0)
- Categorize all findings as "security"
- Don't flag trivial issues — focus on exploitable risks`;

const TOOLS: AgentTool[] = [
  {
    name: "crp_repo_tree",
    description: "Get repository file tree to understand project structure and find security-relevant files",
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
    description: "Read file contents for deeper security analysis",
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
    description: "Search repository for security-related patterns using ripgrep",
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
    description: "Get git diff to find recently introduced security risks or review specific changes",
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
    description: "Get TypeScript import graph — trace how sensitive modules are connected and detect unexpected dependencies",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Subdirectory to analyze" },
      },
    },
  },
  {
    name: "crp_code_pattern_scan",
    description: "Run Semgrep scans for security vulnerabilities (OWASP, injection, XSS, etc.)",
    input_schema: {
      type: "object",
      properties: {
        config: { type: "string", description: "Semgrep config (e.g., 'p/owasp-top-ten', 'p/typescript')" },
        pattern: { type: "string", description: "Specific Semgrep pattern to scan" },
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
    description: "Search the web for CVEs, security advisories, best practices, and vulnerability databases",
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

export async function runSecurityAgent(
  context: AgentContext,
  callbacks: {
    onText: (text: string) => void;
    onThinking?: (text: string) => void;
    onEvent: (event: Omit<AuditEvent, "id" | "timestamp">) => void;
    onToolCall: (tool: string, args: Record<string, unknown>) => void;
    onToolResult: (tool: string, result: string) => void;
  },
  signal?: AbortSignal
): Promise<AgentFinding[]> {
  let userPrompt = `Analyze this TypeScript repository for security vulnerabilities.

Repository: ${context.repoPath}
Review mode: ${context.mode}

File tree (${context.fileTree.length} files):
${context.fileTree
  .filter(
    (f) =>
      f.endsWith(".ts") ||
      f.endsWith(".tsx") ||
      f.endsWith(".js") ||
      f.endsWith(".jsx") ||
      f.includes("config") ||
      f.includes(".env")
  )
  .slice(0, 100)
  .join("\n")}
`;

  if (context.semgrepResults && context.semgrepResults.length > 0) {
    userPrompt += `
Semgrep Scan Results (${context.semgrepResults.length} findings):
${context.semgrepResults
  .map(
    (r, i) =>
      `${i + 1}. [${r.severity}] ${r.ruleId}
   File: ${r.filePath}:${r.startLine}-${r.endLine}
   Message: ${r.message}
   Code: ${r.snippet}`
  )
  .join("\n\n")}
`;
  } else {
    userPrompt += `
No Semgrep results available (Semgrep may not be installed or found no issues).
Please use the available tools to search for common security patterns manually.
`;
  }

  if (context.diffContent) {
    userPrompt += `
Diff content (changes to review for security issues):
${context.diffContent.slice(0, 5000)}
${context.diffContent.length > 5000 ? "\n... (diff truncated)" : ""}
`;
  }

  userPrompt += `

NOW: Begin your deep investigation using ALL available tools. You have 8 powerful tools:
1. crp_repo_tree — understand project layout, find config and env files
2. crp_repo_file — read security-critical files
3. crp_repo_search — search for eval, exec, spawn, readFile, password, secret, token, innerHTML, SQL, etc.
4. crp_repo_diff — check recent changes for newly introduced security risks
5. crp_code_import_graph — trace how sensitive modules are connected
6. crp_code_pattern_scan — run Semgrep for OWASP vulnerabilities
7. crp_exec_command — use git log, npm ls, grep for deeper analysis
8. crp_web_search — look up CVEs, security advisories for detected dependencies

DO NOT skip tool use. You MUST read at least 5-10 files and run multiple searches before producing your findings. Every finding MUST include evidence from files you actually read.`;

  return runAgentLoop({
    name: "security",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    tools: TOOLS,
    onToolCall: async (name, args) => {
      callbacks.onToolCall(name, args);
      const result = await handleToolCall(name, args);
      const resultStr = typeof result === "string" ? result : JSON.stringify(result);
      callbacks.onToolResult(name, resultStr);
      return result;
    },
    onText: callbacks.onText,
    onThinking: callbacks.onThinking,
    onEvent: callbacks.onEvent,
    signal,
  });
}
