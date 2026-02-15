import { PlusIcon, ServerIcon, ClockIcon, CodeIcon } from "lucide-react";

interface HeaderProps {
  onNewThread?: () => void;
  onOpenMCPManager?: () => void;
  onOpenHistory?: () => void;
  className?: string;
}

/* ChainReview logo — code brackets with chain links */
function ChainReviewLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      {/* Code brackets */}
      <path d="M10 7L4 16L10 25" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 7L28 16L22 25" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Chain link slash */}
      <path d="M19 9L13 23" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Header({ onNewThread, onOpenMCPManager, onOpenHistory }: HeaderProps) {
  return (
    <div
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg, #1a1a1a 0%, #161616 100%)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/* Left: Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <ChainReviewLogo size={22} />
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
