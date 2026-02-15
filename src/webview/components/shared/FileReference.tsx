import { useState } from "react";

// ── File extension config ──

interface ExtConfig {
  label: string;
}

const EXT_CONFIG: Record<string, ExtConfig> = {
  js: { label: "JS" }, jsx: { label: "JSX" }, ts: { label: "TS" }, tsx: { label: "TSX" },
  json: { label: "JSON" }, yaml: { label: "YAML" }, yml: { label: "YML" }, toml: { label: "TOML" },
  html: { label: "HTML" }, css: { label: "CSS" }, scss: { label: "SCSS" },
  md: { label: "MD" }, txt: { label: "TXT" },
  py: { label: "PY" }, rs: { label: "RS" }, go: { label: "GO" }, sh: { label: "SH" }, sql: { label: "SQL" },
  env: { label: "ENV" }, lock: { label: "LOCK" },
};

function getExtConfig(filePath: string): ExtConfig {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return EXT_CONFIG[ext] || { label: ext.toUpperCase().slice(0, 4) || "FILE" };
}

function getFileName(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}

// ── Tiny extension badge ──

export function ExtBadge({ filePath }: { filePath: string }) {
  const config = getExtConfig(filePath);
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 7,
      fontWeight: 900,
      lineHeight: 1,
      borderRadius: 3,
      padding: "2px 4px",
      flexShrink: 0,
      background: "var(--cr-bg-tertiary)",
      color: "var(--cr-text-muted)",
    }}>
      {config.label}
    </span>
  );
}

// ── Compact file chip ──

interface FileChipProps {
  filePath: string;
  line?: number;
  onClick?: () => void;
}

export function FileChip({ filePath, line, onClick }: FileChipProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={filePath}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        background: hovered ? "var(--cr-bg-hover)" : "var(--cr-bg-tertiary)",
        padding: "2px 6px",
        borderRadius: 4,
        fontFamily: "var(--cr-font-mono)",
        cursor: "pointer",
        border: "1px solid var(--cr-border-subtle)",
        transition: "all 150ms ease",
      }}
    >
      <ExtBadge filePath={filePath} />
      <span style={{
        color: hovered ? "var(--cr-text-primary)" : "var(--cr-text-secondary)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 120,
        transition: "color 150ms ease",
      }}>
        {getFileName(filePath)}
      </span>
      {line != null && (
        <span style={{ color: "var(--cr-text-ghost)" }}>:{line}</span>
      )}
    </button>
  );
}

// ── Full file row (expanded) ──

interface FileRowProps {
  filePath: string;
  line?: number;
  endLine?: number;
  onClick?: () => void;
}

export function FileRow({ filePath, line, endLine, onClick }: FileRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Open ${filePath}${line ? ` at line ${line}` : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: "6px 10px",
        borderRadius: 6,
        background: hovered ? "var(--cr-bg-hover)" : "transparent",
        cursor: "pointer",
        border: "none",
        transition: "all 150ms ease",
      }}
    >
      <ExtBadge filePath={filePath} />
      <span style={{
        fontSize: 11,
        color: hovered ? "var(--cr-text-primary)" : "var(--cr-text-secondary)",
        fontFamily: "var(--cr-font-mono)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        flex: 1,
        minWidth: 0,
        transition: "color 150ms ease",
      }}>
        {filePath}
      </span>
      {line != null && (
        <span style={{
          fontSize: 9,
          color: "var(--cr-text-ghost)",
          flexShrink: 0,
          fontFamily: "var(--cr-font-mono)",
        }}>
          L{line}{endLine != null && endLine !== line ? `–${endLine}` : ""}
        </span>
      )}
    </button>
  );
}

// ── Evidence file header (in code snippet blocks) ──

interface FileHeaderProps {
  filePath: string;
  startLine: number;
  endLine?: number;
  onClick?: () => void;
}

export function FileHeader({ filePath, startLine, endLine, onClick }: FileHeaderProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Open ${filePath} at line ${startLine}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        background: hovered ? "var(--cr-bg-hover)" : "var(--cr-bg-tertiary)",
        borderBottom: "1px solid var(--cr-border-subtle)",
        cursor: "pointer",
        transition: "background 150ms ease",
      }}
    >
      <ExtBadge filePath={filePath} />
      <span style={{
        fontSize: 10,
        color: hovered ? "var(--cr-text-primary)" : "var(--cr-text-secondary)",
        fontFamily: "var(--cr-font-mono)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        flex: 1,
        transition: "color 150ms ease",
      }}>
        {filePath}
      </span>
      <span style={{
        fontSize: 9,
        color: "var(--cr-text-ghost)",
        flexShrink: 0,
        fontFamily: "var(--cr-font-mono)",
      }}>
        L{startLine}
        {endLine != null && endLine !== startLine && `–${endLine}`}
      </span>
    </div>
  );
}
