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
  WrenchIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENT_CONFIG } from "@/lib/constants";
import type { AgentName } from "@/lib/types";

const AGENT_ICONS: Record<AgentName, React.FC<{ className?: string }>> = {
  architecture: LandmarkIcon,
  security: ShieldAlertIcon,
  validator: ShieldCheckIcon,
  system: SettingsIcon,
};

interface SubAgentTileProps {
  agent: AgentName;
  event: "started" | "completed" | "error";
  message?: string;
  toolCount?: number;
  findingCount?: number;
}

export function SubAgentTile({ agent, event, message, toolCount, findingCount }: SubAgentTileProps) {
  const config = AGENT_CONFIG[agent];
  const AgentIcon = AGENT_ICONS[agent] || BotIcon;

  const isActive = event === "started";
  const isDone = event === "completed";
  const isError = event === "error";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "relative flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all duration-200",
        isActive && "border-[var(--cr-border-strong)] bg-[var(--cr-bg-secondary)]",
        isDone && "border-emerald-500/15 bg-emerald-500/[0.03]",
        isError && "border-red-500/15 bg-red-500/[0.03]"
      )}
    >
      {/* Agent icon */}
      <div
        className={cn(
          "relative flex items-center justify-center size-7 rounded-lg shrink-0 transition-colors",
          isActive && config.bgColor,
          isDone && "bg-emerald-500/8",
          isError && "bg-red-500/8"
        )}
      >
        <AgentIcon
          className={cn(
            "size-3.5 transition-colors",
            isActive && config.color,
            isDone && "text-emerald-400",
            isError && "text-red-400"
          )}
        />
      </div>

      {/* Name + status */}
      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[11px] font-semibold leading-none",
              isActive && config.color,
              isDone && "text-emerald-300",
              isError && "text-red-300"
            )}
          >
            {config.shortLabel}
          </span>

          <span
            className={cn(
              "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full",
              isActive && "text-[var(--cr-text-muted)] bg-[var(--cr-bg-tertiary)]",
              isDone && "text-emerald-400/80 bg-emerald-500/8",
              isError && "text-red-400/80 bg-red-500/8"
            )}
          >
            {isActive && "Running"}
            {isDone && "Done"}
            {isError && "Error"}
          </span>
        </div>

        {message && (
          <span className="text-[10px] text-[var(--cr-text-muted)] truncate leading-tight">
            {message}
          </span>
        )}
      </div>

      {/* Stats + status icon */}
      <div className="flex items-center gap-1.5 shrink-0">
        {toolCount != null && toolCount > 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--cr-bg-tertiary)] border border-[var(--cr-border-subtle)]">
            <WrenchIcon className="size-2.5 text-[var(--cr-text-muted)]" />
            <span className="text-[9px] font-mono font-medium text-[var(--cr-text-tertiary)]">
              {toolCount}
            </span>
          </div>
        )}

        {findingCount != null && findingCount > 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/8 border border-amber-500/15">
            <AlertTriangleIcon className="size-2.5 text-amber-400/80" />
            <span className="text-[9px] font-mono font-medium text-amber-400/80">
              {findingCount}
            </span>
          </div>
        )}

        {isActive && (
          <LoaderCircleIcon className="size-3.5 text-[var(--cr-text-muted)] animate-spin" />
        )}
        {isDone && (
          <CheckCircle2Icon className="size-3.5 text-emerald-400/70" />
        )}
        {isError && (
          <CircleXIcon className="size-3.5 text-red-400/70" />
        )}
      </div>
    </motion.div>
  );
}
