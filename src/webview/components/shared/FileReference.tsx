import { cn } from "@/lib/utils";

// ── File extension config with colored badge icons ──

interface ExtConfig {
  label: string;
  bgColor: string;
  textColor: string;
}

const MUTED_BG = "bg-[var(--cr-bg-tertiary)]";
const MUTED_TEXT = "text-[var(--cr-text-muted)]";

const EXT_CONFIG: Record<string, ExtConfig> = {
  // JavaScript/TypeScript
  js:   { label: "JS",   bgColor: MUTED_BG, textColor: MUTED_TEXT },
  jsx:  { label: "JSX",  bgColor: MUTED_BG, textColor: MUTED_TEXT },
  ts:   { label: "TS",   bgColor: MUTED_BG, textColor: MUTED_TEXT },
  tsx:  { label: "TSX",  bgColor: MUTED_BG, textColor: MUTED_TEXT },
  // Data/Config
  json: { label: "JSON", bgColor: MUTED_BG, textColor: MUTED_TEXT },
  yaml: { label: "YAML", bgColor: MUTED_BG, textColor: MUTED_TEXT },
  yml:  { label: "YML",  bgColor: MUTED_BG, textColor: MUTED_TEXT },
  toml: { label: "TOML", bgColor: MUTED_BG, textColor: MUTED_TEXT },
  // Web
  html: { label: "HTML", bgColor: MUTED_BG, textColor: MUTED_TEXT },
  css:  { label: "CSS",  bgColor: MUTED_BG, textColor: MUTED_TEXT },
  scss: { label: "SCSS", bgColor: MUTED_BG, textColor: MUTED_TEXT },
  // Markdown/Text
  md:   { label: "MD",   bgColor: MUTED_BG, textColor: MUTED_TEXT },
  txt:  { label: "TXT",  bgColor: MUTED_BG, textColor: MUTED_TEXT },
  // Python/Other
  py:   { label: "PY",   bgColor: MUTED_BG, textColor: MUTED_TEXT },
  rs:   { label: "RS",   bgColor: MUTED_BG, textColor: MUTED_TEXT },
  go:   { label: "GO",   bgColor: MUTED_BG, textColor: MUTED_TEXT },
  sh:   { label: "SH",   bgColor: MUTED_BG, textColor: MUTED_TEXT },
  sql:  { label: "SQL",  bgColor: MUTED_BG, textColor: MUTED_TEXT },
  // Config
  env:  { label: "ENV",  bgColor: MUTED_BG, textColor: MUTED_TEXT },
  lock: { label: "LOCK", bgColor: MUTED_BG, textColor: MUTED_TEXT },
};

function getExtConfig(filePath: string): ExtConfig {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return EXT_CONFIG[ext] || { label: ext.toUpperCase().slice(0, 4) || "FILE", bgColor: MUTED_BG, textColor: MUTED_TEXT };
}

function getFileName(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}

// ── Tiny extension badge icon ──

export function ExtBadge({ filePath, className }: { filePath: string; className?: string }) {
  const config = getExtConfig(filePath);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center text-[7px] font-black leading-none rounded px-1 py-0.5 shrink-0",
        config.bgColor,
        config.textColor,
        className
      )}
    >
      {config.label}
    </span>
  );
}

// ── Compact file chip (collapsed state, e.g. in finding card header) ──

interface FileChipProps {
  filePath: string;
  line?: number;
  onClick?: () => void;
  className?: string;
}

export function FileChip({ filePath, line, onClick, className }: FileChipProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={filePath}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] bg-[var(--cr-bg-tertiary)] hover:bg-[var(--cr-bg-hover)] px-1.5 py-0.5 rounded font-mono transition-colors cursor-pointer group border border-[var(--cr-border-subtle)]",
        className
      )}
    >
      <ExtBadge filePath={filePath} />
      <span className="text-[var(--cr-text-secondary)] group-hover:text-[var(--cr-text-primary)] truncate max-w-[120px]">
        {getFileName(filePath)}
      </span>
      {line != null && (
        <span className="text-[var(--cr-text-ghost)]">:{line}</span>
      )}
    </button>
  );
}

// ── Full file row (expanded state) ──

interface FileRowProps {
  filePath: string;
  line?: number;
  endLine?: number;
  onClick?: () => void;
  className?: string;
}

export function FileRow({ filePath, line, endLine, onClick, className }: FileRowProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={`Open ${filePath}${line ? ` at line ${line}` : ""}`}
      className={cn(
        "flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--cr-bg-hover)] transition-colors group cursor-pointer",
        className
      )}
    >
      <ExtBadge filePath={filePath} />
      <span className="text-[11px] text-[var(--cr-text-secondary)] group-hover:text-[var(--cr-text-primary)] font-mono truncate flex-1 min-w-0 transition-colors">
        {filePath}
      </span>
      {line != null && (
        <span className="text-[9px] text-[var(--cr-text-ghost)] shrink-0 font-mono">
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
  className?: string;
}

export function FileHeader({ filePath, startLine, endLine, onClick, className }: FileHeaderProps) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={`Open ${filePath} at line ${startLine}`}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--cr-bg-tertiary)] border-b border-[var(--cr-border-subtle)] cursor-pointer hover:bg-[var(--cr-bg-hover)] transition-colors group",
        className
      )}
    >
      <ExtBadge filePath={filePath} />
      <span className="text-[10px] text-[var(--cr-text-secondary)] group-hover:text-[var(--cr-text-primary)] font-mono truncate flex-1 transition-colors">
        {filePath}
      </span>
      <span className="text-[9px] text-[var(--cr-text-ghost)] shrink-0 font-mono">
        L{startLine}
        {endLine != null && endLine !== startLine && `–${endLine}`}
      </span>
    </div>
  );
}
