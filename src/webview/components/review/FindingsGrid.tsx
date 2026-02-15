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
  onMarkFixed?: (findingId: string) => void;
  onReReview?: () => void;
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
  onMarkFixed,
  onReReview,
}: FindingsGridProps) {
  const [filter, setFilter] = useState<FilterOption>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchHandoffOpen, setBatchHandoffOpen] = useState(false);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
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
      if (next.has(findingId)) next.delete(findingId);
      else next.add(findingId);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filtered.map((f) => f.id)));
  const deselectAll = () => setSelectedIds(new Set());

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
      <div style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        textAlign: "center",
        padding: "0 40px",
      }}>
        <CheckCircleIcon style={{ width: 32, height: 32, color: "rgba(52,211,153,0.4)" }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--cr-text-primary)" }}>All clear</p>
          <p style={{ fontSize: 12, color: "var(--cr-text-muted)", marginTop: 6, maxWidth: 220 }}>
            No findings detected. Run a review to discover potential issues in your codebase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* ═══ Summary Header ═══ */}
      <div style={{ padding: "16px 16px 10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldAlertIcon style={{ width: 14, height: 14, color: "var(--cr-text-tertiary)", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cr-text-primary)" }}>
                {findings.length} Finding{findings.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Severity distribution */}
            <span style={{ fontSize: 10, color: "var(--cr-text-ghost)", fontFamily: "var(--cr-font-mono)" }}>
              {[
                severityCounts.critical > 0 && `${severityCounts.critical}C`,
                severityCounts.high > 0 && `${severityCounts.high}H`,
                severityCounts.medium > 0 && `${severityCounts.medium}M`,
                severityCounts.low > 0 && `${severityCounts.low}L`,
              ].filter(Boolean).join(" / ")}
            </span>
          </div>

          {/* Right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
              className={selectionMode ? "cr-btn cr-btn-sm cr-btn-indigo" : "cr-btn cr-btn-sm cr-btn-secondary"}
            >
              <ListChecksIcon style={{ width: 14, height: 14 }} />
              {selectionMode ? "Exit" : "Selection Mode"}
            </button>

            {onReReview && (
              <button onClick={onReReview} className="cr-btn cr-btn-sm cr-btn-secondary">
                <RefreshCwIcon style={{ width: 14, height: 14 }} />
                Re-Review
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Category Filter ═══ */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--cr-border-subtle)" }}>
        <CategoryFilter active={filter} onChange={setFilter} counts={counts} />
      </div>

      {/* ═══ Selection Toolbar ═══ */}
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderBottom: "1px solid var(--cr-border-subtle)",
            }}>
              <span style={{ fontSize: 11, color: "#a5b4fc", fontWeight: 600 }}>
                {selectedIds.size} selected
              </span>

              <button onClick={selectAll} className="cr-btn cr-btn-xs cr-btn-indigo">All</button>
              <button onClick={deselectAll} className="cr-btn cr-btn-xs cr-btn-ghost">None</button>

              {selectedIds.size > 0 && onSendToCodingAgent && (
                <div style={{ position: "relative", marginLeft: "auto" }} ref={batchHandoffRef}>
                  <button
                    onClick={() => setBatchHandoffOpen((p) => !p)}
                    className="cr-btn cr-btn-sm cr-btn-orange"
                  >
                    <SendIcon style={{ width: 12, height: 12 }} />
                    Send {selectedIds.size} to
                    <ArrowRightIcon style={{ width: 12, height: 12 }} />
                  </button>
                  <AnimatePresence>
                    {batchHandoffOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        style={{
                          position: "absolute",
                          bottom: "100%",
                          right: 0,
                          marginBottom: 8,
                          width: 240,
                          borderRadius: 8,
                          border: "1px solid var(--cr-border-strong)",
                          background: "var(--cr-bg-secondary)",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                          zIndex: 50,
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ padding: "6px 0" }}>
                          {CODING_AGENTS.map((agent) => {
                            if (agent.separator) {
                              return (
                                <div key={agent.id} style={{
                                  borderTop: "1px solid var(--cr-border-subtle)",
                                  margin: "6px 0",
                                }} />
                              );
                            }
                            const isHovered = hoveredAgentId === agent.id;
                            return (
                              <button
                                key={agent.id}
                                onClick={() => handleBatchHandoff(agent.id)}
                                onMouseEnter={() => setHoveredAgentId(agent.id)}
                                onMouseLeave={() => setHoveredAgentId(null)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  width: "100%",
                                  padding: "10px 16px",
                                  textAlign: "left",
                                  background: isHovered ? "var(--cr-bg-hover)" : "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  transition: "background 100ms ease",
                                }}
                              >
                                {agent.icon ? (
                                  <img
                                    src={agent.icon}
                                    alt=""
                                    style={{ width: 20, height: 20, borderRadius: 4 }}
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                ) : agent.id === "clipboard" ? (
                                  <ClipboardCopyIcon style={{ width: 16, height: 16, color: "var(--cr-text-muted)" }} />
                                ) : agent.id === "export-markdown" ? (
                                  <ExternalLinkIcon style={{ width: 16, height: 16, color: "var(--cr-text-muted)" }} />
                                ) : agent.id === "config-more" ? (
                                  <SettingsIcon style={{ width: 16, height: 16, color: "var(--cr-text-muted)" }} />
                                ) : null}
                                <span style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  flex: 1,
                                  color: agent.color?.includes("red") ? "#fca5a5"
                                       : agent.color?.includes("amber") ? "#fcd34d"
                                       : agent.color?.includes("blue") ? "#93c5fd"
                                       : agent.color?.includes("emerald") ? "#6ee7b7"
                                       : "#e5e5e5",
                                }}>
                                  {agent.label}
                                </span>
                                {agent.suffix && (
                                  <span style={{
                                    fontSize: 10,
                                    color: "var(--cr-text-ghost)",
                                    fontFamily: "var(--cr-font-mono)",
                                  }}>
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
                style={{
                  padding: 4,
                  color: "var(--cr-text-muted)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 6,
                  marginLeft: 4,
                  transition: "all 150ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--cr-text-secondary)";
                  e.currentTarget.style.background = "var(--cr-bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--cr-text-muted)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <XIcon style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Findings List ═══ */}
      <div style={{ flex: 1, overflowY: "auto" }} className="cr-scrollbar">
        <div style={{ padding: "8px 0", display: "flex", flexDirection: "column" }}>
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
                onMarkFixed={onMarkFixed}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
