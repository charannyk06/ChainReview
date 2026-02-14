import {
  BugIcon,
  ShieldAlertIcon,
  LandmarkIcon,
  LayersIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FindingCategory } from "@/lib/types";

type FilterOption = "all" | FindingCategory;

interface CategoryFilterProps {
  active: FilterOption;
  onChange: (category: FilterOption) => void;
  counts: Record<FilterOption, number>;
  className?: string;
}

const CATEGORIES: {
  id: FilterOption;
  label: string;
  dotColor: string;
  activeBg: string;
  activeText: string;
  activeBorder: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: "all",
    label: "All",
    dotColor: "bg-[var(--cr-text-tertiary)]",
    activeBg: "bg-[var(--cr-bg-elevated)]",
    activeText: "text-[var(--cr-text-primary)]",
    activeBorder: "border-[var(--cr-border-strong)]",
    Icon: LayersIcon,
  },
  {
    id: "bugs",
    label: "Bug",
    dotColor: "bg-rose-400",
    activeBg: "bg-rose-500/10",
    activeText: "text-rose-300",
    activeBorder: "border-rose-500/25",
    Icon: BugIcon,
  },
  {
    id: "security",
    label: "Security",
    dotColor: "bg-amber-400",
    activeBg: "bg-amber-500/10",
    activeText: "text-amber-300",
    activeBorder: "border-amber-500/25",
    Icon: ShieldAlertIcon,
  },
  {
    id: "architecture",
    label: "Architecture",
    dotColor: "bg-blue-400",
    activeBg: "bg-blue-500/10",
    activeText: "text-blue-300",
    activeBorder: "border-blue-500/25",
    Icon: LandmarkIcon,
  },
];

export function CategoryFilter({
  active,
  onChange,
  counts,
  className,
}: CategoryFilterProps) {
  return (
    <div className={cn("flex gap-1.5", className)}>
      {CATEGORIES.map((cat) => {
        const isActive = active === cat.id;
        const count = counts[cat.id] || 0;

        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            className={cn(
              "relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-150 cursor-pointer",
              isActive
                ? cn(cat.activeBg, cat.activeText)
                : "text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-hover)]"
            )}
          >
            {/* Colored dot indicator */}
            <div className={cn(
              "size-1.5 rounded-full shrink-0 transition-opacity",
              cat.dotColor,
              !isActive && "opacity-40"
            )} />

            <span>{cat.label}</span>

            {/* Count badge */}
            {count > 0 && (
              <span className={cn(
                "text-[9px] font-mono min-w-[16px] text-center px-1 py-0 rounded-full",
                isActive
                  ? "bg-white/10"
                  : "bg-[var(--cr-bg-hover)] text-[var(--cr-text-muted)]"
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
