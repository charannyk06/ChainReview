// ── Review Types ──

export type ReviewMode = "repo" | "diff";

export type AgentName = "architecture" | "security" | "bugs" | "validator" | "explainer" | "system";

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export type FindingCategory = "architecture" | "security" | "bugs";

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  agent: AgentName;
  confidence: number;
  evidence: Evidence[];
  patchId?: string;
}

export interface Evidence {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
}

// ── Patch Types ──

export interface Patch {
  id: string;
  findingId: string;
  diff: string;
  validated: boolean;
  validationMessage?: string;
}

// ── Audit Event Types ──

export type EventType =
  | "agent_started"
  | "evidence_collected"
  | "finding_emitted"
  | "patch_proposed"
  | "patch_validated"
  | "human_accepted"
  | "human_rejected"
  | "false_positive_marked";

export interface AuditEvent {
  id: string;
  type: EventType;
  agent?: AgentName;
  timestamp: string;
  data: Record<string, unknown>;
}

// ── MCP Server Types ──

export type MCPServerStatus = "connected" | "disconnected" | "error" | "connecting";

export interface MCPServerTool {
  name: string;
  description: string;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export interface MCPServerInfo {
  id: string;
  name: string;
  status: MCPServerStatus;
  tools: MCPServerTool[];
  config: MCPServerConfig;
  error?: string;
}

// ── ContentBlock System (Shadower-1 style) ──

export type ToolIcon =
  | "search"
  | "file"
  | "tree"
  | "git-diff"
  | "shield"
  | "graph"
  | "terminal"
  | "check"
  | "brain"
  | "scan"
  | "bug"
  | "web";

export interface TextBlock {
  kind: "text";
  id: string;
  text: string;
  format?: "plain" | "markdown";
  timestamp: string;
}

export interface ThinkingBlock {
  kind: "thinking";
  id: string;
  text: string;
  collapsed?: boolean;
  timestamp: string;
}

export interface ToolCallBlock {
  kind: "tool_call";
  id: string;
  tool: string;
  displayName: string;
  icon: ToolIcon;
  args: Record<string, unknown>;
  argsSummary: string;
  status: "running" | "done" | "error";
  result?: string;
  duration?: number;
  timestamp: string;
}

export interface SubAgentEventBlock {
  kind: "sub_agent_event";
  id: string;
  agent: AgentName;
  event: "started" | "completed" | "error";
  message?: string;
  timestamp: string;
}

export interface FindingCardBlock {
  kind: "finding_card";
  id: string;
  finding: Finding;
  timestamp: string;
}

export interface StatusBlock {
  kind: "status";
  id: string;
  text: string;
  level: "info" | "warning" | "error" | "success";
  step?: string;
  timestamp: string;
}

export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolCallBlock
  | SubAgentEventBlock
  | FindingCardBlock
  | StatusBlock;

// ── Conversation Messages (blocks-based) ──

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  agent?: AgentName;
  blocks: ContentBlock[];
  status: "streaming" | "complete";
  timestamp: string;
}

// ── Review History ──

export interface ReviewRunSummary {
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
}

// ── postMessage Protocol ──

// Webview → Extension
export type WebviewMessage =
  | { type: "startReview"; mode: ReviewMode; path?: string }
  | { type: "cancelReview" }
  | { type: "chatQuery"; query: string; agents?: string[]; targetPath?: string }
  | { type: "requestPatch"; findingId: string }
  | { type: "applyPatch"; patchId: string }
  | { type: "dismissPatch"; patchId: string }
  | { type: "markFalsePositive"; findingId: string }
  | { type: "sendToValidator"; findingId: string }
  | { type: "explainFinding"; findingId: string }
  | { type: "sendToCodingAgent"; findingId: string; agentId: string }
  | { type: "openFile"; filePath: string; line?: number }
  | { type: "openMCPManager" }
  | { type: "mcpGetServers" }
  | { type: "mcpAddServer"; config: MCPServerConfig }
  | { type: "mcpUpdateServer"; config: MCPServerConfig }
  | { type: "mcpRemoveServer"; serverId: string }
  | { type: "mcpToggleServer"; serverId: string; enabled: boolean }
  | { type: "mcpRefreshServer"; serverId: string }
  | { type: "getReviewHistory" }
  | { type: "deleteReviewRun"; runId: string }
  | { type: "loadReviewRun"; runId: string }
  | { type: "clearChat" }
  | { type: "persistMessages"; messages: ConversationMessage[] };

// Extension → Webview
export type ValidatorVerdict = "still_present" | "partially_fixed" | "fixed" | "unable_to_determine";

export type ExtensionMessage =
  | { type: "reviewStarted"; mode: ReviewMode }
  | { type: "reviewCancelled" }
  | { type: "addBlock"; block: ContentBlock; agent?: AgentName }
  | { type: "updateBlock"; blockId: string; updates: Partial<ToolCallBlock> }
  | { type: "chatResponseStart"; messageId: string }
  | { type: "chatResponseBlock"; messageId: string; block: ContentBlock }
  | { type: "chatResponseEnd"; messageId: string }
  | { type: "finding"; finding: Finding }
  | { type: "addEvent"; event: AuditEvent }
  | { type: "patchReady"; patch: Patch }
  | { type: "reviewComplete"; findings: Finding[]; events: AuditEvent[] }
  | { type: "reviewError"; error: string }
  | { type: "findingValidated"; findingId: string; verdict: ValidatorVerdict; reasoning: string }
  | { type: "findingValidationError"; findingId: string; error: string }
  | { type: "falsePositiveMarked"; findingId: string }
  | { type: "switchTab"; tab: "chat" | "findings" | "timeline" }
  | { type: "mcpManagerOpen" }
  | { type: "mcpServers"; servers: MCPServerInfo[] }
  | { type: "mcpServerUpdated"; server: MCPServerInfo }
  | { type: "mcpServerRemoved"; serverId: string }
  | { type: "reviewHistory"; runs: ReviewRunSummary[] }
  | { type: "injectUserMessage"; text: string }
  | { type: "restoreMessages"; messages: ConversationMessage[] }
  | { type: "restoreReviewState"; findings: Finding[]; events: AuditEvent[]; status: string; mode?: string }
  | { type: "requestPersistMessages" };

// ── Review State ──

export type ReviewStatus = "idle" | "running" | "complete" | "error" | "chatting";

export interface ValidationResult {
  verdict: ValidatorVerdict;
  reasoning: string;
}

export interface ReviewState {
  status: ReviewStatus;
  mode?: ReviewMode;
  messages: ConversationMessage[];
  findings: Finding[];
  patches: Patch[];
  events: AuditEvent[];
  error?: string;
  mcpManagerOpen?: boolean;
  mcpServers?: MCPServerInfo[];
  /** Maps findingId → validation result from the validator agent */
  validationVerdicts: Record<string, ValidationResult>;
  /** Set of findingIds currently being validated */
  validatingFindings: Set<string>;
  /** Task history overlay state */
  historyOpen?: boolean;
  reviewHistory?: ReviewRunSummary[];
  /** Finding IDs dismissed as false positive — persists across state restores */
  dismissedFindingIds: Set<string>;
}
