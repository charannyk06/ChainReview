// Extension-side type definitions
// Mirrors the server types for the extension host context

export type ReviewMode = "repo" | "diff";
export type AgentName = "architecture" | "security" | "validator" | "bugs" | "explainer" | "system";
export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingCategory = "architecture" | "security" | "bugs";

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

export interface Evidence {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
}

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

export interface Patch {
  id: string;
  findingId: string;
  diff: string;
  validated: boolean;
  validationMessage?: string;
}

export interface AuditEvent {
  id: string;
  type: EventType;
  agent?: AgentName;
  timestamp: string;
  data: Record<string, unknown>;
}
