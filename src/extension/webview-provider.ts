import * as vscode from "vscode";
import type { CrpClient } from "./mcp-client";
import type { Finding, AuditEvent } from "./types";

// Tool display info for block reconstruction
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  "crp_repo_file": "Read File",
  "crp_repo_tree": "File Tree",
  "crp_repo_search": "Search Code",
  "crp_repo_diff": "Git Diff",
  "crp_repo_open": "Open Repository",
  "crp_code_import_graph": "Import Graph",
  "crp_code_pattern_scan": "Pattern Scan",
  "crp_patch_propose": "Propose Patch",
  "crp_patch_validate": "Validate Patch",
  "crp_exec_command": "Run Command",
  "crp_web_search": "Web Search",
  "crp_patch_generate": "Generate Fix",
  "crp_review_validate_finding": "Validate Finding",
  "crp_spawn_review": "Spawn Review Agents",
};

const TOOL_ICON_MAP: Record<string, string> = {
  "crp_repo_file": "file",
  "crp_repo_tree": "tree",
  "crp_repo_search": "search",
  "crp_repo_diff": "git-diff",
  "crp_repo_open": "terminal",
  "crp_code_import_graph": "graph",
  "crp_code_pattern_scan": "scan",
  "crp_patch_propose": "brain",
  "crp_patch_validate": "check",
  "crp_exec_command": "terminal",
  "crp_web_search": "web",
  "crp_patch_generate": "brain",
  "crp_review_validate_finding": "shield",
  "crp_spawn_review": "brain",
};

function summarizeArgs(tool: string, args: Record<string, unknown>): string {
  switch (tool) {
    case "crp_repo_file": {
      const p = args.path as string || "";
      const s = args.startLine as number | undefined;
      const e = args.endLine as number | undefined;
      return s && e ? `${p} (L${s}-${e})` : p;
    }
    case "crp_repo_search":
      return `"${args.pattern || ""}"`;
    case "crp_repo_tree":
      return args.pattern ? `pattern: ${args.pattern}` : "full tree";
    case "crp_code_import_graph":
      return (args.path as string) || "entire repo";
    case "crp_exec_command":
      return (args.command as string)?.slice(0, 50) || "";
    case "crp_web_search":
      return `"${(args.query as string)?.slice(0, 40) || ""}"`;
    default:
      return "";
  }
}

