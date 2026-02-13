import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "path";
import type { Finding, Patch, AuditEvent } from "./types";

// Re-export types for convenience
export type { Finding, Patch, AuditEvent };

export type StreamEventHandler = (event: Record<string, unknown>) => void;

export class CrpClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private connected = false;
  private _onStreamEvent: StreamEventHandler | null = null;
  private _stderrBuffer = "";

  constructor() {
    this.client = new Client({
      name: "chainreview-extension",
      version: "0.1.0",
    });
  }

  /** Register handler for real-time stream events from server stderr */
  onStreamEvent(handler: StreamEventHandler) {
    this._onStreamEvent = handler;
  }

  async start(extensionPath: string): Promise<void> {
    const serverPath = path.join(extensionPath, "dist", "server", "server.js");

    // MCP SDK's getDefaultEnvironment() only inherits HOME, PATH, SHELL, TERM, USER.
    // We must explicitly pass ANTHROPIC_API_KEY and augment PATH for homebrew tools.
    const currentPath = process.env.PATH || "";
    const pathParts: string[] = [];
    if (!currentPath.includes("/opt/homebrew/bin")) pathParts.push("/opt/homebrew/bin");
    if (!currentPath.includes("/usr/local/bin")) pathParts.push("/usr/local/bin");
    const augmentedPath = [...pathParts, currentPath].join(":");

    const env: Record<string, string> = {
      PATH: augmentedPath,
      HOME: process.env.HOME || process.env.USERPROFILE || "",
    };

    // Pass ANTHROPIC_API_KEY to the server process
    if (process.env.ANTHROPIC_API_KEY) {
      env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    }

    // Also pass BRAVE_SEARCH_API_KEY if available
    if (process.env.BRAVE_SEARCH_API_KEY) {
      env.BRAVE_SEARCH_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
    }

    this.transport = new StdioClientTransport({
      command: "node",
      args: [serverPath],
      env,
      stderr: "pipe", // Capture stderr for stream events
    });

    // Access the underlying child process for stderr streaming
    // StdioClientTransport exposes the process after start
    await this.client.connect(this.transport);
    this.connected = true;

    // Tap into stderr for streaming events
    // The transport may expose the child process — we need to access it
    this._setupStderrListener();
  }

  private _setupStderrListener() {
    if (!this.transport) return;

    // StdioClientTransport exposes .stderr as a readable PassThrough stream
    // after start() / connect() when stderr: "pipe" is configured.
    // The stream may not be immediately available — retry a few times.
    const tryAttach = (attempt: number) => {
      const stderrStream = (this.transport as any)?.stderr;
      if (stderrStream && typeof stderrStream.on === "function") {
        stderrStream.on("data", (chunk: Buffer) => {
          this._stderrBuffer += chunk.toString();
          this._processStderrBuffer();
        });
        stderrStream.on("error", (err: Error) => {
          console.error("ChainReview: stderr stream error:", err.message);
        });
        console.error("ChainReview: stderr listener attached (attempt", attempt, ")");
      } else if (attempt < 5) {
        // Retry after a short delay — the stream may become available after transport starts
        setTimeout(() => tryAttach(attempt + 1), 200 * attempt);
      } else {
        console.error("ChainReview: WARN — stderr stream not available after 5 attempts. Real-time streaming will not work.");
      }
    };

    tryAttach(1);
  }

  private _processStderrBuffer() {
    const lines = this._stderrBuffer.split("\n");
    // Keep the last incomplete line in the buffer
    this._stderrBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.__crp_stream && this._onStreamEvent) {
          this._onStreamEvent(parsed);
        }
      } catch {
        // Non-JSON stderr output — forward ChainReview errors as stream events
        // so they're visible in the webview. This catches API errors, model errors,
        // and other server-side failures that would otherwise be silently dropped.
        if (trimmed.includes("ChainReview") && this._onStreamEvent) {
          this._onStreamEvent({
            __crp_stream: true,
            type: "event",
            event: {
              id: `stderr-${Date.now()}`,
              type: "evidence_collected",
              agent: "system",
              timestamp: new Date().toISOString(),
              data: {
                kind: "pipeline_step",
                step: "Server",
                warning: trimmed,
              },
            },
          });
        }
      }
    }
  }

  async stop(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ── High-level Review ──

  async runReview(
    repoPath: string,
    mode: "repo" | "diff"
  ): Promise<{
    runId: string;
    findings: Finding[];
    events: AuditEvent[];
    status: string;
    error?: string;
  }> {
    const result = await this.callTool("crp.review.run", { repoPath, mode });
    return JSON.parse(result);
  }

  // ── Repo Tools ──

  async repoOpen(repoPath: string): Promise<{ path: string; name: string; branch: string }> {
    const result = await this.callTool("crp.repo.open", { repoPath });
    return JSON.parse(result);
  }

  async repoTree(): Promise<{ files: string[]; totalFiles: number }> {
    const result = await this.callTool("crp.repo.tree", {});
    return JSON.parse(result);
  }

  async repoFile(filePath: string): Promise<{ content: string; lineCount: number }> {
    const result = await this.callTool("crp.repo.file", { path: filePath });
    return JSON.parse(result);
  }

  // ── Patch Tools ──

  async requestPatch(
    findingId: string,
    runId: string,
    filePath: string,
    originalCode: string,
    patchedCode: string,
    description: string
  ): Promise<{ patchId: string; diff: string }> {
    const result = await this.callTool("crp.patch.propose", {
      findingId,
      runId,
      filePath,
      originalCode,
      patchedCode,
      description,
    });
    return JSON.parse(result);
  }

  async validatePatch(patchId: string): Promise<{ validated: boolean; message: string }> {
    const result = await this.callTool("crp.patch.validate", { patchId });
    return JSON.parse(result);
  }

  async applyPatch(patchId: string): Promise<{ success: boolean; message: string }> {
    const result = await this.callTool("crp.patch.apply", { patchId });
    return JSON.parse(result);
  }

  // ── Audit Tools ──

  async recordEvent(
    runId: string,
    type: string,
    agent: string | undefined,
    data: Record<string, unknown>
  ): Promise<{ eventId: string; timestamp: string }> {
    const result = await this.callTool("crp.review.record_event", {
      runId,
      type,
      agent,
      data,
    });
    return JSON.parse(result);
  }

  // ── Query Tools ──

  async getFindings(runId: string): Promise<Finding[]> {
    const result = await this.callTool("crp.review.get_findings", { runId });
    return JSON.parse(result);
  }

  async getEvents(runId: string): Promise<AuditEvent[]> {
    const result = await this.callTool("crp.review.get_events", { runId });
    return JSON.parse(result);
  }

  // ── Chat Query ──

  async chatQuery(
    query: string,
    runId?: string
  ): Promise<{ answer: string; toolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string }> }> {
    const args: Record<string, unknown> = { query };
    if (runId) args.runId = runId;
    const result = await this.callTool("crp.chat.query", args);
    return JSON.parse(result);
  }

  // ── LLM-Powered Patch Generation ──

  async generatePatch(args: {
    filePath: string;
    originalCode: string;
    findingTitle: string;
    findingDescription: string;
  }): Promise<{ patchedCode: string; explanation: string }> {
    const result = await this.callTool("crp.patch.generate", args);
    return JSON.parse(result);
  }

  // ── Finding Validation (Real Validator Agent) ──

  async validateFinding(
    findingJson: string
  ): Promise<{
    verdict: "confirmed" | "likely_valid" | "uncertain" | "likely_false_positive" | "false_positive";
    reasoning: string;
    toolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
  }> {
    const result = await this.callTool("crp.review.validate_finding", { findingJson });
    return JSON.parse(result);
  }

  // ── Low-level ──

  /** Abort controller for the currently running long operation (review, etc.) */
  private _activeAbort: AbortController | null = null;

  /** Cancel any running long operation (review, chat, etc.) */
  cancelActiveOperation(): void {
    if (this._activeAbort) {
      this._activeAbort.abort();
      this._activeAbort = null;
    }
  }

  /** Cancel the currently running review on the server side.
   *  This sends a cancel signal to the server which aborts all running agents,
   *  AND aborts the client-side MCP call so it doesn't block waiting for the response.
   */
  async cancelReview(): Promise<void> {
    // 1. Tell the server to abort running agents via signal
    try {
      if (this.connected) {
        await this.client.callTool(
          { name: "crp.review.cancel", arguments: {} },
          undefined,
          { timeout: 5000 } as any
        );
      }
    } catch {
      // Best effort — the server might already be winding down
    }
    // 2. Also abort the client-side waiting operation
    this.cancelActiveOperation();
  }

  private async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.connected) {
      throw new Error("CRP server not connected");
    }

    // Long-running tools (review, validate_finding, chat, patch generation)
    // need extended timeouts — the default MCP SDK timeout is too short for
    // multi-agent pipelines with multiple LLM calls.
    const LONG_RUNNING_TOOLS = new Set([
      "crp.review.run",
      "crp.review.validate_finding",
      "crp.chat.query",
      "crp.patch.generate",
    ]);

    const isLongRunning = LONG_RUNNING_TOOLS.has(name);

    // Create AbortController for cancellation and timeout
    const controller = new AbortController();
    if (isLongRunning) {
      this._activeAbort = controller;
    }

    const timeoutMs = isLongRunning ? 600_000 : 120_000; // 10min or 2min

    let result;
    try {
      // Pass timeout directly to MCP SDK — it handles the timeout internally.
      // Also pass signal for user-initiated cancellation via cancelActiveOperation().
      result = await this.client.callTool(
        { name, arguments: args },
        undefined,
        { timeout: timeoutMs, signal: controller.signal } as any
      );
    } catch (err: any) {
      if (isLongRunning) this._activeAbort = null;
      // Handle timeout (-32001) and user cancellation (AbortError)
      if (err.code === -32001 || err.message?.includes("timed out")) {
        throw new Error(`Operation timed out after ${timeoutMs / 1000}s — the server may still be processing`);
      }
      if (err.name === "AbortError" || err.message?.includes("abort")) {
        throw new Error("Operation cancelled by user");
      }
      throw err;
    }
    if (isLongRunning) this._activeAbort = null;

    // Check for MCP error responses
    if (result.isError) {
      const errorText = Array.isArray(result.content)
        ? (result.content.find((c: any) => c.type === "text") as any)?.text || "Unknown error"
        : "Unknown error";
      throw new Error(`Tool ${name} failed: ${errorText}`);
    }

    // Extract text content from MCP response
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find(
        (c: any) => c.type === "text"
      ) as any;
      if (textContent) {
        return textContent.text;
      }
    }

    return JSON.stringify(result);
  }
}
