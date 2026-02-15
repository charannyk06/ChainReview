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
import { getAgentConfig, getAgentInlineColors } from "@/lib/constants";
import type { AgentName } from "@/lib/types";

const AGENT_ICONS: Record<AgentName, React.FC<{ style?: React.CSSProperties }>> = {
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
  const colors = getAgentInlineColors(agent);
  const AgentIcon = AGENT_ICONS[agent] || BotIcon;

  const isActive = event === "started";
  const isDone = event === "completed";
  const isError = event === "error";

  const iconColor = isActive ? colors.color
    : isDone ? "rgba(52,211,153,0.80)"
    : isError ? "rgba(248,113,113,0.80)"
    : "var(--cr-text-ghost)";

  const iconBg = isActive ? colors.bgColor
    : isDone ? "rgba(16,185,129,0.10)"
    : isError ? "rgba(239,68,68,0.10)"
    : "transparent";

  const nameColor = isActive ? colors.color
    : isDone ? "rgba(110,231,183,0.80)"
    : isError ? "rgba(252,165,165,0.80)"
    : "var(--cr-text-muted)";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 0",
    }}>
      {/* Agent icon — small rounded square */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        borderRadius: 6,
        flexShrink: 0,
        background: iconBg,
      }}>
        <AgentIcon style={{ width: 12, height: 12, color: iconColor }} />
      </div>

      {/* Agent name */}
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: nameColor,
      }}>
        {config.shortLabel}
      </span>

      {/* Status text — subtle */}
      {message && (
        <>
          <span style={{ color: "var(--cr-text-ghost)" }}>&middot;</span>
          <span style={{
            fontSize: 10,
            color: "var(--cr-text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}>
            {message}
          </span>
        </>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Stats badges — compact */}
      {toolCount != null && toolCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, color: "var(--cr-text-ghost)" }}>
          <WrenchIcon style={{ width: 10, height: 10 }} />
          <span style={{ fontSize: 9, fontFamily: "var(--cr-font-mono)", fontVariantNumeric: "tabular-nums" }}>{toolCount}</span>
        </div>
      )}

      {findingCount != null && findingCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, color: "rgba(251,191,36,0.60)" }}>
          <AlertTriangleIcon style={{ width: 10, height: 10 }} />
          <span style={{ fontSize: 9, fontFamily: "var(--cr-font-mono)", fontVariantNumeric: "tabular-nums" }}>{findingCount}</span>
        </div>
      )}

      {/* Spinner / Done / Error */}
      {isActive && (
        <LoaderCircleIcon style={{
          width: 12,
          height: 12,
          color: "var(--cr-text-muted)",
          animation: "spin 1s linear infinite",
          flexShrink: 0,
        }} />
      )}
      {isDone && (
        <CheckCircle2Icon style={{ width: 12, height: 12, color: "rgba(52,211,153,0.60)", flexShrink: 0 }} />
      )}
      {isError && (
        <CircleXIcon style={{ width: 12, height: 12, color: "rgba(248,113,113,0.60)", flexShrink: 0 }} />
      )}
    </div>
  );
}
