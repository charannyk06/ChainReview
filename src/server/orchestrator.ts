import { repoOpen, repoTree } from "./tools/repo";
import { codeImportGraph, codePatternScan } from "./tools/code";
import { repoDiff } from "./tools/repo";
import { runArchitectureAgent } from "./agents/architecture";
import { runSecurityAgent } from "./agents/security";
import { runValidatorChallenge } from "./agents/validator";
import { runExplainerAgent, type Explanation } from "./agents/explainer";
import { runBugsAgent } from "./agents/bugs";
import type {
  Store,
} from "./store";
import type {
  ReviewMode,
  AgentContext,
  AgentFinding,
  Finding,
  AuditEvent,
  ReviewCallbacks,
} from "./types";

export interface ReviewResult {
  runId: string;
  explanations?: Explanation[];
  findings: Finding[];
  events: AuditEvent[];
  status: "complete" | "error";
  error?: string;
}

/** Global abort controller for the active review — allows cancellation from MCP handler */
let activeReviewAbort: AbortController | null = null;

/** Cancel the currently running review (if any). Called from the MCP handler. */
export function cancelActiveReview(): void {
  if (activeReviewAbort) {
    activeReviewAbort.abort();
    activeReviewAbort = null;
  }
}

export interface ReviewOptions {
  /** Which agents to run. If empty/undefined, runs all agents. */
  agents?: ("security" | "architecture" | "bugs")[];
  /** Target path to focus on (e.g., "src/auth/") */
  targetPath?: string;
}

