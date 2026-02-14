import {
  BotIcon,
  BugIcon,
  BookOpenIcon,
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
import { getAgentConfig } from "@/lib/constants";
import type { AgentName } from "@/lib/types";

const AGENT_ICONS: Record<AgentName, React.FC<{ className?: string }>> = {
  architecture: LandmarkIcon,
  security: ShieldAlertIcon,
  bugs: BugIcon,
  validator: ShieldCheckIcon,
  explainer: BookOpenIcon,
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
  const config = getAgentConfig(agent);
  const AgentIcon = AGENT_ICONS[agent] || BotIcon;

  const isActive = event === "started";
  const isDone = event === "completed";
  const isError = event === "error";

  return (
    <div className="flex items-center gap-2 py-1.5">
      {/* Agent icon — small circle */}
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
            isDone && "text-emerald-400/80",
            isError && "text-red-400/80"
          )}
        />
      </div>

      {/* Agent name */}
      <span
        className={cn(
          "text-[11px] font-semibold",
          isActive && config.color,
          isDone && "text-emerald-300/80",
          isError && "text-red-300/80"
        )}
      >
        {config.shortLabel}
      </span>

      {/* Status text — subtle */}
      {message && (
        <>
          <span className="text-[var(--cr-text-ghost)]">&middot;</span>
          <span className="text-[10px] text-[var(--cr-text-muted)] truncate min-w-0">
            {message}
          </span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Stats badges — compact */}
      {toolCount != null && toolCount > 0 && (
        <div className="flex items-center gap-0.5 text-[var(--cr-text-ghost)]">
          <WrenchIcon className="size-2.5" />
          <span className="text-[9px] font-mono tabular-nums">{toolCount}</span>
        </div>
      )}

      {findingCount != null && findingCount > 0 && (
        <div className="flex items-center gap-0.5 text-amber-400/60">
          <AlertTriangleIcon className="size-2.5" />
          <span className="text-[9px] font-mono tabular-nums">{findingCount}</span>
        </div>
      )}

      {/* Spinner / Done / Error */}
      {isActive && (
        <LoaderCircleIcon className="size-3 text-[var(--cr-text-muted)] animate-spin shrink-0" />
      )}
      {isDone && (
        <CheckCircle2Icon className="size-3 text-emerald-400/60 shrink-0" />
      )}
      {isError && (
        <CircleXIcon className="size-3 text-red-400/60 shrink-0" />
      )}
    </div>
  );
}
