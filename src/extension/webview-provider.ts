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
  private _blockCounter = 0;
  /** Track running tool_call block IDs per-agent for parallel routing */
  private _lastRunningToolBlockIds: Record<string, string> = {};
  /** Legacy fallback for non-agent-tagged tool calls */
  private _lastRunningToolBlockId: string | null = null;

  // ── Chat streaming state ──
  /** Active chat message ID being streamed to */
  private _activeChatMessageId: string | null = null;
  /** Last running tool block for chat queries */
  private _chatLastRunningToolBlockId: string | null = null;
  /** Active validate message ID */
  private _activeValidateMessageId: string | null = null;
  private _validateLastRunningToolBlockId: string | null = null;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _crpClient?: CrpClient
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
  }

  public postMessage(message: unknown) {
    this._view?.webview.postMessage(message);
  }

  public triggerReview(mode: "repo" | "diff") {
    this._startReview(mode).catch((err) => {
      console.error("ChainReview: triggerReview error:", err);
    });
  }

  private async _handleMessage(message: Record<string, unknown>) {
    switch (message.type) {
      case "startReview":
        await this._startReview(message.mode as "repo" | "diff", message.path as string | undefined);
        break;
      case "chatQuery":
        await this._handleChatQuery(message.query as string);
        break;
      case "requestPatch":
        await this._requestPatch(message.findingId as string);
        break;
      case "applyPatch":
        await this._applyPatch(message.patchId as string);
        break;
      case "dismissPatch":
        await this._dismissPatch(message.patchId as string);
        break;
      case "markFalsePositive":
        await this._markFalsePositive(message.findingId as string);
        break;
      case "explainFinding":
        await this._explainFinding(message.findingId as string);
        break;
      case "sendToValidator":
        await this._sendToValidator(message.findingId as string);
        break;
      case "sendToCodingAgent":
        await this._sendToCodingAgent(message.findingId as string, message.agentId as string);
        break;
      case "cancelReview":
        this._cancelReview();
        break;
      case "openFile":
        this._openFile(message.filePath as string, message.line as number | undefined);
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
        this._mcpRemoveServer(message.serverId as string);
        break;
      case "mcpToggleServer":
        this._mcpToggleServer(message.serverId as string, message.enabled as boolean);
        break;
      case "mcpRefreshServer":
        this._mcpRefreshServer(message.serverId as string);
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
    if (this._crpClient) {
      this._crpClient.cancelReview().catch(() => {
        this._crpClient?.cancelActiveOperation();
      });
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
            const resultSummary = (data?.resultSummary as string)?.slice(0, 80) || "";
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

        // Pipeline step progress — suppress [step] noise, only emit warnings
        if (kind === "pipeline_step") {
          const warning = data?.warning as string;
          if (warning) {
            this._emitBlock({
              kind: "text",
              id: `ps-${++this._blockCounter}`,
              text: `⚠ ${warning}`,
              format: "plain",
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
      // CHAT QUERY STREAMING EVENTS (real-time from chatQuery)
      // ═══════════════════════════════════════════════════════
      case "chatThinking": {
        if (!this._activeChatMessageId) break;
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
        break;
      }

      case "chatText": {
        if (!this._activeChatMessageId) break;
        const text = event.text as string;
        if (text) {
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
        break;
      }

      case "chatToolCall": {
        if (!this._activeChatMessageId) break;
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
          const resultStr = (event.result as string)?.slice(0, 200) || "";
          this._updateBlock(this._chatLastRunningToolBlockId, {
            status: "done",
            result: resultStr,
          });
          this._chatLastRunningToolBlockId = null;
        }
        break;
      }

      // ═══════════════════════════════════════════════════════
      // VALIDATE FINDING STREAMING EVENTS
      // ═══════════════════════════════════════════════════════
      case "validateThinking": {
        if (!this._activeValidateMessageId) break;
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
        break;
      }

      case "validateText": {
        if (!this._activeValidateMessageId) break;
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
        break;
      }

      case "validateToolCall": {
        if (!this._activeValidateMessageId) break;
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
          const resultStr = (event.result as string)?.slice(0, 200) || "";
          this._updateBlock(this._validateLastRunningToolBlockId, {
            status: "done",
            result: resultStr,
          });
          this._validateLastRunningToolBlockId = null;
        }
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
          const resultStr = (event.result as string)?.slice(0, 200) || "";
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

  private async _startReview(mode: "repo" | "diff", path?: string) {
    if (!this._crpClient?.isConnected()) {
      this.postMessage({ type: "reviewError", error: "CRP server is not connected. Please restart VS Code." });
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
      const result = await this._crpClient.runReview(repoPath, mode);
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

      this.postMessage({ type: "reviewComplete", findings: result.findings, events: result.events });
    } catch (err: any) {
      this.postMessage({ type: "reviewError", error: `Review failed: ${err.message}` });
    }
  }

  private _emitBlock(block: Record<string, unknown>, agent?: string) {
    this.postMessage({ type: "addBlock", block, agent });
  }

  private _updateBlock(blockId: string, updates: Record<string, unknown>) {
    this.postMessage({ type: "updateBlock", blockId, updates });
  }

  // ── Chat Query Flow (Real-time Streaming) ──
  //
  // The chat flow now works like this:
  // 1. Create a streaming assistant message (chatResponseStart)
  // 2. As the MCP call runs, stderr events fire: chatThinking, chatText, chatToolCall, chatToolResult
  // 3. These events push blocks to the webview INCREMENTALLY via chatResponseBlock
  // 4. When the MCP call completes, we mark the message complete (chatResponseEnd)
  //
  // This gives real-time streaming: thinking → text → tool calls → text, continuous loop.

  private async _handleChatQuery(query: string) {
    if (!this._crpClient?.isConnected()) {
      this.postMessage({ type: "reviewError", error: "CRP server is not connected." });
      return;
    }

    const messageId = `chat-${Date.now()}`;
    this._activeChatMessageId = messageId;
    this._chatLastRunningToolBlockId = null;

    // Create the streaming assistant message
    this.postMessage({ type: "chatResponseStart", messageId });

    try {
      // The chatQuery MCP call blocks until complete, BUT during execution
      // the server streams events via stderr → _handleStreamEvent → chatThinking/chatText/chatToolCall/chatToolResult
      // which push blocks to the webview INCREMENTALLY.
      // By the time this awaited call returns, all blocks are already in the UI.
      await this._crpClient.chatQuery(query, this._currentRunId);

      // Mark the message as complete — all blocks were already streamed
      this.postMessage({ type: "chatResponseEnd", messageId });
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

    const evidenceText = finding.evidence
      .map((ev) => `\n**${ev.filePath}** (lines ${ev.startLine}-${ev.endLine}):\n\`\`\`\n${ev.snippet}\n\`\`\``)
      .join("\n");

    const explanation = [
      `**${finding.title}**`, ``,
      `**Severity:** ${finding.severity.toUpperCase()} | **Confidence:** ${Math.round(finding.confidence * 100)}%`,
      `**Agent:** ${finding.agent} | **Category:** ${finding.category}`,
      ``, finding.description, ``,
      `**Evidence:**`, evidenceText,
    ].join("\n");

    const messageId = `explain-${Date.now()}`;
    this.postMessage({ type: "chatResponseStart", messageId });
    this.postMessage({
      type: "chatResponseBlock", messageId,
      block: { kind: "text", id: `exp-${++this._blockCounter}`, text: explanation, format: "markdown", timestamp: new Date().toISOString() },
    });
    this.postMessage({ type: "chatResponseEnd", messageId });
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

    this.postMessage({ type: "chatResponseStart", messageId });

    // Emit validator started sub-agent tile
    this.postMessage({
      type: "chatResponseBlock", messageId,
      block: {
        kind: "sub_agent_event",
        id: `sae-${++this._blockCounter}`,
        agent: "validator",
        event: "started",
        message: `Validating: ${finding.title}`,
        timestamp: new Date().toISOString(),
      },
    });

    try {
      await this._crpClient.recordEvent(this._currentRunId, "evidence_collected", "validator", { findingId, action: "manual_validation_request" });

      // The validateFinding MCP call blocks, but stderr events stream in real-time
      // (validateThinking, validateText, validateToolCall, validateToolResult)
      const result = await this._crpClient.validateFinding(JSON.stringify(finding));

      // Emit verdict summary
      const verdictLabel: Record<string, string> = {
        confirmed: "Confirmed",
        likely_valid: "Likely Valid",
        uncertain: "Uncertain",
        likely_false_positive: "Likely False Positive",
        false_positive: "False Positive",
      };

      const validationMsg = [
        `### Validator Verdict: ${verdictLabel[result.verdict] || result.verdict}`,
        ``,
        `**Finding:** ${finding.title}`,
        `**Verdict:** \`${result.verdict}\``,
        ``,
        `**Reasoning:**`,
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
      vscode.window.showInformationMessage(`ChainReview: Validator verdict — ${result.verdict}`);
    } catch (err: any) {
      this.postMessage({
        type: "chatResponseBlock", messageId,
        block: { kind: "text", id: `val-${++this._blockCounter}`, text: `Validation error: ${err.message}`, format: "plain", timestamp: new Date().toISOString() },
      });
      this.postMessage({ type: "chatResponseEnd", messageId });
    } finally {
      this._activeValidateMessageId = null;
      this._validateLastRunningToolBlockId = null;
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

    if (agentId === "clipboard" || !agentId) {
      await vscode.env.clipboard.writeText(prompt);
      vscode.window.showInformationMessage("ChainReview: Finding copied to clipboard — paste into your coding agent");
      return;
    }

    if (agentId === "claude-code") {
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

        const promptFileName = `fix-${findingId.replace(/[^a-zA-Z0-9]/g, "-")}.md`;
        const promptFilePath = path.join(chainReviewDir, promptFileName);
        fs.writeFileSync(promptFilePath, prompt, "utf-8");

        const terminal = vscode.window.createTerminal({
          name: `ChainReview → Claude Code`,
          cwd: workspaceFolder,
          iconPath: new vscode.ThemeIcon("sparkle"),
        });
        terminal.show();
        terminal.sendText(`cat "${promptFilePath}" | claude --print`, false);
        terminal.sendText("", true);

        const messageId = `agent-${Date.now()}`;
        this.postMessage({ type: "chatResponseStart", messageId });
        this.postMessage({
          type: "chatResponseBlock", messageId,
          block: {
            kind: "text",
            id: `sca-${++this._blockCounter}`,
            text: [
              `**Sent to Claude Code** 🚀`, ``,
              `Finding **${finding.title}** has been sent to Claude Code in a new terminal.`, ``,
              `The prompt file is saved at \`.chainreview/${promptFileName}\``, ``,
              `After Claude Code fixes the issue, run **Re-Review** to verify.`,
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
        vscode.window.showWarningMessage(`ChainReview: Could not launch terminal — finding copied to clipboard. Error: ${err.message}`);
        return;
      }
    }

    await vscode.env.clipboard.writeText(prompt);
    const agentLabels: Record<string, string> = { "cursor": "Cursor", "windsurf": "Windsurf", "copilot": "GitHub Copilot" };
    const label = agentLabels[agentId] || "your coding agent";
    vscode.window.showInformationMessage(
      `ChainReview: Finding copied — paste into ${label}'s chat (Cmd+L or Ctrl+L)`,
      "Open Chat"
    ).then((choice) => {
      if (choice === "Open Chat") {
        if (agentId === "cursor") {
          Promise.resolve(vscode.commands.executeCommand("aipopup.action.modal.generate")).catch(() => {});
        } else if (agentId === "copilot") {
          Promise.resolve(vscode.commands.executeCommand("workbench.panel.chat.view.copilot.focus")).catch(() => {});
        }
      }
    });
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

  private async _connectMCPServer(serverId: string) {
    const server = this._mcpServers.find((s) => s.id === serverId);
    if (!server) return;

    server.status = "connecting";
    server.error = undefined;
    this._sendMCPServers();

    try {
      // Verify the command exists on the system before marking connected.
      // For a full implementation, we'd use the MCP SDK to establish a real connection.
      const { spawnSync } = await import("child_process");
      const result = spawnSync("which", [server.command], {
        timeout: 5000,
        encoding: "utf-8",
      });

      if (result.status !== 0 && result.error) {
        throw new Error(`Command "${server.command}" not found`);
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
