import type { AgentName, FindingCategory } from "./types";
import { AGENT_LOGOS } from "@/assets/logos";

export type AgentConfigEntry = { label: string; shortLabel: string; color: string; bgColor: string; borderColor: string };

export const DEFAULT_AGENT_CONFIG: AgentConfigEntry = {
  label: "Agent",
  shortLabel: "???",
  color: "text-[var(--cr-text-ghost)]",
  bgColor: "bg-transparent",
  borderColor: "border-transparent",
};

export const AGENT_CONFIG: Record<
  AgentName,
  AgentConfigEntry
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

export type SeverityConfigEntry = { label: string; color: string; bgColor: string };

export const DEFAULT_SEVERITY_CONFIG: SeverityConfigEntry = {
  label: "Unknown",
  color: "text-[var(--cr-text-ghost)]",
  bgColor: "bg-transparent",
};

export const SEVERITY_CONFIG: Record<
  string,
  SeverityConfigEntry
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

export type CategoryConfigEntry = { label: string; color: string; bgColor: string; borderColor: string; icon: string };

export const DEFAULT_CATEGORY_CONFIG: CategoryConfigEntry = {
  label: "Other",
  color: "text-[var(--cr-text-muted)]",
  bgColor: "bg-[var(--cr-bg-tertiary)]",
  borderColor: "border-[var(--cr-border-subtle)]",
  icon: "bug",
};

export const CATEGORY_CONFIG: Record<
  FindingCategory,
  CategoryConfigEntry
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
  iconColor?: string;
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
    iconColor: "text-[var(--cr-text-muted)]",
    color: "text-[var(--cr-text-secondary)]",
  },
  {
    id: "export-markdown",
    label: "Export as Markdown",
    icon: "lucide:file-down",
    iconColor: "text-[var(--cr-text-muted)]",
    color: "text-[var(--cr-text-secondary)]",
  },
  {
    id: "config-more",
    label: "Config more...",
    icon: "lucide:settings",
    iconColor: "text-[var(--cr-text-ghost)]",
    color: "text-[var(--cr-text-muted)]",
  },
];

/** Safe config lookups — never return undefined */
export function getAgentConfig(agent: string): AgentConfigEntry {
  return (AGENT_CONFIG as Record<string, AgentConfigEntry>)[agent] ?? DEFAULT_AGENT_CONFIG;
}

export function getSeverityConfig(severity: string): SeverityConfigEntry {
  return SEVERITY_CONFIG[severity] ?? DEFAULT_SEVERITY_CONFIG;
}

export function getCategoryConfig(category: string): CategoryConfigEntry {
  return (CATEGORY_CONFIG as Record<string, CategoryConfigEntry>)[category] ?? DEFAULT_CATEGORY_CONFIG;
}

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
