import type { Evidence } from "@/lib/types";
import { useOpenFile } from "@/contexts/OpenFileContext";

interface EvidencePanelProps {
  evidence: Evidence;
  className?: string;
}

export function EvidencePanel({ evidence, className }: EvidencePanelProps) {
  const openFile = useOpenFile();

  return (
    <div
      className={className}
      style={{
        borderRadius: 8,
        border: "1px solid var(--cr-border-subtle)",
        overflow: "hidden",
        background: "var(--cr-bg-root)",
      }}
    >
      {/* File path header */}
      <div
        onClick={() => openFile(evidence.filePath, evidence.startLine)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          background: "var(--cr-bg-tertiary)",
          fontSize: 11,
          cursor: "pointer",
          transition: "background 150ms ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--cr-bg-elevated)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--cr-bg-tertiary)"; }}
      >
        <span style={{
          color: "var(--cr-text-secondary)",
          fontFamily: "var(--cr-font-mono)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}>
          {evidence.filePath}
        </span>
        <span style={{ color: "var(--cr-text-ghost)", flexShrink: 0 }}>
          L{evidence.startLine}
          {evidence.endLine !== evidence.startLine && `-${evidence.endLine}`}
        </span>
      </div>

      {/* Code snippet */}
      <div style={{ background: "var(--cr-bg-primary)", padding: 12, overflowX: "auto" }}>
        <pre style={{
          fontFamily: "var(--cr-font-mono)",
          fontSize: 10.5,
          lineHeight: 1.6,
          color: "var(--cr-text-secondary)",
          margin: 0,
          tabSize: 2,
        }}>
          {evidence.snippet.replace(/\n$/, "").split("\n").map((line, i) => (
            <div key={i} style={{ display: "flex" }}>
              <span style={{
                color: "var(--cr-text-ghost)",
                userSelect: "none",
                width: 32,
                flexShrink: 0,
                textAlign: "right",
                marginRight: 12,
              }}>
                {evidence.startLine + i}
              </span>
              <span>{line}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
