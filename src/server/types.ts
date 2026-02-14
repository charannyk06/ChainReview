// ── Server-side Type Definitions ──

export type ReviewMode = "repo" | "diff";
export type AgentName = "architecture" | "security" | "bugs" | "validator" | "explainer" | "system";
export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingCategory = "architecture" | "security" | "bugs";
export type FindingStatus = "active" | "dismissed" | "resolved";

export type EventType =
  | "agent_started"
  | "agent_completed"
  | "evidence_collected"
  | "finding_emitted"
  | "finding_explained"
  | "patch_proposed"
  | "patch_validated"
  | "human_accepted"
  | "human_rejected"
  | "false_positive_marked";

// ── Review Run ──

export interface ReviewRun {
  id: string;
  repoPath: string;
  mode: ReviewMode;
  status: "running" | "complete" | "error";
  startedAt: string;
  completedAt?: string;
}

// ── Evidence Types ──

export interface Evidence {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
}

// ── Finding ──

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
  fingerprint?: string;
  status?: FindingStatus;
}

// ── Agent Finding (before ID assignment) ──

export interface AgentFinding {
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  confidence: number;
  evidence: Evidence[];
}

// ── Patch ──

export interface Patch {
  id: string;
  findingId: string;
  diff: string;
  validated: boolean;
  validationMessage?: string;
}

// ── Audit Event ──

export interface AuditEvent {
  id: string;
  type: EventType;
  agent?: AgentName;
  timestamp: string;
  data: Record<string, unknown>;
}

// ── Import Graph ──

export interface ImportGraphNode {
  file: string;
  imports: string[];
}

export interface ImportGraphResult {
  nodes: ImportGraphNode[];
  cycles: string[][];
  entryPoints: string[];
  totalFiles: number;
}

// ── Semgrep ──

export interface SemgrepResult {
  ruleId: string;
  severity: string;
  message: string;
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
}

// ── Agent Context ──

export interface AgentContext {
  repoPath: string;
  mode: ReviewMode;
  runId: string;
  fileTree: string[];
  importGraph?: ImportGraphResult;
  semgrepResults?: SemgrepResult[];
  diffContent?: string;
  /** Summary of prior active findings for this repo — agents should skip these */
  priorFindings?: string;
}

// ── Callbacks for streaming progress ──

export interface ReviewCallbacks {
  onEvent: (event: AuditEvent) => void;
  onFinding: (finding: Finding) => void;
  onToolCall: (agent: AgentName, tool: string, args: Record<string, unknown>) => void;
  onToolResult: (agent: AgentName, tool: string, result: string) => void;
  onText: (agent: AgentName, text: string, done: boolean) => void;
  onPatch: (patch: Patch) => void;
}
