import { runAgentLoop, type AgentTool } from "./base-agent";
import { repoFile, repoSearch } from "../tools/repo";
import { webSearch } from "../tools/web";
import type { Finding, AuditEvent } from "../types";

/**
 * Explainer Agent
 * 
 * Takes validated findings and generates human-readable explanations:
 * - Why this matters (business/security impact)
 * - How to fix (step-by-step remediation)
 * - Code examples (before/after)
 * - Executive summary (for non-technical stakeholders)
 */

const SYSTEM_PROMPT = `You are the Explainer Agent in ChainReview, an advanced repo-scale AI code reviewer.

Your job is to take technical findings from other agents and transform them into **clear, actionable, human-readable explanations** that both developers and non-technical stakeholders can understand.

For each finding you receive, you must produce:

## 1. WHY THIS MATTERS (Impact Analysis)
- Explain the real-world consequences in plain English
- Describe what could go wrong if this isn't fixed
- Rate the business/security impact (Critical/High/Medium/Low)
- Use concrete scenarios: "An attacker could...", "This would cause..."

## 2. HOW TO FIX (Step-by-Step Remediation)
- Provide numbered steps a developer can follow
- Be specific: mention exact files, functions, patterns
- Include code snippets showing the fix
- Estimate effort (Quick fix / Half-day / Multi-day refactor)

## 3. CODE EXAMPLES (Before/After)
- Show the problematic code pattern
- Show the corrected code pattern
- Explain what changed and why

## 4. RELATED RESOURCES
- Search for relevant documentation, best practices, or CVE references
- Link to authoritative sources when applicable

## GUIDELINES:
- Write at a level a junior developer can understand
- Avoid jargon — or define it when you must use it
- Be encouraging, not alarming — focus on solutions
- Use bullet points and short paragraphs for readability
- Read the actual code before writing explanations
- Use tools to verify your suggestions are accurate

## OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "findingId": "the original finding ID",
  "summary": "One-sentence summary of the issue",
  "whyItMatters": {
    "impact": "Critical|High|Medium|Low",
    "explanation": "Plain English explanation",
    "scenario": "Concrete example of what could go wrong"
  },
  "howToFix": {
    "effort": "Quick fix|Half-day|Multi-day refactor",
    "steps": ["Step 1...", "Step 2...", "Step 3..."]
  },
  "codeExample": {
    "before": "code snippet showing the problem",
    "after": "code snippet showing the fix",
    "explanation": "What changed and why"
  },
  "resources": [
    { "title": "Resource name", "url": "https://...", "relevance": "Why this helps" }
  ]
}`;

const TOOLS: AgentTool[] = [
  {
    name: "crp_repo_file",
    description: "Read file contents to understand the context around a finding",
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
    description: "Search the codebase for related patterns or usages",
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
    name: "crp_web_search",
    description: "Search the web for documentation, best practices, or CVE information",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "emit_explanation",
    description: "Emit the final explanation for a finding. Call this when you have gathered enough information.",
    input_schema: {
      type: "object",
      properties: {
        findingId: { type: "string", description: "ID of the finding being explained" },
        summary: { type: "string", description: "One-sentence summary" },
        impact: { 
          type: "string", 
          enum: ["Critical", "High", "Medium", "Low"],
          description: "Business/security impact level" 
        },
        whyItMatters: { type: "string", description: "Plain English explanation of consequences" },
        scenario: { type: "string", description: "Concrete example of what could go wrong" },
        effort: { 
          type: "string", 
          enum: ["Quick fix", "Half-day", "Multi-day refactor"],
          description: "Estimated effort to fix" 
        },
        steps: { 
          type: "array", 
          items: { type: "string" },
          description: "Step-by-step remediation instructions" 
        },
        codeBefore: { type: "string", description: "Code snippet showing the problem" },
        codeAfter: { type: "string", description: "Code snippet showing the fix" },
        codeExplanation: { type: "string", description: "What changed and why" },
        resources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              url: { type: "string" },
              relevance: { type: "string" },
            },
          },
          description: "Related documentation or resources",
        },
      },
      required: ["findingId", "summary", "impact", "whyItMatters", "effort", "steps"],
    },
  },
];

export interface Explanation {
  findingId: string;
  summary: string;
  whyItMatters: {
    impact: "Critical" | "High" | "Medium" | "Low";
    explanation: string;
    scenario?: string;
  };
  howToFix: {
    effort: "Quick fix" | "Half-day" | "Multi-day refactor";
    steps: string[];
  };
  codeExample?: {
    before: string;
    after: string;
    explanation: string;
  };
  resources: Array<{
    title: string;
    url: string;
    relevance: string;
  }>;
}

