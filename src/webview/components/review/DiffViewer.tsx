import { cn } from "@/lib/utils";

interface DiffViewerProps {
  diff: string;
  className?: string;
}

export function DiffViewer({ diff, className }: DiffViewerProps) {
  const lines = diff.split("\n");

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--cr-border)] overflow-hidden font-mono text-[11px]",
        className
      )}
    >
      <div className="overflow-x-auto">
        {lines.map((line, i) => {
          let lineClass = "";
          if (line.startsWith("+") && !line.startsWith("+++")) {
            lineClass = "diff-added";
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            lineClass = "diff-removed";
          } else if (
            line.startsWith("@@") ||
            line.startsWith("diff ") ||
            line.startsWith("index ") ||
            line.startsWith("---") ||
            line.startsWith("+++")
          ) {
            lineClass = "diff-header";
          }

          return (
            <div
              key={i}
              className={cn(
                "px-3 py-0.5 leading-5 whitespace-pre",
                lineClass || "text-[var(--cr-text-muted)]"
              )}
            >
              {line || " "}
            </div>
          );
        })}
      </div>
    </div>
  );
}
