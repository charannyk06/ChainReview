import { cn } from "@/lib/utils";
import { SEVERITY_CONFIG } from "@/lib/constants";
import type { FindingSeverity } from "@/lib/types";

interface ConfidenceBadgeProps {
  severity: FindingSeverity;
  confidence?: number;
  className?: string;
}

export function ConfidenceBadge({
  severity,
  confidence,
  className,
}: ConfidenceBadgeProps) {
  const config = SEVERITY_CONFIG[severity];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
        config.bgColor,
        config.color,
        className
      )}
    >
      {config.label}
      {confidence !== undefined && (
        <span className="font-mono opacity-70">
          {Math.round(confidence * 100)}%
        </span>
      )}
    </span>
  );
}