export async function runReview(
  repoPath: string,
  mode: ReviewMode,
  store: Store,
  callbacks: ReviewCallbacks,
  options?: ReviewOptions
): Promise<ReviewResult> {
  // Create abort controller for this review run
  const abortController = new AbortController();
  activeReviewAbort = abortController;
  const signal = abortController.signal;

  const runId = store.createRun(repoPath, mode);

  function emitEvent(
    type: AuditEvent["type"],
    agent: AuditEvent["agent"],
    data: Record<string, unknown>
  ): void {
    const eventId = store.insertEvent(runId, type, agent, data);
    callbacks.onEvent({
      id: eventId,
      type,
      agent,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  try {
    // ── Step 1: Open repository ──
    emitEvent("evidence_collected", undefined, {
      kind: "pipeline_step",
      step: "repo_open",
      message: "Opening repository...",
    });
    await repoOpen({ repoPath });

    // ── Step 2: Get file tree ──
    emitEvent("evidence_collected", undefined, {
      kind: "pipeline_step",
      step: "file_tree",
      message: "Building file tree...",
    });
    const tree = await repoTree({});
    const fileTree = tree.files;

    // ── Step 3: Extract import graph ──
    emitEvent("evidence_collected", undefined, {
      kind: "pipeline_step",
      step: "import_graph",
      message: "Extracting import graph...",
    });
    let importGraph;
    try {
      importGraph = await codeImportGraph({});
    } catch (err: any) {
      emitEvent("evidence_collected", undefined, {
        kind: "pipeline_step",
        step: "import_graph",
        warning: `Import graph extraction failed: ${err.message}`,
      });
    }

    // ── Step 4: Run Semgrep scan (non-blocking, 30s timeout with proper kill) ──
    emitEvent("evidence_collected", undefined, {
      kind: "pipeline_step",
      step: "pattern_scan",
      message: "Running Semgrep scan (30s timeout)...",
    });
    let semgrepResults;
    try {
      const SEMGREP_TIMEOUT = 30_000;
      // Use an AbortController to properly kill the Semgrep child process on timeout
      const semgrepAbort = new AbortController();
      const semgrepTimer = setTimeout(() => semgrepAbort.abort(), SEMGREP_TIMEOUT);

      let scanResult: { results: any[]; totalResults: number; warning?: string };
      try {
        scanResult = await codePatternScan({ signal: semgrepAbort.signal });
      } catch (err: any) {
        if (semgrepAbort.signal.aborted) {
          scanResult = {
            results: [],
            totalResults: 0,
            warning: "Semgrep timed out (30s) — child process killed. Agents can run pattern scans on-demand.",
          };
        } else {
          throw err;
        }
      } finally {
        clearTimeout(semgrepTimer);
      }

      semgrepResults = scanResult.results;
      if (scanResult.warning) {
        emitEvent("evidence_collected", undefined, {
          kind: "pipeline_step",
          step: "pattern_scan",
          warning: scanResult.warning,
        });
      } else if (semgrepResults.length > 0) {
        emitEvent("evidence_collected", undefined, {
          kind: "pipeline_step",
          step: "pattern_scan",
          message: `Semgrep found ${semgrepResults.length} result(s)`,
        });
      }
    } catch (err: any) {
      emitEvent("evidence_collected", undefined, {
        kind: "pipeline_step",
        step: "pattern_scan",
        warning: `Semgrep scan failed: ${err.message}`,
      });
    }

    // ── Step 5: Get diff (if diff mode) ──
    let diffContent: string | undefined;
    if (mode === "diff") {
      emitEvent("evidence_collected", undefined, {
        kind: "pipeline_step",
        step: "diff",
        message: "Getting diff...",
      });
      try {
        const diffResult = await repoDiff({});
        diffContent = diffResult.diff;
      } catch (err: any) {
        emitEvent("evidence_collected", undefined, {
          kind: "pipeline_step",
          step: "diff",
          warning: `Diff extraction failed: ${err.message}`,
        });
      }
    }

    // Build agent context
    const context: AgentContext = {
      repoPath,
      mode,
      runId,
      fileTree,
      importGraph,
      semgrepResults,
      diffContent,
    };

    const allFindings: Finding[] = [];

    // ── Shared agent callback factory ──
    const agentCallbacks = (agentName: "architecture" | "security" | "validator") => ({
      onText: (text: string) => {
        // Strip the raw <findings> JSON block from displayed text — that data
        // is already captured as structured findings and shown in the Findings
        // tab.  Showing raw JSON inside the collapsible agent card is noisy.
        let displayText = text
          .replace(/<findings>[\s\S]*?<\/findings>/g, "")
          .trim();
        if (!displayText || displayText.length < 5) return; // skip empty leftovers
        emitEvent("evidence_collected", agentName, {
          kind: "agent_text",
          text: displayText.slice(0, 4000),
        });
      },
      onThinking: (text: string) => {
        // Stream thinking with generous limit for meaningful context
        emitEvent("evidence_collected", agentName, {
          kind: "agent_thinking",
          text: text.slice(0, 4000),
        });
      },
      onEvent: (event: Omit<AuditEvent, "id" | "timestamp">) => {
        emitEvent(event.type, event.agent, event.data);
      },
      onToolCall: (tool: string, args: Record<string, unknown>) => {
        emitEvent("evidence_collected", agentName, {
          kind: "tool_call_start",
          tool,
          args,
        });
      },
      onToolResult: (tool: string, result: string) => {
        emitEvent("evidence_collected", agentName, {
          kind: "tool_call_end",
          tool,
          resultSummary: result.slice(0, 500),
        });
      },
    });

    // Helper to store+emit findings for an agent
    function processFindings(
      agentFindings: AgentFinding[],
      agentName: "architecture" | "security" | "validator"
    ) {
      for (const af of agentFindings) {
        const findingId = store.insertFinding(runId, {
          ...af,
          agent: agentName,
          category: af.category || agentName,
          evidence: af.evidence || [],
        });
        const finding: Finding = {
          id: findingId,
          ...af,
          agent: agentName,
          category: af.category || agentName,
          evidence: af.evidence || [],
        };
        allFindings.push(finding);
        callbacks.onFinding(finding);
        emitEvent("finding_emitted", agentName, {
          kind: "finding",
          findingId,
          title: af.title,
          severity: af.severity,
          confidence: af.confidence,
        });
      }
    }

    // ── Step 6: Run Architecture + Security Agents IN PARALLEL ──
    // Both agents start simultaneously and stream their tool calls independently.
    // Each agent makes as many tool calls as it needs — no artificial limits.
    emitEvent("agent_started", "architecture", {
      kind: "agent_lifecycle",
      message: "Architecture Agent starting review...",
    });
    emitEvent("agent_started", "security", {
      kind: "agent_lifecycle",
      message: "Security Agent starting review...",
    });

    // Check for cancellation before starting agents
    if (signal.aborted) {
      store.completeRun(runId, "error");
      activeReviewAbort = null;
      return {
        runId,
        findings: [],
        events: store.getEvents(runId),
        status: "error",
        error: "Review cancelled by user",
      };
    }

    // Determine which agents to run
    const agentsToRun = options?.agents ?? ["architecture", "security", "bugs"];
    const targetPath = options?.targetPath;

    // Build agent execution promises based on selection
    const agentPromises: Promise<any>[] = [];
    const agentNames: string[] = [];

    if (agentsToRun.includes("architecture")) {
      agentNames.push("architecture");
      agentPromises.push(runArchitectureAgent(context, agentCallbacks("architecture"), signal));
    }
    if (agentsToRun.includes("security")) {
      agentNames.push("security");
      agentPromises.push(runSecurityAgent(context, agentCallbacks("security"), signal));
    }
    if (agentsToRun.includes("bugs")) {
      agentNames.push("bugs");
      agentPromises.push(runBugsAgent(targetPath, runId, {
        onEvent: callbacks.onEvent,
        onFinding: (finding) => {
          const f: Finding = {
            id: finding.id,
            agentId: "bugs",
            category: "bugs",
            title: finding.title,
            description: finding.description,
            filePath: finding.filePath,
            lineStart: finding.lineStart,
            lineEnd: finding.lineEnd,
            severity: finding.severity,
            confidence: finding.confidence,
            evidence: finding.evidence,
            suggestedFix: finding.suggestedFix,
            status: "pending",
          };
          allFindings.push(f);
          store.insertFinding(runId, f);
          emitEvent("finding_emitted", "bugs", {
            findingId: f.id,
            title: f.title,
            severity: f.severity,
          });
        },
        onThinking: (text) => callbacks.onText("bugs", text, false),
        onToolCall: (name, input) => callbacks.onToolCall("bugs", name, input as Record<string, unknown>),
      }, signal));
    }

    emitEvent("agent_started", undefined, {
      kind: "pipeline_step",
      message: `Running ${agentNames.length} agent(s): ${agentNames.join(", ")}${targetPath ? ` on ${targetPath}` : ""}`,
    });

    const results = await Promise.allSettled(agentPromises);

    // Process results
    results.forEach((result, index) => {
      const agentName = agentNames[index];
      if (result.status === "fulfilled") {
        emitEvent("evidence_collected", agentName as any, {
          kind: "agent_lifecycle",
          event: "completed",
          message: `${agentName.charAt(0).toUpperCase() + agentName.slice(1)} Agent completed`,
        });
        // For architecture and security, process findings
        if (agentName !== "bugs" && result.value) {
          processFindings(result.value, agentName as any);
        }
      } else {
        emitEvent("evidence_collected", agentName as any, {
          kind: "agent_lifecycle",
          event: "error",
          error: `${agentName} agent failed: ${result.reason?.message || result.reason}`,
        });
      }
    });

    // ── Step 7: Validator Agent — Challenge + Verify Findings ──
    // The validator independently investigates each finding, reading code,
    // searching for mitigations, and adjusting confidence/severity.
    // The UI "Verify" button triggers per-finding RE-validation on demand.
    if (allFindings.length > 0 && !signal.aborted) {
      emitEvent("agent_started", "validator", {
        kind: "agent_lifecycle",
        message: `Validator Agent challenging ${allFindings.length} finding(s)...`,
      });

      try {
        const validatorResult = await runValidatorChallenge(
          allFindings,
          repoPath,
          agentCallbacks("validator"),
          signal
        );

        emitEvent("evidence_collected", "validator", {
          kind: "agent_lifecycle",
          event: "completed",
          message: `Validator completed — reviewed ${allFindings.length} finding(s), produced ${validatorResult.length} validated finding(s)`,
        });

        // If validator produces refined findings, store them as validator findings
        if (validatorResult.length > 0) {
          processFindings(validatorResult, "validator");
        }
      } catch (err: any) {
        if (!signal.aborted) {
          emitEvent("evidence_collected", "validator", {
            kind: "agent_lifecycle",
            event: "error",
            error: `Validator agent failed: ${err.message}`,
          });
        }
      }
    }

    // ── Step 8: Explainer Agent — Generate Human-Readable Explanations ──
    // The explainer transforms technical findings into clear, actionable
    // explanations for developers and stakeholders.
    let explanations: Explanation[] = [];
    if (allFindings.length > 0 && !signal.aborted) {
      emitEvent("agent_started", "explainer", {
        kind: "agent_lifecycle",
        message: `Explainer Agent generating explanations for ${allFindings.length} finding(s)...`,
      });

      try {
        explanations = await runExplainerAgent(
          allFindings,
          runId,
          {
            onEvent: (event) => callbacks.onEvent(event),
            onExplanation: (explanation) => {
              emitEvent("finding_explained", "explainer", {
                findingId: explanation.findingId,
                summary: explanation.summary,
                impact: explanation.whyItMatters.impact,
              });
            },
            onThinking: (text) => {
              callbacks.onText("explainer", text, false);
            },
            onToolCall: (name, input) => {
              callbacks.onToolCall("explainer", name, input as Record<string, unknown>);
            },
          },
          signal
        );

        emitEvent("agent_completed", "explainer", {
          kind: "agent_lifecycle",
          message: `Explainer completed — generated ${explanations.length} explanation(s)`,
        });
      } catch (err: any) {
        if (!signal.aborted) {
          emitEvent("evidence_collected", "explainer", {
            kind: "agent_lifecycle",
            event: "error",
            error: `Explainer agent failed: ${err.message}`,
          });
        }
      }
    }

    // ── Complete ──
    activeReviewAbort = null;
    store.completeRun(runId, "complete");
    const events = store.getEvents(runId);

    return {
      runId,
      findings: allFindings,
      explanations,
      events,
      status: "complete",
    };
  } catch (err: any) {
    activeReviewAbort = null;

    // Check if this was a cancellation
    if (signal.aborted) {
      store.completeRun(runId, "error");
      return {
        runId,
        findings: allFindings.length > 0 ? allFindings : [],
        events: store.getEvents(runId),
        status: "error",
        error: "Review cancelled by user",
      };
    }

    // Log error to stderr so the extension can see it
    console.error(`ChainReview: Review failed: ${err.message}`);
    if (err.stack) console.error(err.stack);

    store.completeRun(runId, "error");
    return {
      runId,
      findings: allFindings.length > 0 ? allFindings : [],
      events: store.getEvents(runId),
      status: "error",
      error: err.message,
    };
  }
}
