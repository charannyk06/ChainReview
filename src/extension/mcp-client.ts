import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "path";
import * as fs from "fs";
import type { Finding, Patch, AuditEvent } from "./types";

// Re-export types for convenience
export type { Finding, Patch, AuditEvent };

export type StreamEventHandler = (event: Record<string, unknown>) => void;

/** Cache for keys retrieved from VS Code SecretStorage */
let _secretStorageCache: Map<string, string> = new Map();

/**
 * Store an API key securely using VS Code SecretStorage.
 * Called from extension activation to migrate plain-text keys.
 */
export async function storeApiKeySecurely(
  secrets: { get(key: string): Thenable<string | undefined>; store(key: string, value: string): Thenable<void> },
  key: string,
  value: string
): Promise<void> {
  await secrets.store(`chainreview.${key}`, value);
  _secretStorageCache.set(key, value);
}

/**
 * Retrieve an API key from VS Code SecretStorage.
 */
export async function getSecureApiKey(
  secrets: { get(key: string): Thenable<string | undefined> },
  key: string
): Promise<string | undefined> {
  if (_secretStorageCache.has(key)) return _secretStorageCache.get(key);
  const value = await secrets.get(`chainreview.${key}`);
  if (value) _secretStorageCache.set(key, value);
  return value || undefined;
}

/**
 * Initialize secure key storage: migrate any plain-text keys from VS Code settings
 * into SecretStorage, then clear them from settings.
 */
export async function migrateKeysToSecretStorage(
  secrets: { get(key: string): Thenable<string | undefined>; store(key: string, value: string): Thenable<void> }
): Promise<void> {
  try {
    const vscode = require("vscode");
    const config = vscode.workspace.getConfiguration("chainreview");

    for (const [settingName, envName] of [
      ["anthropicApiKey", "ANTHROPIC_API_KEY"],
      ["braveSearchApiKey", "BRAVE_SEARCH_API_KEY"],
    ] as const) {
      const plainTextValue = config.get<string>(settingName);
      if (plainTextValue && plainTextValue.trim()) {
        // Migrate to SecretStorage
        await storeApiKeySecurely(secrets, envName, plainTextValue.trim());
        // Clear from plain-text settings (best-effort — log failures for debugging)
        await config.update(settingName, undefined, vscode.ConfigurationTarget.Global).then(undefined, (err: unknown) => {
          console.warn(`ChainReview: failed to clear global setting "${settingName}":`, err);
        });
        await config.update(settingName, undefined, vscode.ConfigurationTarget.Workspace).then(undefined, (err: unknown) => {
          console.warn(`ChainReview: failed to clear workspace setting "${settingName}":`, err);
        });
      }
    }
  } catch {
    // Not in VS Code context or migration failed — not critical
  }
}

/**
 * Resolve the Anthropic API key from multiple sources (priority order):
 * 1. VS Code SecretStorage (secure, encrypted)
 * 2. VS Code setting: chainreview.anthropicApiKey (legacy, plain-text — warns user)
 * 3. Environment variable: ANTHROPIC_API_KEY
 * 4. .env file in workspace root
 * 5. ~/.anthropic/api_key file
 */
