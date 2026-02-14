import type { AgentName, FindingCategory, EventType } from "./types";
import { AGENT_LOGOS } from "@/assets/logos";

export const AGENT_CONFIG: Record<
  AgentName,
  { label: string; shortLabel: string; color: string; bgColor: string; borderColor: string }
> = {
  architecture: {
    label: "Architecture Agent",
    shortLabel: "Architecture",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  security: {
    label: "Security Agent",
    shortLabel: "Security",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  bugs: {
    label: "Bugs Agent",
    shortLabel: "Bugs",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/20",
  },
  validator: {
    label: "Validator Agent",
    shortLabel: "Validator",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
  explainer: {
    label: "Explainer Agent",
    shortLabel: "Explainer",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
  },
  system: {
    label: "System",
    shortLabel: "System",
    color: "text-[var(--cr-text-secondary)]",
    bgColor: "bg-[var(--cr-bg-tertiary)]",
    borderColor: "border-[var(--cr-border)]",
  },
};

export const SEVERITY_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  critical: {
    label: "Critical",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  high: {
    label: "High",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
  },
  medium: {
    label: "Medium",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  low: {
    label: "Low",
    color: "text-[var(--cr-text-secondary)]",
    bgColor: "bg-[var(--cr-bg-tertiary)]",
  },
  info: {
    label: "Info",
    color: "text-[var(--cr-text-tertiary)]",
    bgColor: "bg-[var(--cr-bg-tertiary)]",
  },
};

export const CATEGORY_CONFIG: Record<
  FindingCategory,
  { label: string; color: string; bgColor: string; borderColor: string; icon: string }
> = {
  bugs: {
    label: "Bug",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/20",
    icon: "bug",
  },
  security: {
    label: "Security",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    icon: "shield",
  },
  architecture: {
    label: "Architecture",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    icon: "landmark",
  },
};

// Coding agents for "Handoff To" dropdown
// icon field: asset URL (from logos/) for real logos, or "lucide:<name>" for lucide-react icons
export const CODING_AGENTS: Array<{
  id: string;
  label: string;
  icon: string;
  color: string;
  suffix?: string;
  separator?: boolean;
}> = [
  {
    id: "claude-code",
    label: "Claude Code",
    icon: AGENT_LOGOS["claude-code"],
    color: "text-[var(--cr-text-primary)]",
  },
  {
    id: "kilo-code",
    label: "Kilo Code",
    icon: AGENT_LOGOS["kilo-code"],
    color: "text-[var(--cr-text-primary)]",
  },
  {
    id: "gemini-cli",
    label: "Gemini CLI",
    icon: AGENT_LOGOS["gemini-cli"],
    color: "text-[var(--cr-text-primary)]",
    suffix: "CLI",
  },
  {
    id: "codex-cli",
    label: "Codex CLI",
    icon: AGENT_LOGOS["codex-cli"],
    color: "text-[var(--cr-text-primary)]",
    suffix: "CLI",
  },
  {
    id: "cursor",
    label: "Cursor",
    icon: AGENT_LOGOS["cursor"],
    color: "text-[var(--cr-text-primary)]",
  },
  // ── Separator ──
  {
    id: "__sep__",
    label: "",
    icon: "",
    color: "",
    separator: true,
  },
  {
    id: "clipboard",
    label: "Copy",
    icon: "lucide:clipboard-copy",
    color: "text-[var(--cr-text-secondary)]",
  },
  {
    id: "export-markdown",
    label: "Export as Markdown",
    icon: "lucide:file-down",
    color: "text-[var(--cr-text-secondary)]",
  },
  {
    id: "config-more",
    label: "Config more...",
    icon: "lucide:settings",
    color: "text-[var(--cr-text-muted)]",
  },
];

/** Safe config lookups — never return undefined */
export function getAgentConfig(agent: string) {
  return (AGENT_CONFIG as Record<string, (typeof AGENT_CONFIG)[AgentName]>)[agent] ?? {
    label: "Agent",
    shortLabel: "???",
    color: "text-[var(--cr-text-ghost)]",
    bgColor: "bg-transparent",
    borderColor: "border-transparent",
  };
}

export function getSeverityConfig(severity: string) {
  return SEVERITY_CONFIG[severity] ?? {
    label: "Unknown",
    color: "text-[var(--cr-text-ghost)]",
    bgColor: "bg-transparent",
  };
}

export function getCategoryConfig(category: string) {
  return (CATEGORY_CONFIG as Record<string, (typeof CATEGORY_CONFIG)[FindingCategory]>)[category] ?? {
    label: "Other",
    color: "text-[var(--cr-text-muted)]",
    bgColor: "bg-[var(--cr-bg-tertiary)]",
    borderColor: "border-[var(--cr-border-subtle)]",
    icon: "bug",
  };
}

/** Only these event types are meaningful milestones shown in the timeline */
export const MILESTONE_EVENTS: Set<EventType> = new Set([
  "agent_started",
  "finding_emitted",
  "patch_proposed",
  "patch_validated",
  "human_accepted",
  "human_rejected",
  "false_positive_marked",
]);

export const EVENT_LABELS: Record<string, string> = {
  agent_started: "Agent Started",
  evidence_collected: "Evidence Collected",
  finding_emitted: "Finding Emitted",
  patch_proposed: "Patch Proposed",
  patch_validated: "Patch Validated",
  human_accepted: "Accepted",
  human_rejected: "Rejected",
  false_positive_marked: "Marked False Positive",
};
