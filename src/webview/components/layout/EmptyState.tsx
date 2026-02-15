import { FolderSearchIcon, GitCompareArrowsIcon, ClockIcon, MessageCircleIcon } from "lucide-react";

interface EmptyStateProps {
  onStartRepoReview: () => void;
  onStartDiffReview: () => void;
  onStartChat?: () => void;
  onOpenHistory?: () => void;
}

/* Anthropic logo — inline SVG matching the header */
function AnthropicLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
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

export function EmptyState({
  onStartRepoReview,
  onStartDiffReview,
  onStartChat,
  onOpenHistory,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: 24,
        background: "#0f0f0f",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle radial glow behind logo */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36, position: "relative", zIndex: 1 }}>
        {/* Logo + Brand */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)",
            border: "1px solid rgba(99,102,241,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <AnthropicLogo size={36} />
          </div>
          <div style={{ textAlign: "center" }}>
            <h1 style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#e5e5e5",
              letterSpacing: "-0.03em",
              margin: 0,
              lineHeight: 1.2,
            }}>
              ChainReview
            </h1>
            <p style={{
              fontSize: 12,
              color: "#525252",
              marginTop: 6,
              fontWeight: 500,
            }}>
              AI-powered repo-scale code review
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 280 }}>
          {/* Review Repository — Primary */}
          <button
            onClick={onStartRepoReview}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "13px 20px",
              borderRadius: 12,
              border: "1px solid rgba(99,102,241,0.30)",
              background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.10) 100%)",
              color: "#a5b4fc",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 200ms ease",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.18) 100%)";
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.45)";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(99,102,241,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.10) 100%)";
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.30)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <FolderSearchIcon style={{ width: 16, height: 16 }} />
            Review Repository
          </button>

          {/* Review Diff — Secondary */}
          <button
            onClick={onStartDiffReview}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "13px 20px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "#1c1c1c",
              color: "#a3a3a3",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 200ms ease",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#222222";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
              e.currentTarget.style.color = "#e5e5e5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#1c1c1c";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "#a3a3a3";
            }}
          >
            <GitCompareArrowsIcon style={{ width: 16, height: 16 }} />
            Review Diff
          </button>

          {/* Ask — Emerald accent */}
          {onStartChat && (
            <button
              onClick={onStartChat}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                width: "100%",
                padding: "13px 20px",
                borderRadius: 12,
                border: "1px solid rgba(16,185,129,0.20)",
                background: "rgba(16,185,129,0.08)",
                color: "#6ee7b7",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 200ms ease",
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(16,185,129,0.15)";
                e.currentTarget.style.borderColor = "rgba(16,185,129,0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(16,185,129,0.08)";
                e.currentTarget.style.borderColor = "rgba(16,185,129,0.20)";
              }}
            >
              <MessageCircleIcon style={{ width: 16, height: 16 }} />
              Ask
            </button>
          )}
        </div>

        {/* History link */}
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "#525252",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "color 150ms ease",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#a3a3a3"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#525252"; }}
          >
            <ClockIcon style={{ width: 13, height: 13 }} />
            View past reviews
          </button>
        )}

        {/* Version + Powered by */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <p style={{
            fontSize: 9,
            color: "#404040",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 600,
            margin: 0,
          }}>
            v0.1.0 &middot; Powered by Claude Opus 4
          </p>
        </div>
      </div>
    </div>
  );
}
