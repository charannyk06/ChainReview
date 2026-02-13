import type { AgentName, FindingCategory } from "./types";

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
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
  },
  validator: {
    label: "Validator Agent",
    shortLabel: "Validator",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
  },
  system: {
    label: "System",
    shortLabel: "System",
    color: "text-neutral-400",
    bgColor: "bg-neutral-500/10",
    borderColor: "border-neutral-500/20",
  },
};

export const SEVERITY_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  critical: {
    label: "CRITICAL",
    color: "text-red-300",
    bgColor: "bg-red-500/20",
  },
  high: {
    label: "HIGH",
    color: "text-orange-300",
    bgColor: "bg-orange-500/20",
  },
  medium: {
    label: "MEDIUM",
    color: "text-yellow-300",
    bgColor: "bg-yellow-500/20",
  },
  low: {
    label: "LOW",
    color: "text-blue-300",
    bgColor: "bg-blue-500/20",
  },
  info: {
    label: "INFO",
    color: "text-gray-300",
    bgColor: "bg-gray-500/20",
  },
};

export const CATEGORY_CONFIG: Record<
  FindingCategory,
  { label: string; color: string; bgColor: string; borderColor: string; icon: string }
> = {
  bugs: {
    label: "Bug",
    color: "text-red-400",
    bgColor: "bg-red-500/15",
    borderColor: "border-red-500/30",
    icon: "bug",
  },
  security: {
    label: "Security",
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
    borderColor: "border-blue-500/30",
    icon: "shield",
  },
  architecture: {
    label: "Architecture",
    color: "text-purple-400",
    bgColor: "bg-purple-500/15",
    borderColor: "border-purple-500/30",
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
    id: "config-more",
    label: "Config more...",
    icon: "",
    color: "text-neutral-400",
  },
  {
    id: "kilo-code",
    label: "Kilo Code",
    icon: "https://cdn.simpleicons.org/visualstudiocode/white",
    color: "text-purple-300",
  },
  {
    id: "gemini-cli",
    label: "Gemini CLI",
    icon: "https://cdn.simpleicons.org/google/white",
    color: "text-blue-300",
    suffix: ".sh",
  },
  {
    id: "codex-cli",
    label: "Codex CLI",
    icon: "https://cdn.simpleicons.org/openai/white",
    color: "text-emerald-300",
    suffix: ".sh",
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
    icon: "",
    color: "text-neutral-400",
  },
  {
    id: "export-markdown",
    label: "Export as Markdown",
    icon: "",
    color: "text-neutral-400",
  },
  {
    id: "cursor",
    label: "Cursor",
    icon: "https://cursor.sh/brand/icon.svg",
    color: "text-blue-300",
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
