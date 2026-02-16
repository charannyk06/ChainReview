interface DiffViewerProps {
  diff: string;
  className?: string;
}

/** Color configs for diff line types */
const DIFF_LINE_STYLES = {
  added: {
    background: "rgba(34, 197, 94, 0.08)",
    borderLeft: "2px solid rgba(34, 197, 94, 0.5)",
    color: "#86efac",
  },
  removed: {
    background: "rgba(239, 68, 68, 0.08)",
    borderLeft: "2px solid rgba(239, 68, 68, 0.5)",
    color: "#fca5a5",
  },
  header: {
    background: "rgba(99, 102, 241, 0.06)",
    borderLeft: "2px solid transparent",
    color: "#818cf8",
  },
  context: {
    background: "transparent",
    borderLeft: "2px solid transparent",
    color: "var(--cr-text-muted)",
  },
} as const;

function getLineStyle(line: string): (typeof DIFF_LINE_STYLES)[keyof typeof DIFF_LINE_STYLES] {
  if (line.startsWith("+") && !line.startsWith("+++")) return DIFF_LINE_STYLES.added;
  if (line.startsWith("-") && !line.startsWith("---")) return DIFF_LINE_STYLES.removed;
  if (
    line.startsWith("@@") ||
    line.startsWith("diff ") ||
    line.startsWith("index ") ||
    line.startsWith("---") ||
    line.startsWith("+++")
  )
    return DIFF_LINE_STYLES.header;
  return DIFF_LINE_STYLES.context;
}

export function DiffViewer({ diff, className }: DiffViewerProps) {
  const lines = diff.split("\n");

  return (
    <div
      className={className}
      style={{
        borderRadius: "var(--cr-radius-lg)",
        border: "1px solid var(--cr-border)",
        overflow: "hidden",
        fontFamily: "var(--cr-font-mono)",
        fontSize: 11,
      }}
    >
      <div style={{ overflowX: "auto" }}>
        {lines.map((line, i) => {
          const ls = getLineStyle(line);
          return (
            <div
              key={i}
              style={{
                padding: "1px 12px",
                lineHeight: "20px",
                whiteSpace: "pre",
                background: ls.background,
                borderLeft: ls.borderLeft,
                color: ls.color,
              }}
            >
              {line || " "}
            </div>
          );
        })}
      </div>
    </div>
  );
}