export interface ExplainerCallbacks {
  onEvent: (event: AuditEvent) => void;
  onExplanation: (explanation: Explanation) => void;
  onThinking?: (text: string) => void;
  onToolCall?: (name: string, input: unknown) => void;
}

/**
 * Run the Explainer Agent on a set of validated findings.
 * Generates human-readable explanations for each finding.
 */
export async function runExplainerAgent(
  findings: Finding[],
  runId: string,
  callbacks: ExplainerCallbacks,
  signal?: AbortSignal
): Promise<Explanation[]> {
  const explanations: Explanation[] = [];

  // Build context message with all findings
  const findingsContext = findings.map((f, i) => `
### Finding ${i + 1}: ${f.title}
- **ID:** ${f.id}
- **Category:** ${f.category}
- **Severity:** ${f.severity}
- **Confidence:** ${f.confidence}
- **File:** ${f.filePath}${f.lineStart ? `:${f.lineStart}` : ""}${f.lineEnd ? `-${f.lineEnd}` : ""}
- **Agent:** ${f.agentId}

**Description:**
${f.description}

**Evidence:**
${f.evidence || "None provided"}

**Suggested Fix:**
${f.suggestedFix || "None provided"}
`).join("\n---\n");

  const initialMessage = `You have received ${findings.length} validated finding(s) from the code review. Your task is to explain each one clearly for developers and stakeholders.

Here are the findings:

${findingsContext}

For EACH finding, you must:
1. Read the relevant code file(s) to understand the full context
2. Search for related patterns in the codebase if helpful
3. Optionally search the web for best practices or CVE information
4. Call emit_explanation with a complete, helpful explanation

Start with Finding 1 and work through all of them. Use your tools to gather context before explaining.`;

  // Tool handler
  async function handleToolCall(
    name: string,
    input: Record<string, unknown>
  ): Promise<string> {
    callbacks.onToolCall?.(name, input);

    switch (name) {
      case "crp_repo_file": {
        try {
          const result = await repoFile({
            path: input.path as string,
            startLine: input.startLine as number | undefined,
            endLine: input.endLine as number | undefined,
          });
          return JSON.stringify(result);
        } catch (err: any) {
          return JSON.stringify({ error: err.message });
        }
      }

      case "crp_repo_search": {
        try {
          const result = await repoSearch({
            pattern: input.pattern as string,
            glob: input.glob as string | undefined,
            maxResults: input.maxResults as number | undefined,
          });
          return JSON.stringify(result);
        } catch (err: any) {
          return JSON.stringify({ error: err.message });
        }
      }

      case "crp_web_search": {
        try {
          const result = await webSearch({ query: input.query as string });
          return JSON.stringify(result);
        } catch (err: any) {
          return JSON.stringify({ error: err.message });
        }
      }

      case "emit_explanation": {
        const explanation: Explanation = {
          findingId: input.findingId as string,
          summary: input.summary as string,
          whyItMatters: {
            impact: input.impact as "Critical" | "High" | "Medium" | "Low",
            explanation: input.whyItMatters as string,
            scenario: input.scenario as string | undefined,
          },
          howToFix: {
            effort: input.effort as "Quick fix" | "Half-day" | "Multi-day refactor",
            steps: input.steps as string[],
          },
          codeExample: input.codeBefore ? {
            before: input.codeBefore as string,
            after: input.codeAfter as string || "",
            explanation: input.codeExplanation as string || "",
          } : undefined,
          resources: (input.resources as Explanation["resources"]) || [],
        };

        explanations.push(explanation);
        callbacks.onExplanation(explanation);

        // Emit audit event
        callbacks.onEvent({
          id: `event-${Date.now()}`,
          type: "finding_explained",
          agent: "explainer",
          timestamp: new Date().toISOString(),
          data: { findingId: explanation.findingId, summary: explanation.summary },
        });

        return JSON.stringify({ 
          success: true, 
          message: `Explanation recorded for finding ${explanation.findingId}` 
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  }

  // Emit start event
  callbacks.onEvent({
    id: `event-${Date.now()}`,
    type: "agent_started",
    agent: "explainer",
    timestamp: new Date().toISOString(),
    data: { findingCount: findings.length },
  });

  // Run the agent loop
  await runAgentLoop({
    systemPrompt: SYSTEM_PROMPT,
    initialMessage,
    tools: TOOLS,
    handleToolCall,
    onThinking: callbacks.onThinking,
    maxIterations: findings.length * 5 + 10, // Allow enough iterations for all findings
    signal,
    // Use claude-haiku-4-5 for fast, cost-effective explanations
    model: "claude-haiku-4-5-20251001",
  });

  // Emit completion event
  callbacks.onEvent({
    id: `event-${Date.now()}`,
    type: "agent_completed",
    agent: "explainer",
    timestamp: new Date().toISOString(),
    data: { explanationCount: explanations.length },
  });

  return explanations;
}
