import { PlusIcon, ServerIcon, ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onNewThread?: () => void;
  onOpenMCPManager?: () => void;
  onOpenHistory?: () => void;
  className?: string;
}

/* Anthropic sparkle logo — inline SVG */
function AnthropicLogo({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M147.487 28H181.749L256 228H221.738L147.487 28Z"
        fill="#D4A27F"
      />
      <path
        d="M74.2507 28H108.513L182.764 228H148.502L74.2507 28Z"
        fill="#D4A27F"
      />
    </svg>
  );
}

export function Header({ onNewThread, onOpenMCPManager, onOpenHistory, className }: HeaderProps) {
  return (
    <div
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg, #1a1a1a 0%, #161616 100%)",
        flexShrink: 0,
      }}
      className={cn("flex items-center gap-2.5", className)}
    >
      {/* Left: Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <AnthropicLogo size={20} />
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#e5e5e5",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}>
          ChainReview
        </span>
        <span style={{
          fontSize: 9,
          fontWeight: 600,
          color: "#737373",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "2px 8px",
          borderRadius: 9999,
          lineHeight: 1.2,
          letterSpacing: "0.03em",
        }}>
          v0.1.0
        </span>
      </div>

      {/* Right: Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {/* Task History */}
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            title="Review History"
            style={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#525252",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#a3a3a3";
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#525252";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <ClockIcon style={{ width: 15, height: 15 }} />
          </button>
        )}

        {/* MCP Server Manager */}
        {onOpenMCPManager && (
          <button
            onClick={onOpenMCPManager}
            title="MCP Servers"
            style={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#525252",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#a3a3a3";
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#525252";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <ServerIcon style={{ width: 15, height: 15 }} />
          </button>
        )}

        {/* New Thread */}
        {onNewThread && (
          <button
            onClick={onNewThread}
            title="New Thread"
            style={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#525252",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#a3a3a3";
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#525252";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <PlusIcon style={{ width: 15, height: 15 }} />
          </button>
        )}
      </div>
    </div>
  );
}
