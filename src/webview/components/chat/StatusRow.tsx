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
    iconClass: "text-blue-400/70",
    textClass: "text-[var(--cr-text-secondary)]",
    bgClass: "bg-blue-500/5",
    borderClass: "border-blue-500/10",
  },
  warning: {
    Icon: AlertTriangleIcon,
    iconClass: "text-amber-400/70",
    textClass: "text-amber-300/80",
    bgClass: "bg-amber-500/5",
    borderClass: "border-amber-500/10",
  },
  error: {
    Icon: CircleXIcon,
    iconClass: "text-red-400/70",
    textClass: "text-red-300/80",
    bgClass: "bg-red-500/5",
    borderClass: "border-red-500/10",
  },
  success: {
    Icon: CheckCircle2Icon,
    iconClass: "text-emerald-400/70",
    textClass: "text-emerald-300/80",
    bgClass: "bg-emerald-500/5",
    borderClass: "border-emerald-500/10",
  },
};

export function StatusRow({ block }: StatusRowProps) {
  const config = LEVEL_CONFIG[block.level] || LEVEL_CONFIG.info;
  const { Icon } = config;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 px-3 py-2 rounded-lg text-[11.5px] leading-relaxed border",
        config.bgClass,
        config.borderClass
      )}
    >
      <Icon className={cn("size-3 shrink-0 mt-0.5", config.iconClass)} />
      <span className={cn("min-w-0", config.textClass)}>
        {block.step && (
          <span className="font-semibold opacity-70 mr-1.5">{block.step}:</span>
        )}
        {block.text}
      </span>
    </div>
  );
}
