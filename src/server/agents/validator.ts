import { runAgentLoop, type AgentTool } from "./base-agent";
import { repoTree, repoFile, repoSearch, repoDiff } from "../tools/repo";
import { codeImportGraph, codePatternScan } from "../tools/code";
import { execCommand } from "../tools/exec";
import { webSearch } from "../tools/web";
import { patchValidate } from "../tools/patch";
import type { AgentFinding, AuditEvent, Finding } from "../types";
import type { Store } from "../store";

const CHALLENGE_SYSTEM_PROMPT = `You are the Validator Agent in ChainReview. Your job is to CHALLENGE findings from other agents by doing your OWN independent investigation.

You have access to the FULL tool suite — use it. Don't just read the file mentioned in the finding. Investigate thoroughly:

For each finding you receive, you must:
1. Read the relevant code to verify the finding is accurate
2. Search the ENTIRE codebase for mitigating factors (e.g., input validation elsewhere, error handlers, middleware)
3. Check the import graph to understand the module's place in the architecture
4. Run pattern scans to see if the issue is systemic or isolated
5. Check git history to understand if this was intentional
6. Search the web for whether the flagged pattern is actually a security risk
7. Consider if the finding might be a false positive
8. Assess whether the severity and confidence are appropriate

You should:
- CONFIRM findings that are clearly valid with evidence
- DOWNGRADE findings that are overstated (lower severity or confidence)
- REJECT findings that are false positives with explanation
- Add additional context or evidence when relevant

Output your validated findings as a JSON array. For rejected findings, set confidence to 0.
For confirmed findings, you may adjust the confidence score up or down.`;

const PATCH_SYSTEM_PROMPT = `You are the Validator Agent in ChainReview. Your job is to validate proposed patches.

For each patch:
1. Read the original file to understand the context
2. Use the patch validation tool to check if it applies cleanly
3. Consider if the patch introduces any new issues
4. Check if the patch fully addresses the finding
5. Search for related code that might also need updating

Provide your assessment as findings with category "bugs" for any issues found.`;

