import { motion } from "motion/react";
import {
  BotIcon,
  CheckCircle2Icon,
  CircleXIcon,
  LoaderCircleIcon,
  LandmarkIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  SettingsIcon,
  BugIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAgentConfig } from "@/lib/constants";
import type { AgentName } from "@/lib/types";

const AGENT_ICONS: Record<AgentName, React.FC<{ className?: string }>> = {
  architecture: LandmarkIcon,
  security: ShieldAlertIcon,
  bugs: BugIcon,
  validator: ShieldCheckIcon,
  explainer: SparklesIcon,
  system: SettingsIcon,
};

interface SubAgentTileProps {
  agent: AgentName;
  event: "started" | "completed" | "error";
  message?: string;
  toolCount?: number;
  findingCount?: number;
}

/**
 * Inline agent row — clean, no card/tile borders.
 * Shows: [icon] Agent Name · status · message  [stats] [spinner/check]
 */
export function SubAgentTile({ agent, event, message, toolCount, findingCount }: SubAgentTileProps) {
  const config = getAgentConfig(agent);
  const AgentIcon = AGENT_ICONS[agent] || BotIcon;

  const isActive = event === "started";
  const isDone = event === "completed";
  const isError = event === "error";

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="flex items-center gap-2 py-1"
    >
      {/* Agent icon — small colored square */}
      <div
        className={cn(
          "flex items-center justify-center size-5 rounded-md shrink-0",
          isActive && config.bgColor,
          isDone && "bg-emerald-500/10",
          isError && "bg-red-500/10"
        )}
      >
        <AgentIcon
          className={cn(
            "size-3",
            isActive && config.color,
            isDone && "text-emerald-400",
            isError && "text-red-400"
          )}
        />
      </div>

      {/* Agent name */}
      <span
        className={cn(
          "text-[12px] font-semibold leading-none",
          isActive && config.color,
          isDone && "text-emerald-300",
          isError && "text-red-300"
        )}
      >
        {config.shortLabel}
      </span>

      {/* Separator + status */}
      <span className="text-[var(--cr-text-ghost)] text-[10px] select-none">·</span>
      <span
        className={cn(
          "text-[10px] font-medium leading-none",
          isActive && "text-[var(--cr-text-tertiary)]",
          isDone && "text-emerald-400/70",
          isError && "text-red-400/70"
        )}
      >
        {isActive && "running"}
        {isDone && "done"}
        {isError && "error"}
      </span>

      {/* Message — truncated */}
      {message && (
        <>
          <span className="text-[var(--cr-text-ghost)] text-[10px] select-none">·</span>
          <span className="text-[10px] text-[var(--cr-text-tertiary)] truncate flex-1 min-w-0">
            {message}
          </span>
        </>
      )}

      {/* Stats + status icon */}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        {toolCount != null && toolCount > 0 && (
          <span className="text-[9px] font-mono text-[var(--cr-text-tertiary)]">
            {toolCount} tools
          </span>
        )}

        {findingCount != null && findingCount > 0 && (
          <span className="text-[9px] font-mono text-amber-400/80">
            {findingCount} findings
          </span>
        )}

        {isActive && (
          <LoaderCircleIcon className="size-3 text-[var(--cr-text-tertiary)] animate-spin" />
        )}
        {isDone && (
          <CheckCircle2Icon className="size-3 text-emerald-400/60" />
        )}
        {isError && (
          <CircleXIcon className="size-3 text-red-400/60" />
        )}
      </div>
    </motion.div>
  );
}
