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
  | "patch_generated"
  | "human_accepted"
  | "human_rejected"
  | "false_positive_marked"
  | "issue_fixed"
  | "handoff_to_agent"
  | "validation_completed";

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

// ── Call Graph ──

export interface CallGraphEdge {
  sourceFile: string;
  sourceSymbol: string;
  targetFile: string;
  targetSymbol: string;
  callLine: number;
}

export interface FileMetrics {
  file: string;
  fanIn: number;
  fanOut: number;
  symbolCount: number;
  exportedSymbolCount: number;
}

export interface CallGraphResult {
  edges: CallGraphEdge[];
  fileMetrics: FileMetrics[];
  totalFunctions: number;
  totalEdges: number;
}

// ── Symbol Lookup ──

export interface SymbolLocation {
  file: string;
  line: number;
  column: number;
  kind: string; // "function" | "method" | "class" | "variable" | "interface" | "type"
}

export interface SymbolLookupResult {
  name: string;
  definition: SymbolLocation | null;
  references: SymbolLocation[];
  totalReferences: number;
  exported: boolean;
}

// ── Impact Analysis ──

export interface ImpactedFile {
  file: string;
  distance: number;
  fanIn: number;
  affectedSymbols: string[];
}

export interface ImpactResult {
  sourceFile: string;
  impactedFiles: ImpactedFile[];
  totalImpacted: number;
  maxDepth: number;
}

// ── Module Criticality ──

export interface CriticalFile {
  file: string;
  score: number; // 0-1
  fanIn: number;
  fanOut: number;
  reason: string;
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
  /** Function-level call graph for deep structural understanding */
  callGraph?: CallGraphResult;
  /** Files ranked by architectural criticality (fan-in/fan-out scoring) */
  criticalFiles?: CriticalFile[];
  /** Files impacted by the current diff (blast radius analysis) */
  impactedModules?: ImpactedFile[];
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
