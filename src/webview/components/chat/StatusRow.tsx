import {
  AlertTriangleIcon,
  InfoIcon,
  CheckCircle2Icon,
  CircleXIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusBlock } from "@/lib/types";

interface StatusRowProps {
  block: StatusBlock;
}

const LEVEL_CONFIG = {
  info: {
    Icon: InfoIcon,
    iconClass: "text-[var(--cr-text-ghost)]",
    textClass: "text-[var(--cr-text-muted)]",
  },
  warning: {
    Icon: AlertTriangleIcon,
    iconClass: "text-amber-400/50",
    textClass: "text-amber-300/60",
  },
  error: {
    Icon: CircleXIcon,
    iconClass: "text-red-400/50",
    textClass: "text-red-300/60",
  },
  success: {
    Icon: CheckCircle2Icon,
    iconClass: "text-emerald-400/50",
    textClass: "text-emerald-300/60",
  },
};

export function StatusRow({ block }: StatusRowProps) {
  const config = LEVEL_CONFIG[block.level] || LEVEL_CONFIG.info;
  const { Icon } = config;

  return (
    <div className="flex items-center gap-1.5 py-0.5 text-[10.5px] leading-normal">
      <Icon className={cn("size-3 shrink-0", config.iconClass)} />
      <span className={cn("min-w-0 truncate", config.textClass)}>
        {block.step && (
          <span className="font-semibold mr-1">{block.step}:</span>
        )}
        {block.text}
      </span>
    </div>
  );
}
