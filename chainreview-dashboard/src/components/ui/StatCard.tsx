import { type ReactNode } from "react";
import { clsx } from "clsx";
import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  /** Percentage change -- positive = up, negative = down, undefined = hidden. */
  change?: number;
  subtitle?: string;
  className?: string;
  /** Optional color class for the icon, e.g. "text-brand-500". */
  iconColor?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  change,
  subtitle,
  className,
  iconColor = "text-brand-500",
}: StatCardProps) {
  const changeIsPositive = change !== undefined && change >= 0;
  const changeIsNegative = change !== undefined && change < 0;

  return (
    <div
      className={clsx(
        "rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 transition-shadow hover:shadow-md dark:hover:shadow-zinc-900/30",
        className,
      )}
    >
      {/* Top row: icon + label */}
      <div className="flex items-center gap-2.5 mb-3">
        {Icon && <Icon size={18} className={clsx("shrink-0", iconColor)} />}
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider truncate">
          {label}
        </span>
      </div>

      {/* Value row */}
      <div className="flex items-end gap-3">
        <span className="text-2xl font-bold text-zinc-900 dark:text-white leading-none">
          {value}
        </span>

        {change !== undefined && (
          <span
            className={clsx(
              "inline-flex items-center gap-0.5 text-xs font-medium leading-none mb-0.5",
              changeIsPositive && "text-emerald-600 dark:text-emerald-400",
              changeIsNegative && "text-red-600 dark:text-red-400",
            )}
          >
            {changeIsPositive ? (
              <TrendingUp size={12} />
            ) : (
              <TrendingDown size={12} />
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
}
