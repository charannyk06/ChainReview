import { cn } from "@/lib/utils";
import type { Evidence } from "@/lib/types";

interface EvidencePanelProps {
  evidence: Evidence;
  className?: string;
}

export function EvidencePanel({ evidence, className }: EvidencePanelProps) {
  return (
    <div className={cn("rounded-lg border border-[var(--cr-border-subtle)] overflow-hidden", className)}>
      {/* File path header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--cr-bg-tertiary)] text-[11px]">
        <span className="text-[var(--cr-text-secondary)] font-mono truncate">
          {evidence.filePath}
        </span>
        <span className="text-[var(--cr-text-ghost)] shrink-0">
          L{evidence.startLine}
          {evidence.endLine !== evidence.startLine && `-${evidence.endLine}`}
        </span>
      </div>

      {/* Code snippet */}
      <div className="bg-[var(--cr-bg-primary)] p-3 overflow-x-auto">
        <pre className="code-block text-[var(--cr-text-secondary)]">
          {evidence.snippet.replace(/\n$/, "").split("\n").map((line, i) => (
            <div key={i} className="flex">
              <span className="text-[var(--cr-text-ghost)] select-none w-8 shrink-0 text-right mr-3">
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
