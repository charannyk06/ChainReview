import { cn } from "@/lib/utils";
import type { Evidence } from "@/lib/types";

interface EvidencePanelProps {
  evidence: Evidence;
  className?: string;
}

export function EvidencePanel({ evidence, className }: EvidencePanelProps) {
  return (
    <div className={cn("rounded-lg border border-neutral-700/50 overflow-hidden", className)}>
      {/* File path header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800/50 text-[11px]">
        <span className="text-blue-400 font-mono truncate">
          {evidence.filePath}
        </span>
        <span className="text-neutral-500 shrink-0">
          L{evidence.startLine}
          {evidence.endLine !== evidence.startLine && `-${evidence.endLine}`}
        </span>
      </div>

      {/* Code snippet */}
      <div className="bg-neutral-900/80 p-3 overflow-x-auto">
        <pre className="code-block text-neutral-300">
          {evidence.snippet.replace(/\n$/, "").split("\n").map((line, i) => (
            <div key={i} className="flex">
              <span className="text-neutral-600 select-none w-8 shrink-0 text-right mr-3">
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