const CHALLENGE_TOOLS: AgentTool[] = [
  {
    name: "crp_repo_tree",
    description: "Get repository file tree to understand project structure and find related files",
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
    description: "Read file contents to verify findings and check for mitigating factors",
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
    description: "Search repository for related patterns, mitigations, and validation code",
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
    description: "Get git diff to check if flagged code was recently changed or if there are pending fixes",
    input_schema: {
      type: "object",
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
      type: "object",
      properties: {
        path: { type: "string", description: "Subdirectory to analyze" },
      },
    },
  },
  {
    name: "crp_code_pattern_scan",
    description: "Run Semgrep to check if the flagged issue is a known anti-pattern or if mitigations exist",
    input_schema: {
      type: "object",
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
    description: "Search the web to verify if flagged patterns are actually dangerous, check CVE databases, and find best practices",
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

const PATCH_TOOLS: AgentTool[] = [
  ...CHALLENGE_TOOLS,
  {
    name: "crp_patch_validate",
    description: "Validate a patch (check if it applies cleanly and passes syntax check)",
    input_schema: {
      type: "object",
      properties: {
        patchId: { type: "string", description: "ID of the patch to validate" },
      },
      required: ["patchId"],
    },
  },
];

async function handleChallengeToolCall(
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

async function handlePatchToolCall(
  name: string,
  args: Record<string, unknown>,
  store: Store
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
    case "crp_patch_validate":
      return patchValidate(args as any, store);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Challenge Mode: Validate findings from other agents ──

export async function runValidatorChallenge(
  findings: Finding[],
  repoPath: string,
  callbacks: {
    onText: (text: string) => void;
    onThinking?: (text: string) => void;
    onEvent: (event: Omit<AuditEvent, "id" | "timestamp">) => void;
    onToolCall: (tool: string, args: Record<string, unknown>) => void;
    onToolResult: (tool: string, result: string) => void;
  },
  signal?: AbortSignal
): Promise<AgentFinding[]> {
  const userPrompt = `Review and challenge these findings from the Architecture and Security agents.
For each finding, do your OWN investigation — don't just take their word for it.

You have 8 powerful tools. Use them ALL:
- crp_repo_tree, crp_repo_file, crp_repo_search — read and search the codebase
- crp_repo_diff — check recent changes  
- crp_code_import_graph — trace module dependencies
- crp_code_pattern_scan — run Semgrep for verification
- crp_exec_command — run git log, git blame, grep for context
- crp_web_search — verify if patterns are actually dangerous

Findings to validate:
${findings
  .map(
    (f, i) =>
      `${i + 1}. [${f.severity.toUpperCase()}] ${f.title} (${f.agent} agent, confidence: ${f.confidence})
   Category: ${f.category}
   Description: ${f.description}
   Evidence:
${(f.evidence || []).map((e) => `     - ${e.filePath}:${e.startLine}-${e.endLine}: ${(e.snippet || "").slice(0, 200)}`).join("\n")}`
  )
  .join("\n\n")}

For each finding:
1. Read the actual code file and verify the claim
2. Search for mitigating factors (input validation, error handlers, middleware, etc.)
3. Check if the pattern is actually dangerous in this context
4. Verify severity is appropriate

Output a validated version with potentially adjusted confidence and severity.
Set confidence to 0 for false positives. Add explanation for any changes.`;

  return runAgentLoop({
    name: "validator",
    systemPrompt: CHALLENGE_SYSTEM_PROMPT,
    userPrompt,
    tools: CHALLENGE_TOOLS,
    onToolCall: async (name, args) => {
      callbacks.onToolCall(name, args);
      const result = await handleChallengeToolCall(name, args);
      const resultStr = typeof result === "string" ? result : JSON.stringify(result);
      callbacks.onToolResult(name, resultStr);
      return result;
    },
    onText: callbacks.onText,
    onThinking: callbacks.onThinking,
    onEvent: callbacks.onEvent,
    maxTurns: 50,
    model: "claude-haiku-4-5-20251001", // Haiku 4.5 for all agents
    signal,
  });
}

// ── Patch Validation Mode ──

export async function runValidatorPatch(
  patchId: string,
  finding: Finding,
  store: Store,
  callbacks: {
    onText: (text: string) => void;
    onEvent: (event: Omit<AuditEvent, "id" | "timestamp">) => void;
    onToolCall: (tool: string, args: Record<string, unknown>) => void;
    onToolResult: (tool: string, result: string) => void;
  }
): Promise<{ validated: boolean; message: string }> {
  const patch = store.getPatch(patchId);
  if (!patch) {
    return { validated: false, message: `Patch not found: ${patchId}` };
  }

  const userPrompt = `Validate this patch proposal.

Finding: [${finding.severity.toUpperCase()}] ${finding.title}
Description: ${finding.description}

Patch diff:
${patch.diff}

Steps:
1. Read the original file to understand the context
2. Use crp_patch_validate to check if the patch applies cleanly
3. Assess if the patch fully addresses the finding without introducing new issues

Use the crp_patch_validate tool with patchId "${patchId}" to validate.`;

  const validationFindings = await runAgentLoop({
    name: "validator",
    systemPrompt: PATCH_SYSTEM_PROMPT,
    userPrompt,
    tools: PATCH_TOOLS,
    onToolCall: async (name, args) => {
      callbacks.onToolCall(name, args);
      const result = await handlePatchToolCall(name, args, store);
      const resultStr = typeof result === "string" ? result : JSON.stringify(result);
      callbacks.onToolResult(name, resultStr);
      return result;
    },
    onText: callbacks.onText,
    onEvent: callbacks.onEvent,
    maxTurns: 20,
    model: "claude-haiku-4-5-20251001", // Haiku 4.5 for all agents
  });

  // Check the patch validation status from the store
  const updatedPatch = store.getPatch(patchId);
  if (updatedPatch?.validated) {
    return {
      validated: true,
      message: updatedPatch.validationMessage || "Patch validated successfully",
    };
  }

  // If there are validation findings (issues with the patch), it's not validated
  if (validationFindings.length > 0) {
    const msg = validationFindings
      .map((f) => f.title)
      .join("; ");
    return { validated: false, message: `Issues found: ${msg}` };
  }

  return {
    validated: updatedPatch?.validated ?? false,
    message: updatedPatch?.validationMessage || "Validation inconclusive",
  };
}
