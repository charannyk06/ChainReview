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
import { CODING_AGENTS } from "@/lib/constants";
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
        <CheckCircleIcon className="size-8 text-emerald-400/40" />
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
      <div className="px-4 pt-4 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <ShieldAlertIcon className="size-3.5 text-[var(--cr-text-tertiary)] shrink-0" />
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
                "cr-btn cr-btn-sm",
                selectionMode
                  ? "cr-btn-indigo"
                  : "cr-btn-secondary"
              )}
            >
              <ListChecksIcon className="size-3.5" />
              {selectionMode ? "Exit" : "Selection Mode"}
            </button>

            {onReReview && (
              <button
                onClick={onReReview}
                className="cr-btn cr-btn-sm cr-btn-secondary"
              >
                <RefreshCwIcon className="size-3.5" />
                Re-Review
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Category Filter ═══ */}
      <div className="px-4 py-2 border-b border-[var(--cr-border-subtle)]">
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
            <div className="flex items-center gap-2.5 px-4 py-2 border-b border-[var(--cr-border-subtle)]">
              <span className="text-[11px] text-indigo-300 font-semibold tabular-nums">
                {selectedIds.size} selected
              </span>

              <button
                onClick={selectAll}
                className="cr-btn cr-btn-xs cr-btn-indigo"
              >
                All
              </button>
              <button
                onClick={deselectAll}
                className="cr-btn cr-btn-xs cr-btn-ghost"
              >
                None
              </button>

              {selectedIds.size > 0 && onSendToCodingAgent && (
                <div className="relative ml-auto" ref={batchHandoffRef}>
                  <button
                    onClick={() => setBatchHandoffOpen((p) => !p)}
                    className="cr-btn cr-btn-sm cr-btn-orange"
                  >
                    <SendIcon className="size-3" />
                    Send {selectedIds.size} to
                    <ArrowRightIcon className="size-3" />
                  </button>
                  <AnimatePresence>
                    {batchHandoffOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full right-0 mb-2 w-60 rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-bg-secondary)] shadow-xl shadow-black/40 z-50 overflow-hidden"
                      >
                        <div className="py-1.5">
                          {CODING_AGENTS.map((agent) => {
                            if (agent.separator) {
                              return (
                                <div
                                  key={agent.id}
                                  className="border-t border-[var(--cr-border-subtle)] my-1.5"
                                />
                              );
                            }
                            return (
                              <button
                                key={agent.id}
                                onClick={() => handleBatchHandoff(agent.id)}
                                className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-[var(--cr-bg-hover)] transition-colors cursor-pointer"
                              >
                                {agent.icon ? (
                                  <img
                                    src={agent.icon}
                                    alt=""
                                    className="size-5 rounded"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                ) : agent.id === "clipboard" ? (
                                  <ClipboardCopyIcon className="size-4 text-[var(--cr-text-muted)]" />
                                ) : agent.id === "export-markdown" ? (
                                  <ExternalLinkIcon className="size-4 text-[var(--cr-text-muted)]" />
                                ) : agent.id === "config-more" ? (
                                  <SettingsIcon className="size-4 text-[var(--cr-text-muted)]" />
                                ) : null}
                                <span className={cn("text-[12px] font-medium flex-1", agent.color)}>
                                  {agent.label}
                                </span>
                                {agent.suffix && (
                                  <span className="text-[10px] text-[var(--cr-text-ghost)] font-mono">
                                    {agent.suffix}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
      <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable both-edges" }}>
        <div className="flex flex-col px-4 py-2">
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
