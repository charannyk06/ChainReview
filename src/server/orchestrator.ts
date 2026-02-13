import { repoOpen, repoTree } from "./tools/repo";
import { codeImportGraph, codePatternScan } from "./tools/code";
import { repoDiff } from "./tools/repo";
import { runArchitectureAgent } from "./agents/architecture";
import { runSecurityAgent } from "./agents/security";
import { runValidatorChallenge } from "./agents/validator";
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

export async function runReview(
  repoPath: string,
  mode: ReviewMode,
  store: Store,
  callbacks: ReviewCallbacks
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

    // ── Step 4: Run Semgrep scan (non-blocking, 30s timeout) ──
    emitEvent("evidence_collected", undefined, {
      kind: "pipeline_step",
      step: "pattern_scan",
      message: "Running Semgrep scan (30s timeout)...",
    });
    let semgrepResults;
    try {
      const SEMGREP_TIMEOUT = 30_000;
      const scanResult = await Promise.race([
        codePatternScan({}),
        new Promise<{ results: never[]; totalResults: number; warning: string }>((resolve) =>
          setTimeout(() => resolve({
            results: [],
            totalResults: 0,
            warning: "Semgrep timed out (30s) — agents can run pattern scans on-demand",
          }), SEMGREP_TIMEOUT)
        ),
      ]);
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
        emitEvent("evidence_collected", agentName, {
          kind: "agent_text",
          text: text.slice(0, 500),
        });
      },
      onThinking: (text: string) => {
        emitEvent("evidence_collected", agentName, {
          kind: "agent_thinking",
          text: text.slice(0, 1000),
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
          resultSummary: result.slice(0, 200),
        });
      },
    });

    // Helper to store+emit findings for an agent
    function processFindings(
      agentFindings: AgentFinding[],
      agentName: "architecture" | "security"
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

    const [archResult, secResult] = await Promise.allSettled([
      runArchitectureAgent(context, agentCallbacks("architecture"), signal),
      runSecurityAgent(context, agentCallbacks("security"), signal),
    ]);

    // Process Architecture results
    if (archResult.status === "fulfilled") {
      emitEvent("evidence_collected", "architecture", {
        kind: "agent_lifecycle",
        event: "completed",
        message: "Architecture Agent completed",
      });
      processFindings(archResult.value, "architecture");
    } else {
      emitEvent("evidence_collected", "architecture", {
        kind: "agent_lifecycle",
        event: "error",
        error: `Architecture agent failed: ${archResult.reason?.message || archResult.reason}`,
      });
    }

    // Process Security results
    if (secResult.status === "fulfilled") {
      emitEvent("evidence_collected", "security", {
        kind: "agent_lifecycle",
        event: "completed",
        message: "Security Agent completed",
      });
      processFindings(secResult.value, "security");
    } else {
      emitEvent("evidence_collected", "security", {
        kind: "agent_lifecycle",
        event: "error",
        error: `Security agent failed: ${secResult.reason?.message || secResult.reason}`,
      });
    }

    // Check for cancellation before validator
    if (signal.aborted) {
      activeReviewAbort = null;
      store.completeRun(runId, "error");
      return {
        runId,
        findings: allFindings,
        events: store.getEvents(runId),
        status: "error",
        error: "Review cancelled by user",
      };
    }

    // ── Step 7: Run Validator Agent (challenge mode) ──
    if (allFindings.length > 0) {
      emitEvent("agent_started", "validator", {
        kind: "agent_lifecycle",
        message: "Validator Agent challenging findings...",
      });

      try {
        const validatedFindings = await runValidatorChallenge(
          allFindings,
          repoPath,
          agentCallbacks("validator"),
          signal
        );
        emitEvent("evidence_collected", "validator", {
          kind: "agent_lifecycle",
          event: "completed",
          message: "Validator Agent completed",
        });

        // Update findings with validated confidence scores
        for (const vf of validatedFindings) {
          const original = allFindings.find(
            (f) => f.title === vf.title || f.description === vf.description
          );
          if (original && vf.confidence !== original.confidence) {
            emitEvent("patch_validated", "validator", {
              findingId: original.id,
              originalConfidence: original.confidence,
              validatedConfidence: vf.confidence,
              title: vf.title,
            });
          }
        }
      } catch (err: any) {
        emitEvent("evidence_collected", "validator", {
          kind: "agent_lifecycle",
          event: "error",
          error: `Validator agent failed: ${err.message}`,
        });
      }
    }

    // ── Complete ──
    activeReviewAbort = null;
    store.completeRun(runId, "complete");
    const events = store.getEvents(runId);

    return {
      runId,
      findings: allFindings,
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
