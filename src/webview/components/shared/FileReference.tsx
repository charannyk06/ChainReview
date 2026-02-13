import { cn } from "@/lib/utils";

// ── File extension config with colored badge icons ──

interface ExtConfig {
  label: string;
  bgColor: string;
  textColor: string;
}

const EXT_CONFIG: Record<string, ExtConfig> = {
  // JavaScript/TypeScript
  js:   { label: "JS",   bgColor: "bg-yellow-500/20", textColor: "text-yellow-400" },
  jsx:  { label: "JSX",  bgColor: "bg-yellow-500/20", textColor: "text-yellow-400" },
  ts:   { label: "TS",   bgColor: "bg-blue-500/20",   textColor: "text-blue-400" },
  tsx:  { label: "TSX",  bgColor: "bg-blue-500/20",   textColor: "text-blue-400" },
  // Data/Config
  json: { label: "JSON", bgColor: "bg-amber-500/20",  textColor: "text-amber-400" },
  yaml: { label: "YAML", bgColor: "bg-pink-500/20",   textColor: "text-pink-400" },
  yml:  { label: "YML",  bgColor: "bg-pink-500/20",   textColor: "text-pink-400" },
  toml: { label: "TOML", bgColor: "bg-gray-500/20",   textColor: "text-gray-400" },
  // Web
  html: { label: "HTML", bgColor: "bg-orange-500/20", textColor: "text-orange-400" },
  css:  { label: "CSS",  bgColor: "bg-purple-500/20", textColor: "text-purple-400" },
  scss: { label: "SCSS", bgColor: "bg-pink-500/20",   textColor: "text-pink-400" },
  // Markdown/Text
  md:   { label: "MD",   bgColor: "bg-neutral-500/20", textColor: "text-neutral-400" },
  txt:  { label: "TXT",  bgColor: "bg-neutral-500/20", textColor: "text-neutral-400" },
  // Python/Other
  py:   { label: "PY",   bgColor: "bg-green-500/20",  textColor: "text-green-400" },
  rs:   { label: "RS",   bgColor: "bg-orange-500/20", textColor: "text-orange-400" },
  go:   { label: "GO",   bgColor: "bg-cyan-500/20",   textColor: "text-cyan-400" },
  sh:   { label: "SH",   bgColor: "bg-emerald-500/20", textColor: "text-emerald-400" },
  sql:  { label: "SQL",  bgColor: "bg-indigo-500/20", textColor: "text-indigo-400" },
  // Config
  env:  { label: "ENV",  bgColor: "bg-yellow-600/20", textColor: "text-yellow-500" },
  lock: { label: "LOCK", bgColor: "bg-gray-500/20",   textColor: "text-gray-500" },
};

function getExtConfig(filePath: string): ExtConfig {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return EXT_CONFIG[ext] || { label: ext.toUpperCase().slice(0, 4) || "FILE", bgColor: "bg-neutral-500/20", textColor: "text-neutral-400" };
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
      <span className="text-[11px] text-[var(--cr-text-secondary)] group-hover:text-indigo-400 font-mono truncate flex-1 min-w-0 transition-colors">
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
      <span className="text-[10px] text-indigo-400 group-hover:text-indigo-300 font-mono truncate flex-1 transition-colors">
        {filePath}
      </span>
      <span className="text-[9px] text-[var(--cr-text-ghost)] shrink-0 font-mono">
        L{startLine}
        {endLine != null && endLine !== startLine && `–${endLine}`}
      </span>
    </div>
  );
}
