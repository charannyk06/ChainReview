import { motion } from "motion/react";
import {
  RocketIcon,
  ClipboardListIcon,
  BandageIcon,
  ShieldCheckIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  BanIcon,
  PinIcon,
  LandmarkIcon,
  ShieldAlertIcon,
  SettingsIcon,
  BugIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAgentConfig, EVENT_LABELS } from "@/lib/constants";
import type { AuditEvent, AgentName } from "@/lib/types";

interface TimelineEventProps {
  event: AuditEvent;
  index: number;
}

const EVENT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  agent_started: RocketIcon,
  finding_emitted: ClipboardListIcon,
  patch_proposed: BandageIcon,
  patch_validated: ShieldCheckIcon,
  human_accepted: ThumbsUpIcon,
  human_rejected: ThumbsDownIcon,
  false_positive_marked: BanIcon,
};

const EVENT_COLORS: Record<string, string> = {
  agent_started: "bg-indigo-500",
  finding_emitted: "bg-orange-500",
  patch_proposed: "bg-purple-500",
  patch_validated: "bg-emerald-500",
  human_accepted: "bg-emerald-400",
  human_rejected: "bg-red-400",
  false_positive_marked: "bg-[var(--cr-text-muted)]",
};

const AGENT_ICONS: Record<AgentName, React.FC<{ className?: string }>> = {
  architecture: LandmarkIcon,
  security: ShieldAlertIcon,
  bugs: BugIcon,
  validator: ShieldCheckIcon,
  explainer: SparklesIcon,
  system: SettingsIcon,
};

/** Keys to hide from the data display — internal implementation details */
const HIDDEN_DATA_KEYS = new Set([
  "kind", "event", "tool", "args", "resultSummary",
  "toolCallId", "blockId", "agentName",
]);

/** Extract a meaningful summary line from the event data */
function getEventSummary(event: AuditEvent): string | null {
  const data = event.data ?? {};

  switch (event.type) {
    case "agent_started":
      return (data?.message as string) || null;
    case "finding_emitted": {
      const title = data?.title as string;
      const severity = data?.severity as string;
      return title ? `${severity ? `[${severity.toUpperCase()}] ` : ""}${title}` : null;
    }
    case "patch_proposed":
      return (data?.filePath as string) || (data?.description as string) || null;
    case "patch_validated": {
      const original = data?.originalConfidence as number | undefined;
      const validated = data?.validatedConfidence as number | undefined;
      const title = data?.title as string | undefined;
      if (original != null && validated != null) {
        const delta = validated - original;
        const arrow = delta > 0 ? "+" : "";
        return `${title ? title + " — " : ""}Confidence: ${(original * 100).toFixed(0)}% → ${(validated * 100).toFixed(0)}% (${arrow}${(delta * 100).toFixed(0)}%)`;
      }
      return title ? `Validated: ${title}` : "Finding validated";
    }
    case "human_accepted":
    case "human_rejected":
      return (data?.patchId as string) ? `Patch: ${(data.patchId as string).slice(0, 12)}...` : null;
    case "false_positive_marked":
      return (data?.findingId as string) ? `Finding marked as false positive` : null;
    default:
      return null;
  }
}

export function TimelineEvent({ event, index }: TimelineEventProps) {
  const agentConfig = event.agent ? getAgentConfig(event.agent) : null;
  const time = new Date(event.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const EventIcon = EVENT_ICONS[event.type] || PinIcon;
  const AgentIcon = event.agent ? AGENT_ICONS[event.agent] : null;
  const summary = getEventSummary(event);

  // Filter event data to only show useful fields (guard against undefined/null data)
  const displayData = Object.entries(event.data ?? {}).filter(
    ([key]) => !HIDDEN_DATA_KEYS.has(key)
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.5), duration: 0.2 }}
      className="flex gap-3.5"
    >
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={cn(
            "w-2.5 h-2.5 rounded-full mt-1.5 ring-2 ring-[var(--cr-bg-primary)]",
            EVENT_COLORS[event.type] || "bg-[var(--cr-text-muted)]"
          )}
        />
        <div className="w-px flex-1 bg-[var(--cr-border-subtle)] mt-1" />
      </div>

      {/* Event content */}
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1">
          <EventIcon className="size-3.5 text-[var(--cr-text-muted)] shrink-0" />
          <span className="text-[12px] font-semibold text-[var(--cr-text-primary)]">
            {EVENT_LABELS[event.type] || event.type}
          </span>
          {agentConfig && AgentIcon && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium",
                agentConfig.color
              )}
            >
              <AgentIcon className="size-2.5" />
              {agentConfig.shortLabel}
            </span>
          )}
          <span className="text-[10px] text-[var(--cr-text-ghost)] ml-auto shrink-0 font-mono">
            {time}
          </span>
        </div>

        {/* Summary line */}
        {summary && (
          <p className="text-[11px] text-[var(--cr-text-muted)] mt-1 truncate">
            {summary}
          </p>
        )}

        {/* Filtered event data — only show if there are non-internal fields */}
        {displayData.length > 0 && !summary && (
          <div className="mt-1.5 text-[11px] text-[var(--cr-text-muted)] bg-[var(--cr-bg-tertiary)] rounded-lg px-3 py-2 border border-[var(--cr-border-subtle)]">
            {displayData.slice(0, 3).map(([key, val]) => (
              <div key={key} className="flex gap-2">
                <span className="text-[var(--cr-text-ghost)] shrink-0">{key}:</span>
                <span className="truncate text-[var(--cr-text-muted)]">
                  {typeof val === "string"
                    ? val.length > 60 ? val.slice(0, 60) + "..." : val
                    : JSON.stringify(val)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