function resolveApiKey(keyName: string, settingName: string): string | undefined {
  // 1. Check SecretStorage cache (populated during activation by migrateKeysToSecretStorage)
  if (_secretStorageCache.has(keyName)) {
    return _secretStorageCache.get(keyName);
  }

  // 2. VS Code settings (legacy fallback — plain text)
  try {
    const vscode = require("vscode");
    const config = vscode.workspace.getConfiguration("chainreview");
    const settingValue = config.get<string>(settingName);
    if (settingValue && settingValue.trim()) {
      console.warn(
        `ChainReview: API key "${settingName}" found in plain-text settings. ` +
        `It will be migrated to secure storage on next activation.`
      );
      return settingValue.trim();
    }
  } catch {
    // Not in VS Code context
  }

  // 3. Environment variable
  if (process.env[keyName]) {
    return process.env[keyName];
  }

  // 4. .env file in workspace root
  try {
    const vscode = require("vscode");
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      const envPath = path.join(workspaceRoot, ".env");
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf-8");
        // Escape the key name for safe regex construction
        const escapedKey = keyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = envContent.match(new RegExp(`^${escapedKey}=(.+)$`, "m"));
        if (match?.[1]) {
          return match[1].trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  } catch {
    // Not available
  }

  // 5. ~/.anthropic/api_key (for ANTHROPIC_API_KEY only)
  if (keyName === "ANTHROPIC_API_KEY") {
    try {
      const home = process.env.HOME || process.env.USERPROFILE || "";
      const keyFile = path.join(home, ".anthropic", "api_key");
      if (fs.existsSync(keyFile)) {
        const key = fs.readFileSync(keyFile, "utf-8").trim();
        if (key) return key;
      }
    } catch {
      // Not available
    }
  }

  return undefined;
}

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

    // Resolve API keys from multiple sources (VS Code settings → env → .env → key file)
    const anthropicKey = resolveApiKey("ANTHROPIC_API_KEY", "anthropicApiKey");
    if (anthropicKey) {
      env.ANTHROPIC_API_KEY = anthropicKey;
    } else {
      console.error(
        "ChainReview: WARNING — ANTHROPIC_API_KEY not found. " +
        "Set it in VS Code settings (chainreview.anthropicApiKey), " +
        "environment variable, .env file, or ~/.anthropic/api_key. " +
        "LLM-powered features (review, chat, validation) will not work."
      );
    }

    const braveKey = resolveApiKey("BRAVE_SEARCH_API_KEY", "braveSearchApiKey");
    if (braveKey) {
      env.BRAVE_SEARCH_API_KEY = braveKey;
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
    mode: "repo" | "diff",
    agents?: string[]
  ): Promise<{
    runId: string;
    findings: Finding[];
    events: AuditEvent[];
    status: string;
    error?: string;
  }> {
    const args: Record<string, unknown> = { repoPath, mode };
    if (agents && agents.length > 0) {
      args.agents = agents;
    }
    const result = await this.callTool("crp.review.run", args);
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

  // ── History Tools ──

  async listRuns(limit = 50): Promise<Array<{
    id: string;
    repoPath: string;
    repoName: string;
    mode: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    findingsCount: number;
    criticalCount: number;
    highCount: number;
  }>> {
    const result = await this.callTool("crp.review.list_runs", { limit });
    return JSON.parse(result);
  }

  async deleteRun(runId: string): Promise<{ deleted: boolean; runId: string }> {
    const result = await this.callTool("crp.review.delete_run", { runId });
    return JSON.parse(result);
  }

  // ── Chat Query ──

  async chatQuery(
    query: string,
    runId?: string,
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
  ): Promise<{ answer: string; toolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string }> }> {
    const args: Record<string, unknown> = { query };
    if (runId) args.runId = runId;
    if (conversationHistory && conversationHistory.length > 0) {
      args.conversationHistory = conversationHistory;
    }
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
    verdict: "still_present" | "partially_fixed" | "fixed" | "unable_to_determine";
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
   *  This aborts the client-side MCP call FIRST (so the UI unblocks immediately),
   *  then sends a cancel signal to the server to abort running agents.
   */
  async cancelReview(): Promise<void> {
    // 1. Abort client-side IMMEDIATELY so _startReview unblocks
    this.cancelActiveOperation();

    // 2. Tell the server to abort running agents (best-effort, don't await)
    try {
      if (this.connected) {
        // Fire-and-forget — don't block on this
        this.client.callTool(
          { name: "crp.review.cancel", arguments: {} },
          undefined,
          { timeout: 5000 } as any
        ).catch(() => {});
      }
    } catch {
      // Best effort — the server might already be winding down
    }
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
      // Handle user cancellation (AbortError) BEFORE timeout — abort can trigger
      // timeout-like errors in the MCP SDK, so check abort signal first.
      if (controller.signal.aborted || err.name === "AbortError" || err.message?.includes("abort")) {
        throw new Error("Operation cancelled by user");
      }
      if (err.code === -32001 || err.message?.includes("timed out")) {
        throw new Error(`Operation timed out after ${timeoutMs / 1000}s — the server may still be processing`);
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
