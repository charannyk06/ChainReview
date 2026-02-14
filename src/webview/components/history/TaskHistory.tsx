import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeftIcon,
  SearchIcon,
  Trash2Icon,
  CalendarIcon,
  AlertTriangleIcon,
  ShieldAlertIcon,
  FolderSearchIcon,
  GitCompareArrowsIcon,
  FilterIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewRunSummary } from "@/lib/types";

interface TaskHistoryProps {
  runs: ReviewRunSummary[];
  onClose: () => void;
  onLoadRun: (runId: string) => void;
  onDeleteRun: (runId: string) => void;
  className?: string;
}

type StatusFilter = "all" | "complete" | "running" | "error";

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  complete: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Complete" },
  running: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Running" },
  error: { bg: "bg-red-500/15", text: "text-red-400", label: "Error" },
};

export function TaskHistory({
  runs,
  onClose,
  onLoadRun,
  onDeleteRun,
  className,
}: TaskHistoryProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showFilter, setShowFilter] = useState(false);

  const filteredRuns = useMemo(() => {
    let filtered = runs;

    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.repoName.toLowerCase().includes(q) ||
          r.repoPath.toLowerCase().includes(q) ||
          r.mode.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [runs, search, statusFilter]);

  return (
    <div
      className={cn(
        "flex flex-col bg-[var(--cr-bg-root)] overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--cr-border)] bg-[var(--cr-bg-primary)] shrink-0">
        <button
          onClick={onClose}
          className={cn(
            "size-8 flex items-center justify-center rounded-lg",
            "text-[var(--cr-text-muted)]",
            "hover:text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-hover)]",
            "transition-all duration-150 cursor-pointer"
          )}
        >
          <ArrowLeftIcon className="size-4" />
        </button>
        <span className="text-[13px] font-semibold text-[var(--cr-text-primary)] tracking-tight flex-1">
          Task History
        </span>
        <span className="text-[11px] text-[var(--cr-text-muted)]">
          {filteredRuns.length} review{filteredRuns.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Search + Filter bar */}
      <div className="px-3 pt-3 pb-2 space-y-2.5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--cr-text-ghost)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reviews..."
              className={cn(
                "w-full pl-8 pr-3 py-2 rounded-lg text-[12px]",
                "bg-[var(--cr-bg-secondary)] border border-[var(--cr-border)]",
                "text-[var(--cr-text-primary)] placeholder:text-[var(--cr-text-ghost)]",
                "focus:outline-none focus:border-[var(--cr-accent)]",
                "transition-colors"
              )}
            />
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={cn(
              "size-8 flex items-center justify-center rounded-lg border",
              showFilter
                ? "border-[var(--cr-accent)] text-[var(--cr-accent)] bg-[var(--cr-accent-subtle)]"
                : "border-[var(--cr-border)] text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-hover)]",
              "transition-all duration-150 cursor-pointer"
            )}
          >
            <FilterIcon className="size-3.5" />
          </button>
        </div>

        {/* Filter chips */}
        <AnimatePresence>
          {showFilter && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-1.5 pb-1">
                {(["all", "complete", "running", "error"] as StatusFilter[]).map(
                  (f) => (
                    <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-medium transition-all",
                        statusFilter === f
                          ? "bg-[var(--cr-accent)] text-white"
                          : "bg-[var(--cr-bg-tertiary)] text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)]"
                      )}
                    >
                      {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  )
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Runs list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2.5 cr-scrollbar" style={{ scrollbarGutter: "stable both-edges" }}>
        {filteredRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <CalendarIcon className="size-8 text-[var(--cr-text-ghost)] opacity-40" />
            <p className="text-[11px] text-[var(--cr-text-ghost)]">
              {runs.length === 0
                ? "No review history yet"
                : "No reviews match your search"}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredRuns.map((run) => {
              const status = STATUS_STYLES[run.status] || STATUS_STYLES.complete;
              return (
                <motion.div
                  key={run.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => onLoadRun(run.id)}
                  className={cn(
                    "group relative rounded-xl border border-[var(--cr-border)]",
                    "bg-[var(--cr-bg-secondary)] p-4 cursor-pointer",
                    "hover:border-[var(--cr-border-hover)] hover:bg-[var(--cr-bg-hover)]",
                    "transition-all duration-150"
                  )}
                >
                  {/* Top row: repo name + status */}
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {run.mode === "repo" ? (
                        <FolderSearchIcon className="size-3.5 text-indigo-400 shrink-0" />
                      ) : (
                        <GitCompareArrowsIcon className="size-3.5 text-cyan-400 shrink-0" />
                      )}
                      <span className="text-[13px] font-semibold text-[var(--cr-text-primary)] truncate">
                        {run.repoName}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-[9px] font-medium px-2 py-0.5 rounded-full shrink-0",
                        status.bg,
                        status.text
                      )}
                    >
                      {status.label}
                    </span>
                  </div>

                  {/* Middle: findings summary */}
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className="text-[12px] text-[var(--cr-text-muted)]">
                      {run.findingsCount} finding{run.findingsCount !== 1 ? "s" : ""}
                    </span>
                    {run.criticalCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-red-400">
                        <ShieldAlertIcon className="size-2.5" />
                        {run.criticalCount} critical
                      </span>
                    )}
                    {run.highCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-orange-400">
                        <AlertTriangleIcon className="size-2.5" />
                        {run.highCount} high
                      </span>
                    )}
                  </div>

                  {/* Bottom: date + delete */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="size-2.5 text-[var(--cr-text-ghost)]" />
                      <span
                        className="text-[10px] text-[var(--cr-text-ghost)]"
                        title={formatFullDate(run.startedAt)}
                      >
                        {formatRelativeDate(run.startedAt)}
                      </span>
                      <span className="text-[9px] text-[var(--cr-text-ghost)] uppercase tracking-wider ml-1">
                        {run.mode}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRun(run.id);
                      }}
                      className={cn(
                        "size-6 flex items-center justify-center rounded-md",
                        "text-[var(--cr-text-ghost)] opacity-0 group-hover:opacity-100",
                        "hover:text-red-400 hover:bg-red-500/10",
                        "transition-all duration-150"
                      )}
                      title="Delete review"
                    >
                      <Trash2Icon className="size-3" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