export class ReviewCockpitProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "chainreview.reviewCockpit";

  private _view?: vscode.WebviewView;
  private _currentRunId?: string;
  private _findings: Finding[] = [];
  private _validationVerdicts: Record<string, { verdict: string; reasoning: string }> = {};
  private _blockCounter = 0;
  /** Flag to suppress error messages when review was user-cancelled */
  private _reviewCancelled = false;
  /** Track running tool_call block IDs per-agent for parallel routing */
  private _lastRunningToolBlockIds: Record<string, string> = {};
  /** Legacy fallback for non-agent-tagged tool calls */
  private _lastRunningToolBlockId: string | null = null;

  // ── Chat streaming state ──
  /** Active chat message ID being streamed to */
  private _activeChatMessageId: string | null = null;
  /** Last running tool block for chat queries */
  private _chatLastRunningToolBlockId: string | null = null;
  /** Active text block being streamed to incrementally (delta-by-delta) */
  private _chatStreamingTextBlockId: string | null = null;
  private _chatStreamingTextAccum = "";
  /** Active thinking block being streamed to incrementally */
  private _chatStreamingThinkingBlockId: string | null = null;
  private _chatStreamingThinkingAccum = "";
  /** Active validate message ID */
  private _activeValidateMessageId: string | null = null;
  private _validateLastRunningToolBlockId: string | null = null;
  /** Active text block for validation streaming */
  private _validateStreamingTextBlockId: string | null = null;
  private _validateStreamingTextAccum = "";
  /** Active thinking block for validation streaming */
  private _validateStreamingThinkingBlockId: string | null = null;
  private _validateStreamingThinkingAccum = "";

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _crpClient?: CrpClient,
    private readonly _context?: vscode.ExtensionContext
  ) {
    // Register stream event handler for real-time updates
    if (this._crpClient) {
      this._crpClient.onStreamEvent((event) => {
        this._handleStreamEvent(event);
      });
    }

    // Load saved MCP server configurations
    this._loadMCPServersFromConfig();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      this._handleMessage(message).catch((err) => {
        console.error("ChainReview: message handler error:", err);
      });
    });

    // Persist chat messages when panel visibility changes (tab switch, panel hide)
    webviewView.onDidChangeVisibility(() => {
      if (!webviewView.visible) {
        // Panel is being hidden — request messages for persistence
        this.postMessage({ type: "requestPersistMessages" });
      } else {
        // Panel became visible again — restore state
        this._restorePersistedState();
      }
    });

    // Restore persisted state when webview first loads
    this._restorePersistedState();
  }

  public postMessage(message: unknown) {
    this._view?.webview.postMessage(message);
  }

  public triggerReview(mode: "repo" | "diff") {
    this._startReview(mode).catch((err) => {
      console.error("ChainReview: triggerReview error:", err);
    });
  }

  /** Safely extract a string from an untrusted message field */
  private _safeStr(value: unknown, maxLength = 500): string {
    if (typeof value !== "string") return "";
    // Strip control characters and limit length
    return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, maxLength);
  }

  /** Safely extract a string array from an untrusted message field */
  private _safeStrArray(value: unknown, maxItems = 10): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((v): v is string => typeof v === "string")
      .slice(0, maxItems)
      .map((s) => this._safeStr(s, 200));
  }

  private async _handleMessage(message: Record<string, unknown>) {
    switch (message.type) {
      case "startReview": {
        const mode = message.mode === "diff" ? "diff" : "repo";
        await this._startReview(mode, this._safeStr(message.path, 1000) || undefined);
        break;
      }
      case "chatQuery": {
        const agents = this._safeStrArray(message.agents);
        if (agents.length > 0) {
          // Agents mentioned — trigger a full review run with those agents
          await this._startReview("repo", this._safeStr(message.targetPath, 1000) || undefined, agents);
        } else {
          // No agents — plain chat Q&A
          const query = this._safeStr(message.query, 10000);
          if (query) await this._handleChatQuery(query);
        }
        break;
      }
      case "requestPatch":
        await this._requestPatch(this._safeStr(message.findingId, 100));
        break;
      case "applyPatch":
        await this._applyPatch(this._safeStr(message.patchId, 100));
        break;
      case "dismissPatch":
        await this._dismissPatch(this._safeStr(message.patchId, 100));
        break;
      case "markFalsePositive":
        await this._markFalsePositive(this._safeStr(message.findingId, 100));
        break;
      case "explainFinding":
        await this._explainFinding(this._safeStr(message.findingId, 100));
        break;
      case "sendToValidator":
        await this._sendToValidator(this._safeStr(message.findingId, 100));
        break;
      case "sendToCodingAgent":
        await this._sendToCodingAgent(this._safeStr(message.findingId, 100), this._safeStr(message.agentId, 50));
        break;
      case "cancelReview":
        this._cancelReview();
        break;
      case "openFile":
        this._openFile(
          this._safeStr(message.filePath, 1000),
          typeof message.line === "number" ? Math.max(0, Math.floor(message.line)) : undefined
        );
        break;
      // ── MCP Manager ──
      case "openMCPManager":
        this._openMCPManager();
        break;
      case "mcpGetServers":
        this._sendMCPServers();
        break;
      case "mcpAddServer":
        this._mcpAddServer(message.config as any);
        break;
      case "mcpUpdateServer":
        this._mcpUpdateServer(message.config as any);
        break;
      case "mcpRemoveServer":
        this._mcpRemoveServer(this._safeStr(message.serverId, 100));
        break;
      case "mcpToggleServer":
        this._mcpToggleServer(this._safeStr(message.serverId, 100), message.enabled === true);
        break;
      case "mcpRefreshServer":
        this._mcpRefreshServer(this._safeStr(message.serverId, 100));
        break;
      // ── Task History ──
      case "getReviewHistory":
        this._getReviewHistory();
        break;
      case "deleteReviewRun":
        this._deleteReviewRun(this._safeStr(message.runId, 100));
        break;
      case "loadReviewRun":
        await this._loadReviewRun(this._safeStr(message.runId, 100));
        break;
      case "clearChat":
        this._clearPersistedChat();
        break;
      case "persistMessages":
        this._persistChatMessages(message.messages as unknown[]);
        break;
    }
  }

  // ── Open File in Editor ──

  private async _openFile(filePath: string, line?: number) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceFolder) return;

      const path = await import("path");
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolder, filePath);

      const uri = vscode.Uri.file(fullPath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, {
        preview: true,
        preserveFocus: false,
      });

      if (line != null && line > 0) {
        const position = new vscode.Position(line - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      }
    } catch (err: any) {
      console.error("ChainReview: failed to open file:", err.message);
    }
  }

  // ── Cancel Review ──

  private _cancelReview() {
    // Set flag BEFORE aborting so _startReview catch block knows this was intentional
    this._reviewCancelled = true;

    if (this._crpClient) {
      this._crpClient.cancelReview().catch(() => {});
    }
    this._emitBlock({
      kind: "sub_agent_event",
      id: `sae-${++this._blockCounter}`,
      agent: "system",
      event: "error",
      message: "Review cancelled by user",
      timestamp: new Date().toISOString(),
    });
    this.postMessage({ type: "reviewCancelled" });
  }

  // ── Handle real-time stream events from server stderr ──

  private _handleStreamEvent(event: Record<string, unknown>) {
    const type = event.type as string;

    switch (type) {
      // ═══════════════════════════════════════════════════════
      // REVIEW FLOW EVENTS (from orchestrator agents)
      // ═══════════════════════════════════════════════════════
      case "event": {
        const auditEvent = event.event as AuditEvent;
        if (!auditEvent) break;

        // Stream every event to the Timeline tab in real-time
        this.postMessage({ type: "addEvent", event: auditEvent });

        const data = auditEvent.data as Record<string, unknown>;
        const kind = data?.kind as string | undefined;
        const eventAgent = auditEvent.agent as string | undefined;

        // Agent started
        if (auditEvent.type === "agent_started" && eventAgent) {
          this._emitBlock({
            kind: "sub_agent_event",
            id: `sae-${++this._blockCounter}`,
            agent: eventAgent,
            event: "started",
            message: data?.message as string || `${eventAgent} agent started`,
            timestamp: auditEvent.timestamp || new Date().toISOString(),
          }, eventAgent);
          break;
        }

        // Agent lifecycle: completed / error
        if (kind === "agent_lifecycle" && eventAgent) {
          const agentEvent = data?.event as string;
          if (agentEvent === "completed") {
            this._emitBlock({
              kind: "sub_agent_event",
              id: `sae-${++this._blockCounter}`,
              agent: eventAgent,
              event: "completed",
              timestamp: auditEvent.timestamp || new Date().toISOString(),
            }, eventAgent);
          } else if (agentEvent === "error") {
            this._emitBlock({
              kind: "sub_agent_event",
              id: `sae-${++this._blockCounter}`,
              agent: eventAgent,
              event: "error",
              message: data?.error as string,
              timestamp: auditEvent.timestamp || new Date().toISOString(),
            }, eventAgent);
          }
          break;
        }

        // Tool call events → ToolCallBlock (routed to correct agent)
        if (kind === "tool_call_start") {
          const tool = data?.tool as string;
          const args = (data?.args as Record<string, unknown>) || {};
          const blockId = `tc-${++this._blockCounter}`;
          if (eventAgent) {
            this._lastRunningToolBlockIds[eventAgent] = blockId;
          }
          this._lastRunningToolBlockId = blockId;
          this._emitBlock({
            kind: "tool_call",
            id: blockId,
            tool,
            displayName: TOOL_DISPLAY_NAMES[tool] || tool,
            icon: TOOL_ICON_MAP[tool] || "terminal",
            args,
            argsSummary: summarizeArgs(tool, args),
            status: "running",
            timestamp: auditEvent.timestamp || new Date().toISOString(),
          }, eventAgent);
          break;
        }

        // Tool call end → UPDATE the running block to "done"
        if (kind === "tool_call_end") {
          const runningId = eventAgent
            ? this._lastRunningToolBlockIds[eventAgent]
            : this._lastRunningToolBlockId;
          if (runningId) {
            const resultSummary = (data?.resultSummary as string)?.slice(0, 300) || "";
            this._updateBlock(runningId, {
              status: "done",
              result: resultSummary,
            });
            if (eventAgent) {
              delete this._lastRunningToolBlockIds[eventAgent];
            }
            this._lastRunningToolBlockId = null;
          }
          break;
        }

        // Agent text output (analysis, reasoning, findings text)
        if (kind === "agent_text") {
          const text = data?.text as string;
          if (text && text.trim().length > 0) {
            this._emitBlock({
              kind: "text",
              id: `atx-${++this._blockCounter}`,
              text,
              format: "markdown",
              timestamp: auditEvent.timestamp || new Date().toISOString(),
            }, eventAgent);
          }
          break;
        }

        // Agent thinking (extended thinking)
        if (kind === "agent_thinking") {
          const text = data?.text as string;
          if (text && text.trim().length > 10) {
            this._emitBlock({
              kind: "thinking",
              id: `th-${++this._blockCounter}`,
              text,
              collapsed: true,
              timestamp: auditEvent.timestamp || new Date().toISOString(),
            }, eventAgent);
          }
          break;
        }

        // Pipeline step progress — show status messages and warnings
        if (kind === "pipeline_step") {
          const warning = data?.warning as string;
          const message = data?.message as string;
          const step = data?.step as string;
          if (warning) {
            this._emitBlock({
              kind: "status",
              id: `ps-${++this._blockCounter}`,
              text: warning,
              level: "warning",
              step,
              timestamp: auditEvent.timestamp || new Date().toISOString(),
            }, eventAgent);
          } else if (message) {
            this._emitBlock({
              kind: "status",
              id: `ps-${++this._blockCounter}`,
              text: message,
              level: "info",
              step,
              timestamp: auditEvent.timestamp || new Date().toISOString(),
            }, eventAgent);
          }
          break;
        }

        break;
      }

      case "finding": {
        const finding = event.finding as Finding;
        if (finding) {
          this._findings.push(finding);
          this._emitBlock({
            kind: "finding_card",
            id: `fc-${++this._blockCounter}`,
            finding,
            timestamp: new Date().toISOString(),
          }, finding.agent);
          this.postMessage({ type: "finding", finding });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════
      // CHAT QUERY STREAMING EVENTS (real-time delta streaming)
      // ═══════════════════════════════════════════════════════

      // ── Text delta: arrives token-by-token for true real-time streaming ──
      case "chatTextDelta": {
        if (!this._activeChatMessageId) break;
        const delta = event.delta as string;
        if (!delta) break;

        // If we don't have a streaming text block yet, create one
        if (!this._chatStreamingTextBlockId) {
          const blockId = `ctx-${++this._blockCounter}`;
          this._chatStreamingTextBlockId = blockId;
          this._chatStreamingTextAccum = delta;
          this._chatTextBlockCount++;
          this.postMessage({
            type: "chatResponseBlock",
            messageId: this._activeChatMessageId,
            block: {
              kind: "text",
              id: blockId,
              text: delta,
              format: "markdown",
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          // Append delta to existing block via update
          this._chatStreamingTextAccum += delta;
          this._updateBlock(this._chatStreamingTextBlockId, {
            text: this._chatStreamingTextAccum,
          });
        }
        break;
      }

      // ── Thinking delta: arrives token-by-token ──
      case "chatThinkingDelta": {
        if (!this._activeChatMessageId) break;
        const delta = event.delta as string;
        if (!delta) break;

        if (!this._chatStreamingThinkingBlockId) {
          const blockId = `cth-${++this._blockCounter}`;
          this._chatStreamingThinkingBlockId = blockId;
          this._chatStreamingThinkingAccum = delta;
          this.postMessage({
            type: "chatResponseBlock",
            messageId: this._activeChatMessageId,
            block: {
              kind: "thinking",
              id: blockId,
              text: delta,
              collapsed: true,
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          this._chatStreamingThinkingAccum += delta;
          this._updateBlock(this._chatStreamingThinkingBlockId, {
            text: this._chatStreamingThinkingAccum,
          });
        }
        break;
      }

      // ── Complete block callbacks (finalize the streaming blocks) ──
      case "chatThinking": {
        // A complete thinking block arrived — finalize any streaming block
        if (this._chatStreamingThinkingBlockId) {
          // Block already exists from deltas, just reset tracking
          this._chatStreamingThinkingBlockId = null;
          this._chatStreamingThinkingAccum = "";
        } else if (this._activeChatMessageId) {
          // No delta events were received (fallback) — emit full block
          const text = event.text as string;
          if (text && text.trim().length > 10) {
            this.postMessage({
              type: "chatResponseBlock",
              messageId: this._activeChatMessageId,
              block: {
                kind: "thinking",
                id: `cth-${++this._blockCounter}`,
                text,
                collapsed: true,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
        break;
      }

      case "chatText": {
        // A complete text block arrived — finalize any streaming block
        if (this._chatStreamingTextBlockId) {
          // Block already exists from deltas, just reset tracking
          this._chatStreamingTextBlockId = null;
          this._chatStreamingTextAccum = "";
        } else if (this._activeChatMessageId) {
          // No delta events were received (fallback) — emit full block
          const text = event.text as string;
          if (text) {
            this._chatTextBlockCount++;
            this.postMessage({
              type: "chatResponseBlock",
              messageId: this._activeChatMessageId,
              block: {
                kind: "text",
                id: `ctx-${++this._blockCounter}`,
                text,
                format: "markdown",
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
        break;
      }

      case "chatToolCall": {
        if (!this._activeChatMessageId) break;
        // Reset any streaming text/thinking block when a tool call starts
        this._chatStreamingTextBlockId = null;
        this._chatStreamingTextAccum = "";
        this._chatStreamingThinkingBlockId = null;
        this._chatStreamingThinkingAccum = "";

        const tool = event.tool as string;
        const args = (event.args as Record<string, unknown>) || {};
        const blockId = `ctc-${++this._blockCounter}`;
        this._chatLastRunningToolBlockId = blockId;
        this.postMessage({
          type: "chatResponseBlock",
          messageId: this._activeChatMessageId,
          block: {
            kind: "tool_call",
            id: blockId,
            tool,
            displayName: TOOL_DISPLAY_NAMES[tool] || tool,
            icon: TOOL_ICON_MAP[tool] || "terminal",
            args,
            argsSummary: summarizeArgs(tool, args),
            status: "running",
            timestamp: new Date().toISOString(),
          },
        });
        break;
      }

      case "chatToolResult": {
        if (this._chatLastRunningToolBlockId) {
          const resultStr = (event.result as string)?.slice(0, 500) || "";
          this._updateBlock(this._chatLastRunningToolBlockId, {
            status: "done",
            result: resultStr,
          });
          this._chatLastRunningToolBlockId = null;
        }
        break;
      }

      // ═══════════════════════════════════════════════════════
      // VALIDATE FINDING STREAMING EVENTS (real-time delta streaming)
      // ═══════════════════════════════════════════════════════

      // ── Validate text delta: token-by-token ──
      case "validateTextDelta": {
        if (!this._activeValidateMessageId) break;
        const delta = event.delta as string;
        if (!delta) break;

        if (!this._validateStreamingTextBlockId) {
          const blockId = `vtx-${++this._blockCounter}`;
          this._validateStreamingTextBlockId = blockId;
          this._validateStreamingTextAccum = delta;
          this.postMessage({
            type: "chatResponseBlock",
            messageId: this._activeValidateMessageId,
            block: {
              kind: "text",
              id: blockId,
              text: delta,
              format: "markdown",
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          this._validateStreamingTextAccum += delta;
          this._updateBlock(this._validateStreamingTextBlockId, {
            text: this._validateStreamingTextAccum,
          });
        }
        break;
      }

      // ── Validate thinking delta: token-by-token ──
      case "validateThinkingDelta": {
        if (!this._activeValidateMessageId) break;
        const delta = event.delta as string;
        if (!delta) break;

        if (!this._validateStreamingThinkingBlockId) {
          const blockId = `vth-${++this._blockCounter}`;
          this._validateStreamingThinkingBlockId = blockId;
          this._validateStreamingThinkingAccum = delta;
          this.postMessage({
            type: "chatResponseBlock",
            messageId: this._activeValidateMessageId,
            block: {
              kind: "thinking",
              id: blockId,
              text: delta,
              collapsed: true,
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          this._validateStreamingThinkingAccum += delta;
          this._updateBlock(this._validateStreamingThinkingBlockId, {
            text: this._validateStreamingThinkingAccum,
          });
        }
        break;
      }

      // ── Complete block callbacks (finalize) ──
      case "validateThinking": {
        if (this._validateStreamingThinkingBlockId) {
          this._validateStreamingThinkingBlockId = null;
          this._validateStreamingThinkingAccum = "";
        } else if (this._activeValidateMessageId) {
          const text = event.text as string;
          if (text && text.trim().length > 10) {
            this.postMessage({
              type: "chatResponseBlock",
              messageId: this._activeValidateMessageId,
              block: {
                kind: "thinking",
                id: `vth-${++this._blockCounter}`,
                text,
                collapsed: true,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
        break;
      }

      case "validateText": {
        if (this._validateStreamingTextBlockId) {
          this._validateStreamingTextBlockId = null;
          this._validateStreamingTextAccum = "";
        } else if (this._activeValidateMessageId) {
          const text = event.text as string;
          if (text) {
            this.postMessage({
              type: "chatResponseBlock",
              messageId: this._activeValidateMessageId,
              block: {
                kind: "text",
                id: `vtx-${++this._blockCounter}`,
                text,
                format: "markdown",
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
        break;
      }

      case "validateToolCall": {
        if (!this._activeValidateMessageId) break;
        // Reset streaming blocks when tool call starts
        this._validateStreamingTextBlockId = null;
        this._validateStreamingTextAccum = "";
        this._validateStreamingThinkingBlockId = null;
        this._validateStreamingThinkingAccum = "";

        const tool = event.tool as string;
        const args = (event.args as Record<string, unknown>) || {};
        const blockId = `vtc-${++this._blockCounter}`;
        this._validateLastRunningToolBlockId = blockId;
        this.postMessage({
          type: "chatResponseBlock",
          messageId: this._activeValidateMessageId,
          block: {
            kind: "tool_call",
            id: blockId,
            tool,
            displayName: TOOL_DISPLAY_NAMES[tool] || tool,
            icon: TOOL_ICON_MAP[tool] || "terminal",
            args,
            argsSummary: summarizeArgs(tool, args),
            status: "running",
            timestamp: new Date().toISOString(),
          },
        });
        break;
      }

      case "validateToolResult": {
        if (this._validateLastRunningToolBlockId) {
          const resultStr = (event.result as string)?.slice(0, 500) || "";
          this._updateBlock(this._validateLastRunningToolBlockId, {
            status: "done",
            result: resultStr,
          });
          this._validateLastRunningToolBlockId = null;
        }
        break;
      }

      // ═══════════════════════════════════════════════════════
      // CHAT-SPAWNED REVIEW (AI decided to launch sub-agents)
      // ═══════════════════════════════════════════════════════
      case "chatSpawnedReview": {
        const runId = event.runId as string;
        const findingsCount = event.findingsCount as number;
        const agents = event.agents as string[];

        if (runId) {
          this._currentRunId = runId;
        }

        // Transition UI to "running" mode so findings tab, timeline, etc. appear
        // The review is already complete by the time this event arrives, so
        // immediately transition to complete
        this.postMessage({ type: "reviewStarted", mode: "repo" as const });
        this.postMessage({
          type: "reviewComplete",
          findings: this._findings,
          events: [],
        });

        break;
      }

      // ═══════════════════════════════════════════════════════
      // LEGACY: Direct toolCall/toolResult (non-agent-tagged)
      // ═══════════════════════════════════════════════════════
      case "toolCall": {
        const tool = event.tool as string;
        const args = (event.args as Record<string, unknown>) || {};
        const blockId = `tc-${++this._blockCounter}`;
        this._lastRunningToolBlockId = blockId;
        this._emitBlock({
          kind: "tool_call",
          id: blockId,
          tool,
          displayName: TOOL_DISPLAY_NAMES[tool] || tool,
          icon: TOOL_ICON_MAP[tool] || "terminal",
          args,
          argsSummary: summarizeArgs(tool, args),
          status: "running",
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case "toolResult": {
        if (this._lastRunningToolBlockId) {
          const resultStr = (event.result as string)?.slice(0, 500) || "";
          this._updateBlock(this._lastRunningToolBlockId, {
            status: "done",
            result: resultStr,
          });
          this._lastRunningToolBlockId = null;
        }
        break;
      }
    }
  }

  // ── Review Flow (with real-time streaming) ──

  private async _startReview(mode: "repo" | "diff", path?: string, agents?: string[]) {
    if (!this._crpClient?.isConnected()) {
      this.postMessage({ type: "reviewError", error: "CRP server is not connected. Check that your Anthropic API key is set in Settings (chainreview.anthropicApiKey) and restart VS Code." });
      return;
    }

    const repoPath = path || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!repoPath) {
      this.postMessage({ type: "reviewError", error: "No workspace folder open. Open a repository first." });
      return;
    }

    this._blockCounter = 0;
    this._findings = [];
    this._lastRunningToolBlockId = null;
    this._lastRunningToolBlockIds = {};
    this._reviewCancelled = false;

    this.postMessage({ type: "reviewStarted", mode });

    this._emitBlock({
      kind: "sub_agent_event",
      id: `sae-${++this._blockCounter}`,
      agent: "system",
      event: "started",
      message: `Starting ${mode} review of ${repoPath.split("/").pop()}...`,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await this._crpClient.runReview(repoPath, mode, agents);
      this._currentRunId = result.runId;

      if (result.findings.length > 0) {
        this._findings = result.findings;
      }

      if (result.status === "error") {
        this.postMessage({ type: "reviewError", error: result.error || "Review failed with unknown error" });
        return;
      }

      this._emitBlock({
        kind: "sub_agent_event",
        id: `sae-${++this._blockCounter}`,
        agent: "system",
        event: "completed",
        message: `Review complete — ${this._findings.length} findings`,
        timestamp: new Date().toISOString(),
      });

      // ── Generate detailed final report ──
      // Emit as its own standalone chat message so it appears AFTER all agent
      // cards (which are already complete and auto-collapsed by now).
      const summaryMessageId = `summary-${Date.now()}`;
      this.postMessage({ type: "chatResponseStart", messageId: summaryMessageId });
      this._emitFinalReport(this._findings, summaryMessageId);
      this.postMessage({ type: "chatResponseEnd", messageId: summaryMessageId });

      this.postMessage({ type: "reviewComplete", findings: result.findings, events: result.events });

      // Persist review state after completion
      this._persistReviewState({
        findings: this._findings,
        events: result.events || [],
        status: "complete",
        mode: mode,
        runId: this._currentRunId,
      });
      // Persist chat messages
      this.postMessage({ type: "requestPersistMessages" });
    } catch (err: any) {
      // Don't show error if user intentionally cancelled — _cancelReview already sent reviewCancelled
      if (this._reviewCancelled) {
        this._reviewCancelled = false;
        return;
      }
      this.postMessage({ type: "reviewError", error: `Review failed: ${err.message}` });
    }
  }

  private _emitBlock(block: Record<string, unknown>, agent?: string) {
    this.postMessage({ type: "addBlock", block, agent });
  }

  private _updateBlock(blockId: string, updates: Record<string, unknown>) {
    this.postMessage({ type: "updateBlock", blockId, updates });
  }

  // ── Executive Summary Generation ──
  // Produces a clear, human-readable overview AFTER all agent cards have
  // completed and auto-collapsed.  This is NOT a findings breakdown — the
  // Findings tab already provides that.  The summary explains the overall
  // health of the codebase in plain language so the user can immediately
  // grasp the situation.

  private _emitFinalReport(findings: Finding[], messageId?: string) {
    // Helper: emit block into a standalone chat message (if messageId provided)
    // or fall back to addBlock (legacy).
    const emit = (block: Record<string, unknown>) => {
      if (messageId) {
        this.postMessage({ type: "chatResponseBlock", messageId, block });
      } else {
        this._emitBlock(block);
      }
    };

    if (findings.length === 0) {
      emit({
        kind: "text",
        id: `summary-${++this._blockCounter}`,
        text: "## ✅ Review Complete\n\nNo issues were detected. The codebase looks healthy — no architecture, security, or bug concerns were found by the review agents.",
        format: "markdown",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // ── Categorize ──
    const bySeverity: Record<string, Finding[]> = { critical: [], high: [], medium: [], low: [], info: [] };
    const byCategory: Record<string, Finding[]> = {};

    for (const f of findings) {
      const sev = (f.severity || "info").toLowerCase();
      if (!bySeverity[sev]) bySeverity[sev] = [];
      bySeverity[sev].push(f);

      const cat = f.category || "general";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(f);
    }

    const criticalCount = bySeverity.critical?.length || 0;
    const highCount = bySeverity.high?.length || 0;
    const medCount = bySeverity.medium?.length || 0;
    const lowCount = bySeverity.low?.length || 0;
    const infoCount = bySeverity.info?.length || 0;

    // ── Determine overall health ──
    let healthLabel: string;
    let healthEmoji: string;
    if (criticalCount > 0) {
      healthEmoji = "🔴";
      healthLabel = "Needs Immediate Attention";
    } else if (highCount > 0) {
      healthEmoji = "🟠";
      healthLabel = "Significant Issues Found";
    } else if (medCount > 0) {
      healthEmoji = "🟡";
      healthLabel = "Moderate Concerns";
    } else {
      healthEmoji = "🟢";
      healthLabel = "Generally Healthy";
    }

    const lines: string[] = [];

    // ── Header ──
    lines.push(`## ${healthEmoji} Executive Summary`);
    lines.push("");
    lines.push(`**Overall Assessment: ${healthLabel}**`);
    lines.push("");

    // ── One-liner overview ──
    const parts: string[] = [];
    if (criticalCount > 0) parts.push(`${criticalCount} critical`);
    if (highCount > 0) parts.push(`${highCount} high`);
    if (medCount > 0) parts.push(`${medCount} medium`);
    if (lowCount > 0) parts.push(`${lowCount} low`);
    if (infoCount > 0) parts.push(`${infoCount} informational`);
    lines.push(`The review identified **${findings.length} finding${findings.length !== 1 ? "s" : ""}** across the codebase — ${parts.join(", ")}.`);
    lines.push("");

    // ── Category-level plain-English summaries ──
    const archFindings = byCategory["architecture"] || [];
    const secFindings = byCategory["security"] || [];
    const bugFindings = byCategory["bugs"] || [];

    if (archFindings.length > 0 || secFindings.length > 0 || bugFindings.length > 0) {
      lines.push("---");
      lines.push("");
    }

    if (archFindings.length > 0) {
      const archCritHigh = archFindings.filter(f => f.severity === "critical" || f.severity === "high").length;
      lines.push(`### 🏛 Architecture — ${archFindings.length} finding${archFindings.length !== 1 ? "s" : ""}`);
      lines.push("");
      if (archCritHigh > 0) {
        lines.push(`The architecture agent found **${archCritHigh} serious concern${archCritHigh !== 1 ? "s" : ""}** that could affect maintainability and scalability. Key areas include:`);
      } else {
        lines.push("The architecture agent found some areas that could be improved:");
      }
      lines.push("");
      // List just the titles — keep it scannable, no code
      for (const f of archFindings.slice(0, 8)) {
        const sevIcon = f.severity === "critical" ? "🔴" : f.severity === "high" ? "🟠" : f.severity === "medium" ? "🟡" : "🔵";
        lines.push(`- ${sevIcon} **${f.title}** — ${f.description.split(/[.\n]/)[0].trim()}`);
      }
      if (archFindings.length > 8) {
        lines.push(`- *...and ${archFindings.length - 8} more*`);
      }
      lines.push("");
    }

    if (secFindings.length > 0) {
      const secCritHigh = secFindings.filter(f => f.severity === "critical" || f.severity === "high").length;
      lines.push(`### 🔒 Security — ${secFindings.length} finding${secFindings.length !== 1 ? "s" : ""}`);
      lines.push("");
      if (secCritHigh > 0) {
        lines.push(`The security agent identified **${secCritHigh} high-priority vulnerability${secCritHigh !== 1 ? "ies" : "y"}** that should be addressed before deployment:`);
      } else {
        lines.push("The security agent identified some areas to harden:");
      }
      lines.push("");
      for (const f of secFindings.slice(0, 8)) {
        const sevIcon = f.severity === "critical" ? "🔴" : f.severity === "high" ? "🟠" : f.severity === "medium" ? "🟡" : "🔵";
        lines.push(`- ${sevIcon} **${f.title}** — ${f.description.split(/[.\n]/)[0].trim()}`);
      }
      if (secFindings.length > 8) {
        lines.push(`- *...and ${secFindings.length - 8} more*`);
      }
      lines.push("");
    }

    if (bugFindings.length > 0) {
      lines.push(`### 🐛 Bugs — ${bugFindings.length} finding${bugFindings.length !== 1 ? "s" : ""}`);
      lines.push("");
      lines.push("Potential bugs and reliability issues were detected:");
      lines.push("");
      for (const f of bugFindings.slice(0, 8)) {
        const sevIcon = f.severity === "critical" ? "🔴" : f.severity === "high" ? "🟠" : f.severity === "medium" ? "🟡" : "🔵";
        lines.push(`- ${sevIcon} **${f.title}** — ${f.description.split(/[.\n]/)[0].trim()}`);
      }
      if (bugFindings.length > 8) {
        lines.push(`- *...and ${bugFindings.length - 8} more*`);
      }
      lines.push("");
    }

    // ── Recommended next steps ──
    lines.push("---");
    lines.push("");
    lines.push("### 💡 What to Do Next");
    lines.push("");

    let stepNum = 1;
    if (criticalCount > 0) {
      lines.push(`${stepNum}. **Fix critical issues first** — these represent the highest risk to your application`);
      stepNum++;
    }
    if (highCount > 0) {
      lines.push(`${stepNum}. **Address high-severity findings** — resolve these before merging or deploying`);
      stepNum++;
    }
    if (medCount > 0) {
      lines.push(`${stepNum}. **Review medium-severity items** — fix now or create tickets to track them`);
      stepNum++;
    }
    if (criticalCount === 0 && highCount === 0 && medCount === 0) {
      lines.push(`${stepNum}. **Low-risk findings only** — review at your discretion, no blockers detected`);
      stepNum++;
    }
    lines.push(`${stepNum}. Switch to the **Findings** tab for details on each issue`);
    stepNum++;
    lines.push(`${stepNum}. Use **Explain** on any finding for a deep-dive, or **Verify** to challenge it`);
    lines.push("");

    // Emit as a standalone text block — now routed through the messageId channel
    // so it appears as its own message AFTER all agent cards have completed.
    emit({
      kind: "text",
      id: `summary-${++this._blockCounter}`,
      text: lines.join("\n"),
      format: "markdown",
      timestamp: new Date().toISOString(),
    });
  }

  // ── Chat Query Flow (Real-time Streaming) ──
  //
  // The chat flow now works like this:
  // 1. Create a streaming assistant message (chatResponseStart)
  // 2. As the MCP call runs, stderr events fire: chatThinking, chatText, chatToolCall, chatToolResult
  // 3. These events push blocks to the webview INCREMENTALLY via chatResponseBlock
  // 4. When the MCP call completes, we flush stderr, inject fallback answer if needed,
  //    then mark the message complete (chatResponseEnd)
  //
  // IMPORTANT: There is a race condition between stderr (streaming events) and
  // stdout (MCP result). The MCP result may arrive before all stderr events have
  // been flushed. We handle this by:
  //   a) Waiting for stderr to flush after the MCP call completes
  //   b) Using the MCP result's `answer` field as a fallback if no text blocks were streamed
  //   c) Keeping _activeChatMessageId alive during the flush window

  /** Count of text blocks emitted during current chat query (for fallback detection) */
  private _chatTextBlockCount = 0;

  private async _handleChatQuery(query: string) {
    if (!this._crpClient?.isConnected()) {
      this.postMessage({ type: "reviewError", error: "CRP server is not connected. Check that your Anthropic API key is set in Settings (chainreview.anthropicApiKey) and restart VS Code." });
      return;
    }

    const messageId = `chat-${Date.now()}`;
    this._activeChatMessageId = messageId;
    this._chatLastRunningToolBlockId = null;
    this._chatStreamingTextBlockId = null;
    this._chatStreamingTextAccum = "";
    this._chatStreamingThinkingBlockId = null;
    this._chatStreamingThinkingAccum = "";
    this._chatTextBlockCount = 0;

    // Create the streaming assistant message
    this.postMessage({ type: "chatResponseStart", messageId });

    try {
      // The chatQuery MCP call blocks until complete, BUT during execution
      // the server streams events via stderr → _handleStreamEvent → chatThinking/chatText/chatToolCall/chatToolResult
      // which push blocks to the webview INCREMENTALLY.
      //
      // RACE CONDITION FIX: stderr events from the final LLM turn may still be
      // in transit when the MCP result arrives via stdout. We flush stderr by
      // waiting a few event-loop ticks before marking the message complete.
      const result = await this._crpClient.chatQuery(query, this._currentRunId);

      // ── Flush stderr: wait for any in-flight events to be processed ──
      // Node.js processes I/O callbacks in phases. Multiple ticks allow
      // buffered stderr chunks to be received and handled.
      await new Promise(resolve => setTimeout(resolve, 150));

      // ── Fallback: if no text blocks were streamed, inject the answer directly ──
      // This handles the case where stderr events were dropped or never arrived.
      if (this._chatTextBlockCount === 0 && result.answer && result.answer.trim()) {
        this.postMessage({
          type: "chatResponseBlock",
          messageId,
          block: {
            kind: "text",
            id: `ctx-${++this._blockCounter}`,
            text: result.answer,
            format: "markdown",
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Mark the message as complete
      this.postMessage({ type: "chatResponseEnd", messageId });

      // Persist chat messages after chat completes
      this.postMessage({ type: "requestPersistMessages" });
    } catch (err: any) {
      // Emit error block
      this.postMessage({
        type: "chatResponseBlock",
        messageId,
        block: {
          kind: "text",
          id: `ctx-${++this._blockCounter}`,
          text: `Error: ${err.message}`,
          format: "plain",
          timestamp: new Date().toISOString(),
        },
      });
      this.postMessage({ type: "chatResponseEnd", messageId });
    } finally {
      this._activeChatMessageId = null;
      this._chatLastRunningToolBlockId = null;
      this._chatStreamingTextBlockId = null;
      this._chatStreamingTextAccum = "";
      this._chatStreamingThinkingBlockId = null;
      this._chatStreamingThinkingAccum = "";
      this._chatTextBlockCount = 0;
    }
  }

  // ── Explain Finding ──

  private async _explainFinding(findingId: string) {
    if (!this._crpClient?.isConnected() || !this._currentRunId) return;

    let finding = this._findings.find((f) => f.id === findingId);
    if (!finding) {
      try {
        const findings = await this._crpClient.getFindings(this._currentRunId);
        finding = findings.find((f) => f.id === findingId);
      } catch { /* noop */ }
    }
    if (!finding) return;

    // Switch to chat tab so user sees the conversation
    this.postMessage({ type: "switchTab", tab: "chat" });

    // Inject a user message showing the explain request
    const evidenceList = finding.evidence
      .map((ev) => `- \`${ev.filePath}\` (lines ${ev.startLine}–${ev.endLine})`)
      .join("\n");
    const userTicket = [
      `✨ **Explain Finding**`,
      ``,
      `**${finding.title}**`,
      `**Severity:** ${finding.severity.toUpperCase()} · **Category:** ${finding.category} · **Confidence:** ${Math.round(finding.confidence * 100)}%`,
      ``,
      `${finding.description}`,
      ``,
      `**Evidence:**`,
      evidenceList,
    ].join("\n");

    this.postMessage({ type: "injectUserMessage", text: userTicket });

    // Build an investigation prompt so the LLM actively researches the finding
    const evidenceSummary = finding.evidence
      .map((ev) => `  - ${ev.filePath}:${ev.startLine}-${ev.endLine}`)
      .join("\n");

    const query = [
      `Explain this code review finding in detail. Investigate the code and provide a thorough analysis:`,
      ``,
      `**Finding:** ${finding.title}`,
      `**Severity:** ${finding.severity.toUpperCase()} | **Confidence:** ${Math.round(finding.confidence * 100)}%`,
      `**Agent:** ${finding.agent} | **Category:** ${finding.category}`,
      `**Description:** ${finding.description}`,
      ``,
      `**Evidence locations:**`,
      evidenceSummary,
      ``,
      `Please read the relevant files, understand the context, and explain:`,
      `1. What exactly is the issue and why it matters`,
      `2. The potential impact and risk`,
      `3. Whether this is a true positive or could be a false positive`,
      `4. Suggested fix or mitigation`,
    ].join("\n");

    // Trigger an actual chat query — the LLM will investigate with tool calls
    await this._handleChatQuery(query);
  }

  // ── Send to Validator (Real Validator Agent — Real-time Streaming) ──

  private async _sendToValidator(findingId: string) {
    if (!this._crpClient?.isConnected() || !this._currentRunId) {
      vscode.window.showErrorMessage("ChainReview: No active review session");
      return;
    }

    let finding = this._findings.find((f) => f.id === findingId);
    if (!finding) {
      try {
        const findings = await this._crpClient.getFindings(this._currentRunId);
        finding = findings.find((f) => f.id === findingId);
      } catch {
        vscode.window.showErrorMessage("ChainReview: Could not retrieve finding");
        return;
      }
    }
    if (!finding) { vscode.window.showErrorMessage("ChainReview: Finding not found"); return; }

    const messageId = `val-${Date.now()}`;
    this._activeValidateMessageId = messageId;
    this._validateLastRunningToolBlockId = null;
    this._validateStreamingTextBlockId = null;
    this._validateStreamingTextAccum = "";
    this._validateStreamingThinkingBlockId = null;
    this._validateStreamingThinkingAccum = "";

    // Switch to chat tab so user can see validation in real-time
    this.postMessage({ type: "switchTab", tab: "chat" });

    // Inject a user message showing the finding ticket being verified
    const evidenceList = finding.evidence
      .map((ev) => `- \`${ev.filePath}\` (lines ${ev.startLine}–${ev.endLine})`)
      .join("\n");
    const userTicket = [
      `🔍 **Verify Fix**`,
      ``,
      `**${finding.title}**`,
      `**Severity:** ${finding.severity.toUpperCase()} · **Category:** ${finding.category} · **Confidence:** ${Math.round(finding.confidence * 100)}%`,
      ``,
      `${finding.description}`,
      ``,
      `**Evidence:**`,
      evidenceList,
      ``,
      `*Checking if this bug is still present in the current code...*`,
    ].join("\n");

    this.postMessage({ type: "injectUserMessage", text: userTicket });

    this.postMessage({ type: "chatResponseStart", messageId });

    // Emit validator started sub-agent tile
    this.postMessage({
      type: "chatResponseBlock", messageId,
      block: {
        kind: "sub_agent_event",
        id: `sae-${++this._blockCounter}`,
        agent: "validator",
        event: "started",
        message: `Verifying fix: ${finding.title}`,
        timestamp: new Date().toISOString(),
      },
    });

    try {
      await this._crpClient.recordEvent(this._currentRunId, "evidence_collected", "validator", { findingId, action: "manual_validation_request" });

      // The validateFinding MCP call blocks, but stderr events stream in real-time
      // (validateThinking, validateText, validateToolCall, validateToolResult)
      const result = await this._crpClient.validateFinding(JSON.stringify(finding));

      // Flush stderr — wait for any in-flight streaming events to be processed
      await new Promise(resolve => setTimeout(resolve, 150));

      // Emit verdict summary
      const verdictLabel: Record<string, string> = {
        still_present: "Still Present",
        partially_fixed: "Partially Fixed",
        fixed: "Fixed ✓",
        unable_to_determine: "Unable to Determine",
      };

      const validationMsg = [
        `### Verification Result: ${verdictLabel[result.verdict] || result.verdict}`,
        ``,
        `**Finding:** ${finding.title}`,
        `**Status:** \`${result.verdict}\``,
        ``,
        `**Analysis:**`,
        result.reasoning,
      ].join("\n");

      this.postMessage({
        type: "chatResponseBlock", messageId,
        block: { kind: "text", id: `val-${++this._blockCounter}`, text: validationMsg, format: "markdown", timestamp: new Date().toISOString() },
      });

      // Mark validator completed
      this.postMessage({
        type: "chatResponseBlock", messageId,
        block: {
          kind: "sub_agent_event",
          id: `sae-${++this._blockCounter}`,
          agent: "validator",
          event: "completed",
          timestamp: new Date().toISOString(),
        },
      });

      this.postMessage({ type: "chatResponseEnd", messageId });

      // Send verdict back to FindingCard so it can update its badge
      this.postMessage({
        type: "findingValidated",
        findingId,
        verdict: result.verdict,
        reasoning: result.reasoning,
      });

      // Persist verdict so it survives panel reloads
      this._validationVerdicts[findingId] = { verdict: result.verdict, reasoning: result.reasoning };
      this._persistValidationVerdicts();

      vscode.window.showInformationMessage(`ChainReview: Verification result — ${verdictLabel[result.verdict] || result.verdict}`);
    } catch (err: any) {
      const errMsg = err.message || "Unknown error";
      const isApiKeyError = errMsg.includes("API key") || errMsg.includes("401") || errMsg.includes("authentication");
      const errorDisplay = isApiKeyError
        ? `**Validation failed:** Anthropic API key not configured or invalid. Check your API key in VS Code settings (chainReview.anthropicApiKey) or set the ANTHROPIC_API_KEY environment variable.`
        : `**Validation failed:** ${errMsg}`;

      this.postMessage({
        type: "chatResponseBlock", messageId,
        block: { kind: "text", id: `val-${++this._blockCounter}`, text: errorDisplay, format: "markdown", timestamp: new Date().toISOString() },
      });
      this.postMessage({ type: "chatResponseEnd", messageId });

      // Clear the validating state so the card reverts to its pre-verify state
      // Don't send a fake "uncertain" verdict — that's misleading
      this.postMessage({
        type: "findingValidationError",
        findingId,
        error: errMsg,
      });
    } finally {
      this._activeValidateMessageId = null;
      this._validateLastRunningToolBlockId = null;
      this._validateStreamingTextBlockId = null;
      this._validateStreamingTextAccum = "";
      this._validateStreamingThinkingBlockId = null;
      this._validateStreamingThinkingAccum = "";
    }
  }

  // ── Patch Flow ──

  private async _requestPatch(findingId: string) {
    if (!this._crpClient?.isConnected() || !this._currentRunId) {
      vscode.window.showErrorMessage("ChainReview: No active review session");
      return;
    }

    try {
      const findings = await this._crpClient.getFindings(this._currentRunId);
      const finding = findings.find((f) => f.id === findingId);
      if (!finding || finding.evidence.length === 0) {
        vscode.window.showErrorMessage("ChainReview: Finding not found or no evidence");
        return;
      }

      const evidence = finding.evidence[0];

      vscode.window.showInformationMessage("ChainReview: Generating fix with AI...");
      const generated = await this._crpClient.generatePatch({
        filePath: evidence.filePath,
        originalCode: evidence.snippet,
        findingTitle: finding.title,
        findingDescription: finding.description,
      });

      const patch = await this._crpClient.requestPatch(
        findingId, this._currentRunId, evidence.filePath,
        evidence.snippet, generated.patchedCode, `Fix: ${finding.title} — ${generated.explanation}`
      );

      this.postMessage({
        type: "patchReady",
        patch: { id: patch.patchId, findingId, diff: patch.diff, validated: false },
      });
    } catch (err: any) {
      vscode.window.showErrorMessage(`ChainReview: Patch request failed — ${err.message}`);
    }
  }

  private async _applyPatch(patchId: string) {
    if (!this._crpClient?.isConnected()) {
      vscode.window.showErrorMessage("ChainReview: Server not connected");
      return;
    }

    try {
      const validation = await this._crpClient.validatePatch(patchId);
      if (!validation.validated) {
        vscode.window.showWarningMessage(`ChainReview: Patch validation failed — ${validation.message}`);
        return;
      }

      const result = await this._crpClient.applyPatch(patchId);
      if (result.success) {
        vscode.window.showInformationMessage("ChainReview: Patch applied successfully");
        if (this._currentRunId) {
          await this._crpClient.recordEvent(this._currentRunId, "human_accepted", undefined, { patchId }).catch(() => {});
        }
      } else {
        vscode.window.showErrorMessage(`ChainReview: Failed to apply patch — ${result.message}`);
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`ChainReview: Apply patch failed — ${err.message}`);
    }
  }

  private async _dismissPatch(patchId: string) {
    if (!this._crpClient?.isConnected() || !this._currentRunId) return;
    try {
      await this._crpClient.recordEvent(this._currentRunId, "human_rejected", undefined, { patchId });
    } catch { /* Non-critical */ }
  }

  private async _markFalsePositive(findingId: string) {
    if (!this._crpClient?.isConnected() || !this._currentRunId) return;
    try {
      await this._crpClient.recordEvent(this._currentRunId, "false_positive_marked", undefined, { findingId });

      // Get finding title for the timeline event
      const finding = this._findings.find((f) => f.id === findingId);
      const findingTitle = finding?.title || "Finding";

      // Remove finding from in-memory list
      this._findings = this._findings.filter((f) => f.id !== findingId);

      // Notify webview to remove the finding from UI
      this.postMessage({ type: "falsePositiveMarked", findingId });

      // Also emit a timeline event so the timeline tab shows this action
      this.postMessage({
        type: "addEvent",
        event: {
          id: `fp-${findingId}-${Date.now()}`,
          runId: this._currentRunId,
          type: "false_positive_marked",
          timestamp: new Date().toISOString(),
          data: { findingId, findingTitle },
        },
      });

      vscode.window.showInformationMessage("ChainReview: Finding marked as false positive");
    } catch (err: any) {
      vscode.window.showErrorMessage(`ChainReview: Failed to record — ${err.message}`);
    }
  }

  // ── Send to Coding Agent ──

  private async _sendToCodingAgent(findingId: string, agentId?: string) {
    let finding = this._findings.find((f) => f.id === findingId);
    if (!finding && this._crpClient?.isConnected() && this._currentRunId) {
      try {
        const findings = await this._crpClient.getFindings(this._currentRunId);
        finding = findings.find((f) => f.id === findingId);
      } catch { /* noop */ }
    }
    if (!finding) {
      vscode.window.showErrorMessage("ChainReview: Finding not found");
      return;
    }

    const relevantFiles = finding.evidence
      .map((ev) => ev.filePath)
      .filter((v, i, a) => a.indexOf(v) === i);

    const commentLines = [
      `I have the following finding after thorough review of the codebase.`,
      `Implement the fix by following the instructions verbatim.`,
      ``, `---`, ``,
      `## Finding: ${finding.title}`, ``,
      `**Severity:** ${finding.severity.toUpperCase()} | **Confidence:** ${Math.round(finding.confidence * 100)}%`,
      `**Category:** ${finding.category} | **Agent:** ${finding.agent}`,
      ``, finding.description,
    ];

    if (finding.evidence.length > 0) {
      commentLines.push(``, `### Evidence`);
      for (const ev of finding.evidence) {
        commentLines.push(``, `**${ev.filePath}** (lines ${ev.startLine}-${ev.endLine}):`, `\`\`\``, ev.snippet, `\`\`\``);
      }
    }

    commentLines.push(
      ``, `### Relevant Files`,
      ...relevantFiles.map((f) => `- ${f}`),
      ``, `---`, ``,
      `Please fix this issue. The fix should address the root cause described above while maintaining existing functionality.`,
      `After completing the fix, verify that the code compiles and passes any existing tests.`
    );

    const prompt = commentLines.join("\n");

    if (agentId === "config-more") {
      // Open ChainReview settings
      vscode.commands.executeCommand("workbench.action.openSettings", "chainreview");
      return;
    }

    if (agentId === "export-markdown") {
      // Save finding as a markdown file in .chainreview/
      try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
          await vscode.env.clipboard.writeText(prompt);
          vscode.window.showInformationMessage("ChainReview: No workspace — finding copied to clipboard instead");
          return;
        }
        const fs = await import("fs");
        const path = await import("path");
        const chainReviewDir = path.join(workspaceFolder, ".chainreview");
        if (!fs.existsSync(chainReviewDir)) {
          fs.mkdirSync(chainReviewDir, { recursive: true });
        }
        const fileName = `finding-${findingId.replace(/[^a-zA-Z0-9]/g, "-")}.md`;
        const filePath = path.join(chainReviewDir, fileName);
        fs.writeFileSync(filePath, prompt, "utf-8");
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.openTextDocument(uri).then((doc) => vscode.window.showTextDocument(doc));
        vscode.window.showInformationMessage(`ChainReview: Finding exported to .chainreview/${fileName}`);
      } catch (err: any) {
        await vscode.env.clipboard.writeText(prompt);
        vscode.window.showInformationMessage("ChainReview: Export failed — finding copied to clipboard");
      }
      return;
    }

    if (agentId === "clipboard" || !agentId) {
      await vscode.env.clipboard.writeText(prompt);
      vscode.window.showInformationMessage("ChainReview: Finding copied to clipboard — paste into your coding agent");
      return;
    }

    // ── CLI agent configurations ──
    const CLI_AGENTS: Record<string, { label: string; cmd: string }> = {
      "claude-code": { label: "Claude Code", cmd: "claude" },
      "gemini-cli":  { label: "Gemini CLI",  cmd: "gemini" },
      "codex-cli":   { label: "Codex CLI",   cmd: "codex" },
    };

    const cliAgent = CLI_AGENTS[agentId];

    // ── Terminal-based CLI agents (Claude Code, Gemini CLI, Codex CLI) ──
    if (cliAgent) {
      try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
          await vscode.env.clipboard.writeText(prompt);
          vscode.window.showInformationMessage("ChainReview: No workspace — finding copied to clipboard instead");
          return;
        }

        const fs = await import("fs");
        const path = await import("path");
        const { spawnSync } = await import("child_process");

        // Validate CLI command name — only allow known safe alphanumeric names
        if (!/^[a-zA-Z0-9_-]+$/.test(cliAgent.cmd)) {
          vscode.window.showErrorMessage("ChainReview: Invalid CLI agent command name");
          return;
        }

        // Check if the CLI is available using spawnSync with argument array (no shell injection)
        let cliAvailable = false;
        try {
          const whichResult = spawnSync(
            process.platform === "win32" ? "where" : "which",
            [cliAgent.cmd],
            { timeout: 5000, encoding: "utf-8" }
          );
          cliAvailable = whichResult.status === 0;
        } catch {
          // CLI not in PATH
        }

        if (!cliAvailable) {
          await vscode.env.clipboard.writeText(prompt);
          vscode.window.showWarningMessage(
            `ChainReview: "${cliAgent.cmd}" CLI not found in PATH — finding copied to clipboard instead. Install ${cliAgent.label} CLI and ensure it's in your PATH.`
          );
          return;
        }

        const chainReviewDir = path.join(workspaceFolder, ".chainreview");
        if (!fs.existsSync(chainReviewDir)) {
          fs.mkdirSync(chainReviewDir, { recursive: true });
        }

        const promptFileName = `fix-${findingId.replace(/[^a-zA-Z0-9]/g, "-")}.md`;
        const promptFilePath = path.join(chainReviewDir, promptFileName);
        fs.writeFileSync(promptFilePath, prompt, "utf-8");

        const terminal = vscode.window.createTerminal({
          name: `ChainReview → ${cliAgent.label}`,
          cwd: workspaceFolder,
          iconPath: new vscode.ThemeIcon("sparkle"),
        });
        terminal.show();

        // Build the command — pipe the prompt file into each CLI in interactive mode
        // so the agent actually executes changes (not print mode).
        // Shell-escape the file path to prevent injection via crafted finding IDs
        const escapedPath = promptFilePath.replace(/'/g, "'\\''");
        let shellCmd: string;
        if (agentId === "claude-code") {
          // Claude Code: pipe prompt via cat for interactive execution (NOT -p print mode)
          shellCmd = `cat '${escapedPath}' | claude --verbose`;
        } else if (agentId === "codex-cli") {
          // Codex CLI: pipe prompt for interactive execution
          shellCmd = `cat '${escapedPath}' | codex`;
        } else {
          // Gemini CLI: pipe prompt for interactive execution
          shellCmd = `cat '${escapedPath}' | gemini`;
        }
        terminal.sendText(shellCmd);

        const messageId = `agent-${Date.now()}`;
        this.postMessage({ type: "chatResponseStart", messageId });
        this.postMessage({
          type: "chatResponseBlock", messageId,
          block: {
            kind: "text",
            id: `sca-${++this._blockCounter}`,
            text: [
              `**Sent to ${cliAgent.label}** 🚀`, ``,
              `Finding **${finding.title}** has been sent to ${cliAgent.label} in a new terminal.`, ``,
              `The prompt file is saved at \`.chainreview/${promptFileName}\``, ``,
              `After ${cliAgent.label} fixes the issue, run **Re-Review** to verify.`,
            ].join("\n"),
            format: "markdown",
            timestamp: new Date().toISOString(),
          },
        });
        this.postMessage({ type: "chatResponseEnd", messageId });

        if (this._currentRunId && this._crpClient?.isConnected()) {
          await this._crpClient.recordEvent(this._currentRunId, "evidence_collected", undefined, {
            action: "sent_to_coding_agent", agent: agentId, findingId, findingTitle: finding.title,
          }).catch(() => {});
        }
        return;
      } catch (err: any) {
        await vscode.env.clipboard.writeText(prompt);
        vscode.window.showWarningMessage(`ChainReview: Could not launch ${cliAgent.label} — finding copied to clipboard. Error: ${err.message}`);
        return;
      }
    }

    // ── VS Code extension-based agents (Kilo Code, Cursor) — clipboard + command ──
    await vscode.env.clipboard.writeText(prompt);

    const extensionAgents: Record<string, { label: string; command?: string; shortcut: string }> = {
      "kilo-code": { label: "Kilo Code", command: "kilo-code.startNewTask", shortcut: "Cmd+Shift+K" },
      "cursor":    { label: "Cursor",    command: "aipopup.action.modal.generate", shortcut: "Cmd+L" },
    };

    const extAgent = extensionAgents[agentId];
    if (extAgent) {
      vscode.window.showInformationMessage(
        `ChainReview: Finding copied — paste into ${extAgent.label}'s chat (${extAgent.shortcut})`,
        "Open Chat"
      ).then((choice) => {
        if (choice === "Open Chat" && extAgent.command) {
          vscode.commands.executeCommand(extAgent.command).then(undefined, () => {
            // Command not available — extension not installed
            vscode.window.showWarningMessage(
              `ChainReview: ${extAgent.label} doesn't appear to be installed. The finding is still on your clipboard.`
            );
          });
        }
      });
      return;
    }

    // ── Fallback — unknown agent ──
    const label = agentId || "your coding agent";
    vscode.window.showInformationMessage(
      `ChainReview: Finding copied to clipboard — paste into ${label}'s chat`
    );
  }

  // ── Task History ──

  private async _getReviewHistory() {
    if (!this._crpClient?.isConnected()) {
      this.postMessage({ type: "reviewHistory", runs: [] });
      return;
    }

    try {
      const runs = await this._crpClient.listRuns(50);
      this.postMessage({ type: "reviewHistory", runs });
    } catch (err: any) {
      console.error("ChainReview: Failed to get review history:", err.message);
      this.postMessage({ type: "reviewHistory", runs: [] });
    }
  }

  private async _deleteReviewRun(runId: string) {
    if (!this._crpClient?.isConnected()) return;

    try {
      await this._crpClient.deleteRun(runId);
      vscode.window.showInformationMessage("ChainReview: Review deleted");
    } catch (err: any) {
      console.error("ChainReview: Failed to delete review run:", err.message);
      vscode.window.showErrorMessage(`ChainReview: Failed to delete review — ${err.message}`);
    }
  }

  private async _loadReviewRun(runId: string) {
    if (!this._crpClient?.isConnected()) return;

    try {
      // Get findings and events for this run
      const [findings, events] = await Promise.all([
        this._crpClient.getFindings(runId),
        this._crpClient.getEvents(runId),
      ]);

      this._currentRunId = runId;
      this._findings = findings;

      // Start the review state in the webview
      this.postMessage({ type: "reviewStarted", mode: "repo" as const });

      // Send all findings
      for (const finding of findings) {
        this.postMessage({ type: "finding", finding });
      }

      // Send all events
      for (const event of events) {
        this.postMessage({ type: "addEvent", event });
      }

      // Mark complete
      this.postMessage({ type: "reviewComplete", findings, events });

      vscode.window.showInformationMessage(
        `ChainReview: Loaded review with ${findings.length} finding${findings.length !== 1 ? "s" : ""}`
      );
    } catch (err: any) {
      console.error("ChainReview: Failed to load review run:", err.message);
      vscode.window.showErrorMessage(`ChainReview: Failed to load review — ${err.message}`);
    }
  }

  // ── MCP Server Management ──

  /** In-memory store of user-configured MCP servers */
  private _mcpServers: Array<{
    id: string;
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    enabled: boolean;
    status: string;
    tools: Array<{ name: string; description: string }>;
    error?: string;
  }> = [];

  private _openMCPManager() {
    this.postMessage({ type: "mcpManagerOpen" });
    this._sendMCPServers();
  }

  private _sendMCPServers() {
    const servers = this._mcpServers.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      tools: s.tools,
      config: {
        id: s.id,
        name: s.name,
        command: s.command,
        args: s.args,
        env: s.env,
        enabled: s.enabled,
      },
      error: s.error,
    }));
    this.postMessage({ type: "mcpServers", servers });
  }

  private _mcpAddServer(config: {
    id: string;
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    enabled: boolean;
  }) {
    const server = {
      ...config,
      status: config.enabled ? "disconnected" : "disconnected",
      tools: [] as Array<{ name: string; description: string }>,
    };
    this._mcpServers.push(server);
    this._saveMCPServersToConfig();

    // If enabled, try to connect
    if (config.enabled) {
      this._connectMCPServer(config.id);
    }

    this._sendMCPServers();
    vscode.window.showInformationMessage(`ChainReview: Added MCP server "${config.name}"`);
  }

  private _mcpUpdateServer(config: {
    id: string;
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    enabled: boolean;
  }) {
    const idx = this._mcpServers.findIndex((s) => s.id === config.id);
    if (idx < 0) return;

    const prev = this._mcpServers[idx];
    this._mcpServers[idx] = {
      ...prev,
      name: config.name,
      command: config.command,
      args: config.args,
      env: config.env,
      enabled: config.enabled,
    };
    this._saveMCPServersToConfig();

    // Reconnect if config changed and enabled
    if (config.enabled) {
      this._connectMCPServer(config.id);
    } else {
      this._mcpServers[idx].status = "disconnected";
      this._mcpServers[idx].tools = [];
    }

    this._sendMCPServers();
    vscode.window.showInformationMessage(`ChainReview: Updated MCP server "${config.name}"`);
  }

  private _mcpRemoveServer(serverId: string) {
    const idx = this._mcpServers.findIndex((s) => s.id === serverId);
    if (idx < 0) return;

    const name = this._mcpServers[idx].name;
    this._mcpServers.splice(idx, 1);
    this._saveMCPServersToConfig();
    this._sendMCPServers();
    vscode.window.showInformationMessage(`ChainReview: Removed MCP server "${name}"`);
  }

  private _mcpToggleServer(serverId: string, enabled: boolean) {
    const server = this._mcpServers.find((s) => s.id === serverId);
    if (!server) return;

    server.enabled = enabled;
    this._saveMCPServersToConfig();

    if (enabled) {
      this._connectMCPServer(serverId);
    } else {
      server.status = "disconnected";
      server.tools = [];
      server.error = undefined;
    }

    this._sendMCPServers();
  }

  private _mcpRefreshServer(serverId: string) {
    const server = this._mcpServers.find((s) => s.id === serverId);
    if (!server || !server.enabled) return;
    this._connectMCPServer(serverId);
  }

  /** Allowlist of known-safe MCP server commands */
  private static readonly MCP_COMMAND_ALLOWLIST = new Set([
    "node", "npx", "tsx", "ts-node",
    "python", "python3", "pip", "pipx", "uvx",
    "deno", "bun",
    "docker",
    "mcp-server-filesystem", "mcp-server-fetch", "mcp-server-memory",
    "mcp-server-brave-search", "mcp-server-github", "mcp-server-gitlab",
    "mcp-server-postgres", "mcp-server-sqlite", "mcp-server-redis",
    "mcp-server-puppeteer", "mcp-server-sequential-thinking",
  ]);

  private _validateMCPCommand(command: string): { valid: boolean; reason?: string } {
    // Must be alphanumeric with hyphens/underscores only — no paths, no shell metacharacters
    if (!/^[a-zA-Z0-9_.-]+$/.test(command)) {
      return { valid: false, reason: `Invalid command name "${command}" — only alphanumeric characters, dots, hyphens, and underscores are allowed` };
    }
    // Check allowlist
    if (!ReviewCockpitProvider.MCP_COMMAND_ALLOWLIST.has(command)) {
      return { valid: false, reason: `Command "${command}" is not in the MCP server allowlist. Allowed: ${Array.from(ReviewCockpitProvider.MCP_COMMAND_ALLOWLIST).join(", ")}` };
    }
    return { valid: true };
  }

  private async _connectMCPServer(serverId: string) {
    const server = this._mcpServers.find((s) => s.id === serverId);
    if (!server) return;

    server.status = "connecting";
    server.error = undefined;
    this._sendMCPServers();

    try {
      // Validate the command against our allowlist before executing anything
      const cmdValidation = this._validateMCPCommand(server.command);
      if (!cmdValidation.valid) {
        throw new Error(cmdValidation.reason);
      }

      // Verify the command exists on the system using argument array (no shell injection)
      const { spawnSync } = await import("child_process");
      const result = spawnSync(
        process.platform === "win32" ? "where" : "which",
        [server.command],
        { timeout: 5000, encoding: "utf-8" }
      );

      if (result.status !== 0) {
        throw new Error(`Command "${server.command}" not found in PATH`);
      }

      // Mark as connected (in a real implementation, we'd maintain the MCP connection)
      server.status = "connected";
      server.error = undefined;

      // Populate with placeholder tools (in a real implementation, we'd query the server)
      server.tools = [
        { name: `${server.name.toLowerCase().replace(/\s+/g, "_")}.ping`, description: "Health check" },
      ];

      this._sendMCPServers();
    } catch (err: any) {
      server.status = "error";
      server.error = err.message || "Connection failed";
      server.tools = [];
      this._sendMCPServers();
    }
  }

  /** Persist MCP server configs to VS Code workspace configuration */
  private _saveMCPServersToConfig() {
    const configs = this._mcpServers.map((s) => ({
      id: s.id,
      name: s.name,
      command: s.command,
      args: s.args,
      env: s.env,
      enabled: s.enabled,
    }));
    vscode.workspace
      .getConfiguration("chainreview")
      .update("mcpServers", configs, vscode.ConfigurationTarget.Workspace)
      .then(undefined, (err) => {
        console.error("ChainReview: Failed to save MCP server configs:", err);
      });
  }

  /** Load MCP server configs from VS Code workspace configuration */
  private _loadMCPServersFromConfig() {
    const configs = vscode.workspace
      .getConfiguration("chainreview")
      .get<Array<{
        id: string;
        name: string;
        command: string;
        args: string[];
        env?: Record<string, string>;
        enabled: boolean;
      }>>("mcpServers", []);

    this._mcpServers = configs.map((c) => ({
      ...c,
      status: "disconnected",
      tools: [],
    }));

    // Auto-connect enabled servers
    for (const server of this._mcpServers) {
      if (server.enabled) {
        this._connectMCPServer(server.id);
      }
    }
  }

  // ── State Persistence ──

  private _persistChatMessages(messages: unknown[]) {
    if (!this._context) return;
    try {
      this._context.workspaceState.update("chainreview.chatMessages", messages);
    } catch (err: any) {
      console.error("ChainReview: Failed to persist chat messages:", err.message);
    }
  }

  private _persistReviewState(state: { findings: unknown[]; events: unknown[]; status: string; mode?: string; runId?: string; validationVerdicts?: Record<string, unknown> }) {
    if (!this._context) return;
    try {
      this._context.workspaceState.update("chainreview.reviewState", state);
    } catch (err: any) {
      console.error("ChainReview: Failed to persist review state:", err.message);
    }
  }

  private _persistValidationVerdicts() {
    if (!this._context) return;
    try {
      this._context.workspaceState.update("chainreview.validationVerdicts", this._validationVerdicts);
    } catch (err: any) {
      console.error("ChainReview: Failed to persist validation verdicts:", err.message);
    }
  }

  private _restorePersistedState() {
    if (!this._context) return;

    // Small delay to ensure webview is ready to receive messages
    setTimeout(() => {
      try {
        // Restore chat messages
        const messages = this._context!.workspaceState.get<unknown[]>("chainreview.chatMessages");
        if (messages && messages.length > 0) {
          this.postMessage({ type: "restoreMessages", messages });
        }

        // Restore validation verdicts into memory
        const verdicts = this._context!.workspaceState.get<Record<string, { verdict: string; reasoning: string }>>("chainreview.validationVerdicts");
        if (verdicts) {
          this._validationVerdicts = verdicts;
        }

        // Restore review state (findings, events, status) + merge verdicts
        const reviewState = this._context!.workspaceState.get<{
          findings: unknown[];
          events: unknown[];
          status: string;
          mode?: string;
          runId?: string;
        }>("chainreview.reviewState");
        if (reviewState && reviewState.status !== "idle") {
          if (reviewState.runId) {
            this._currentRunId = reviewState.runId;
          }
          this.postMessage({
            type: "restoreReviewState",
            ...reviewState,
            validationVerdicts: this._validationVerdicts,
          });
        } else if (Object.keys(this._validationVerdicts).length > 0) {
          // Even without a review state, restore verdicts alone
          this.postMessage({
            type: "restoreReviewState",
            findings: [],
            events: [],
            status: "idle",
            validationVerdicts: this._validationVerdicts,
          });
        }
      } catch (err: any) {
        console.error("ChainReview: Failed to restore persisted state:", err.message);
      }
    }, 200);
  }

  private _clearPersistedChat() {
    if (!this._context) return;
    // Only clear chat messages — keep review state and verdicts
    this._context.workspaceState.update("chainreview.chatMessages", undefined);
  }

  // ── Webview HTML ──

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "webview", "assets", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "webview", "assets", "index.css")
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https://cdn.simpleicons.org https://cursor.sh https://codeium.com data:;">
  <link href="${styleUri}" rel="stylesheet">
  <title>ChainReview</title>
</head>
<body class="bg-transparent text-white antialiased">
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
