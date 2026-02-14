import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ListChecksIcon,
  ArrowRightIcon,
  RefreshCwIcon,
  XIcon,
  ClipboardCopyIcon,
  ExternalLinkIcon,
  SettingsIcon,
  CheckCircleIcon,
  SendIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HandoffMenu } from "@/components/shared/HandoffMenu";
import { CategoryFilter } from "./CategoryFilter";
import { FindingCard } from "./FindingCard";
import type { Finding, FindingCategory, ValidationResult } from "@/lib/types";

type FilterOption = "all" | FindingCategory;

interface FindingsGridProps {
  findings: Finding[];
  validationVerdicts?: Record<string, ValidationResult>;
  validatingFindings?: Set<string>;
  onProposePatch?: (findingId: string) => void;
  onMarkFalsePositive?: (findingId: string) => void;
  onSendToValidator?: (findingId: string) => void;
  onExplain?: (findingId: string) => void;
  onSendToCodingAgent?: (findingId: string, agentId: string) => void;
  onReReview?: () => void;
  className?: string;
}

export function FindingsGrid({
  findings,
  validationVerdicts,
  validatingFindings,
  onProposePatch,
  onMarkFalsePositive,
  onSendToValidator,
  onExplain,
  onSendToCodingAgent,
  onReReview,
  className,
}: FindingsGridProps) {
  const [filter, setFilter] = useState<FilterOption>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchHandoffOpen, setBatchHandoffOpen] = useState(false);
  const batchHandoffRef = useRef<HTMLDivElement>(null);

  // Close batch handoff dropdown on outside click
  useEffect(() => {
    if (!batchHandoffOpen) return;
    const handler = (e: MouseEvent) => {
      if (batchHandoffRef.current && !batchHandoffRef.current.contains(e.target as Node)) {
        setBatchHandoffOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [batchHandoffOpen]);

  const counts = useMemo(() => {
    const c: Record<FilterOption, number> = {
      all: findings.length,
      architecture: 0,
      security: 0,
      bugs: 0,
    };
    for (const f of findings) {
      c[f.category]++;
    }
    return c;
  }, [findings]);

  // Severity distribution for the summary bar
  const severityCounts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of findings) {
      c[f.severity]++;
    }
    return c;
  }, [findings]);

  const filtered = useMemo(
    () => (filter === "all" ? findings : findings.filter((f) => f.category === filter)),
    [findings, filter]
  );

  const toggleSelect = (findingId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(findingId)) {
        next.delete(findingId);
      } else {
        next.add(findingId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filtered.map((f) => f.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBatchHandoffOpen(false);
  };

  const handleBatchHandoff = (agentId: string) => {
    if (onSendToCodingAgent) {
      for (const id of selectedIds) {
        onSendToCodingAgent(id, agentId);
      }
    }
    setBatchHandoffOpen(false);
    exitSelectionMode();
  };

  if (findings.length === 0) {
    return (
      <div className={cn("h-full flex flex-col items-center justify-center gap-4 text-center px-10", className)}>
        <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
          <CheckCircleIcon className="size-6 text-emerald-400/70" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--cr-text-primary)]">All clear</p>
          <p className="text-[12px] text-[var(--cr-text-muted)] mt-1.5 max-w-[220px]">
            No findings detected. Run a review to discover potential issues in your codebase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* ═══ Summary Header ═══ */}
      <div className="px-5 pt-3 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlertIcon className="size-4 text-[var(--cr-text-tertiary)]" />
              <span className="text-[13px] font-semibold text-[var(--cr-text-primary)]">
                {findings.length} Finding{findings.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Severity distribution — plain muted text */}
            <span className="text-[10px] text-[var(--cr-text-ghost)] font-mono tabular-nums">
              {[
                severityCounts.critical > 0 && `${severityCounts.critical}C`,
                severityCounts.high > 0 && `${severityCounts.high}H`,
                severityCounts.medium > 0 && `${severityCounts.medium}M`,
                severityCounts.low > 0 && `${severityCounts.low}L`,
              ].filter(Boolean).join(" / ")}
            </span>
          </div>

          {/* Right-aligned action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectionMode) {
                  exitSelectionMode();
                } else {
                  setSelectionMode(true);
                }
              }}
              className={cn(
                "cr-btn",
                selectionMode
                  ? "cr-btn-indigo"
                  : "cr-btn-ghost"
              )}
              style={{ padding: "5px 10px" }}
            >
              <ListChecksIcon className="size-3.5" />
              {selectionMode ? "Exit" : "Select"}
            </button>

            {onReReview && (
              <button
                onClick={onReReview}
                className="cr-btn cr-btn-ghost"
                style={{ padding: "5px 10px" }}
              >
                <RefreshCwIcon className="size-3.5" />
                Re-Review
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Category Filter ═══ */}
      <div className="px-5 py-2 border-b border-[var(--cr-border-subtle)]">
        <CategoryFilter
          active={filter}
          onChange={setFilter}
          counts={counts}
        />
      </div>

      {/* ═══ Selection Toolbar ═══ */}
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-3 py-2.5 mx-5 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
              <span className="text-[11px] text-indigo-300 font-semibold tabular-nums">
                {selectedIds.size} selected
              </span>

              <button
                onClick={selectAll}
                className="cr-btn cr-btn-indigo"
                style={{ padding: "3px 8px", fontSize: "10px" }}
              >
                All
              </button>
              <button
                onClick={deselectAll}
                className="cr-btn cr-btn-ghost"
                style={{ padding: "3px 8px", fontSize: "10px" }}
              >
                None
              </button>

              {selectedIds.size > 0 && onSendToCodingAgent && (
                <div className="relative ml-auto" ref={batchHandoffRef}>
                  <button
                    onClick={() => setBatchHandoffOpen((p) => !p)}
                    className="cr-btn cr-btn-orange"
                    style={{ padding: "5px 12px" }}
                  >
                    <SendIcon className="size-3" />
                    Send {selectedIds.size} to
                    <ArrowRightIcon className="size-3" />
                  </button>
                  <HandoffMenu
                    open={batchHandoffOpen}
                    onSelect={(agentId) => handleBatchHandoff(agentId)}
                    align="right"
                  />
                </div>
              )}

              <button
                onClick={exitSelectionMode}
                className="p-1 text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] transition-colors ml-1 cursor-pointer rounded-md hover:bg-[var(--cr-bg-hover)]"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Findings List ═══ */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-3" style={{ scrollbarGutter: "stable both-edges" }}>
        <div className="flex flex-col gap-3">
          {filtered.map((finding, i) => (
            <motion.div
              key={finding.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            >
              <FindingCard
                finding={finding}
                selected={selectedIds.has(finding.id)}
                selectionMode={selectionMode}
                validationResult={validationVerdicts?.[finding.id]}
                isValidating={validatingFindings?.has(finding.id) ?? false}
                onToggleSelect={toggleSelect}
                onProposePatch={onProposePatch}
                onMarkFalsePositive={onMarkFalsePositive}
                onSendToValidator={onSendToValidator}
                onExplain={onExplain}
                onSendToCodingAgent={onSendToCodingAgent}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
