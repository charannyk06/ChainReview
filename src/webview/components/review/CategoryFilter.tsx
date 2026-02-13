import { motion } from "motion/react";
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
  activeColor: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: "all",
    label: "All",
    dotColor: "bg-[var(--cr-text-muted)]",
    activeColor: "bg-[var(--cr-bg-tertiary)] text-[var(--cr-text-primary)] border-[var(--cr-border-strong)]",
    Icon: LayersIcon,
  },
  {
    id: "bugs",
    label: "Bugs",
    dotColor: "bg-[var(--cr-text-muted)]",
    activeColor: "bg-[var(--cr-bg-tertiary)] text-[var(--cr-text-primary)] border-[var(--cr-border-strong)]",
    Icon: BugIcon,
  },
  {
    id: "security",
    label: "Security",
    dotColor: "bg-[var(--cr-text-muted)]",
    activeColor: "bg-[var(--cr-bg-tertiary)] text-[var(--cr-text-primary)] border-[var(--cr-border-strong)]",
    Icon: ShieldAlertIcon,
  },
  {
    id: "architecture",
    label: "Architecture",
    dotColor: "bg-[var(--cr-text-muted)]",
    activeColor: "bg-[var(--cr-bg-tertiary)] text-[var(--cr-text-primary)] border-[var(--cr-border-strong)]",
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
    <div className={cn("flex gap-1", className)}>
      {CATEGORIES.map((cat) => {
        const isActive = active === cat.id;
        const count = counts[cat.id] || 0;

        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            className={cn(
              "relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 border",
              isActive
                ? cat.activeColor
                : "border-transparent text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-hover)]"
            )}
          >
            {/* Colored dot indicator */}
            <div className={cn(
              "size-2 rounded-full shrink-0 transition-opacity",
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
                  : "bg-[var(--cr-bg-tertiary)] text-[var(--cr-text-muted)]"
              )}>
                {count}
              </span>
            )}

            {/* Active underline */}
            {isActive && (
              <motion.div
                layoutId="category-filter-active"
                className="absolute -bottom-[1px] left-2 right-2 h-[2px] bg-current rounded-full opacity-50"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
