import type { FindingSeverity } from "@/lib/types";

interface ConfidenceBadgeProps {
  severity: FindingSeverity;
  confidence?: number;
  className?: string;
}

const SEVERITY_STYLE: Record<string, { color: string; bg: string }> = {
  critical: { color: "#f87171", bg: "rgba(239, 68, 68, 0.10)" },
  high:     { color: "#fb923c", bg: "rgba(249, 115, 22, 0.10)" },
  medium:   { color: "#fbbf24", bg: "rgba(245, 158, 11, 0.10)" },
  low:      { color: "var(--cr-text-secondary)", bg: "var(--cr-bg-tertiary)" },
  info:     { color: "var(--cr-text-tertiary)", bg: "var(--cr-bg-tertiary)" },
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export function ConfidenceBadge({
  severity,
  confidence,
  className,
}: ConfidenceBadgeProps) {
  const style = SEVERITY_STYLE[severity] ?? { color: "var(--cr-text-ghost)", bg: "transparent" };
  const label = SEVERITY_LABEL[severity] ?? "Unknown";

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "1px 8px",
        borderRadius: 9999,
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: style.color,
        background: style.bg,
      }}
    >
      {label}
      {confidence !== undefined && (
        <span style={{ fontFamily: "var(--cr-font-mono)", opacity: 0.7 }}>
          {Math.round(confidence * 100)}%
        </span>
      )}
    </span>
  );
}
