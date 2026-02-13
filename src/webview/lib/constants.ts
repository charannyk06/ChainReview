import type { AgentName, FindingCategory } from "./types";

export const AGENT_CONFIG: Record<
  AgentName,
  { label: string; shortLabel: string; color: string; bgColor: string; borderColor: string }
> = {
  architecture: {
    label: "Architecture Agent",
    shortLabel: "Arch",
    color: "text-[var(--cr-text-muted)]",
    bgColor: "bg-transparent",
    borderColor: "border-transparent",
  },
  security: {
    label: "Security Agent",
    shortLabel: "Sec",
    color: "text-[var(--cr-text-muted)]",
    bgColor: "bg-transparent",
    borderColor: "border-transparent",
  },
  validator: {
    label: "Validator Agent",
    shortLabel: "Val",
    color: "text-[var(--cr-text-muted)]",
    bgColor: "bg-transparent",
    borderColor: "border-transparent",
  },
  system: {
    label: "System",
    shortLabel: "Sys",
    color: "text-[var(--cr-text-ghost)]",
    bgColor: "bg-transparent",
    borderColor: "border-transparent",
  },
};

export const SEVERITY_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  critical: {
    label: "Critical",
    color: "text-[var(--cr-text-secondary)]",
    bgColor: "bg-transparent",
  },
  high: {
    label: "High",
    color: "text-[var(--cr-text-secondary)]",
    bgColor: "bg-transparent",
  },
  medium: {
    label: "Medium",
    color: "text-[var(--cr-text-muted)]",
    bgColor: "bg-transparent",
  },
  low: {
    label: "Low",
    color: "text-[var(--cr-text-muted)]",
    bgColor: "bg-transparent",
  },
  info: {
    label: "Info",
    color: "text-[var(--cr-text-ghost)]",
    bgColor: "bg-transparent",
  },
};

export const CATEGORY_CONFIG: Record<
  FindingCategory,
  { label: string; color: string; bgColor: string; borderColor: string; icon: string }
> = {
  bugs: {
    label: "Bug",
    color: "text-[var(--cr-text-muted)]",
    bgColor: "bg-[var(--cr-bg-tertiary)]",
    borderColor: "border-[var(--cr-border-subtle)]",
    icon: "bug",
  },
  security: {
    label: "Security",
    color: "text-[var(--cr-text-muted)]",
    bgColor: "bg-[var(--cr-bg-tertiary)]",
    borderColor: "border-[var(--cr-border-subtle)]",
    icon: "shield",
  },
  architecture: {
    label: "Architecture",
    color: "text-[var(--cr-text-muted)]",
    bgColor: "bg-[var(--cr-bg-tertiary)]",
    borderColor: "border-[var(--cr-border-subtle)]",
    icon: "landmark",
  },
};

// Coding agents for "Handoff To" dropdown
export const CODING_AGENTS: Array<{
  id: string;
  label: string;
  icon: string;
  color: string;
  suffix?: string;
  separator?: boolean;
}> = [
  {
    id: "kilo-code",
    label: "Kilo Code",
    icon: "https://cdn.simpleicons.org/visualstudiocode/white",
    color: "text-orange-200",
  },
  {
    id: "gemini-cli",
    label: "Gemini CLI",
    icon: "https://cdn.simpleicons.org/google/white",
    color: "text-orange-200",
    suffix: ".sh",
  },
  {
    id: "codex-cli",
    label: "Codex CLI",
    icon: "https://cdn.simpleicons.org/openai/white",
    color: "text-orange-200",
    suffix: ".sh",
  },
  {
    id: "cursor",
    label: "Cursor",
    icon: "https://cursor.sh/brand/icon.svg",
    color: "text-orange-200",
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
    label: "Copy to Clipboard",
    icon: "",
    color: "text-[var(--cr-text-muted)]",
  },
  {
    id: "export-markdown",
    label: "Export as Markdown",
    icon: "",
    color: "text-[var(--cr-text-muted)]",
  },
  {
    id: "config-more",
    label: "Configure Agents…",
    icon: "",
    color: "text-[var(--cr-text-ghost)]",
  },
];

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
