import { type HTMLAttributes } from "react";
import { clsx } from "clsx";

/* ------------------------------------------------------------------ */
/*  Base Skeleton                                                      */
/* ------------------------------------------------------------------ */

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** If true, renders as a circle (use `w-*` + `h-*` to set size). */
  circle?: boolean;
}

export function Skeleton({ className, circle = false, ...props }: SkeletonProps) {
  return (
    <div
      className={clsx(
        "animate-pulse bg-zinc-200 dark:bg-zinc-800",
        circle ? "rounded-full" : "rounded-lg",
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonText  --  renders N lines of text skeleton                 */
/* ------------------------------------------------------------------ */

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={clsx("space-y-2.5", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={clsx("h-3.5", i === lines - 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonCard  --  a card-shaped loading skeleton                   */
/* ------------------------------------------------------------------ */

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4",
        className,
      )}
    >
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <SkeletonText lines={2} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonChart  --  a chart-area placeholder                        */
/* ------------------------------------------------------------------ */

interface SkeletonChartProps {
  className?: string;
  height?: string;
}

export function SkeletonChart({
  className,
  height = "h-64",
}: SkeletonChartProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6",
        className,
      )}
    >
      <Skeleton className="h-4 w-40 mb-6" />
      <div className={clsx("flex items-end gap-2", height)}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${20 + Math.random() * 80}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonTable  --  table rows placeholder                          */
/* ------------------------------------------------------------------ */

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
  className,
}: SkeletonTableProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-4 px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              className={clsx(
                "h-3 flex-1",
                colIdx === cols - 1 && "w-2/3",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
