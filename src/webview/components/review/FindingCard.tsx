import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LandmarkIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SettingsIcon,
  SparklesIcon,
  XCircleIcon,
  ChevronDownIcon,
  BugIcon,
  BookOpenIcon,
  CheckIcon,
  WrenchIcon,
  LoaderIcon,
  CircleIcon,
  SunIcon,
} from "lucide-react";
import { getAgentConfig, getSeverityConfig, getCategoryConfig } from "@/lib/constants";
import { FileChip, FileHeader } from "@/components/shared/FileReference";
import { HandoffMenu } from "@/components/shared/HandoffMenu";
import { useOpenFile } from "@/contexts/OpenFileContext";
import type { Finding, AgentName, ValidationResult, ValidatorVerdict } from "@/lib/types";

const AGENT_ICONS: Record<AgentName, React.FC<{ style?: React.CSSProperties }>> = {
  architecture: LandmarkIcon,
  security: ShieldAlertIcon,
  bugs: BugIcon,
  validator: ShieldCheckIcon,
  explainer: BookOpenIcon,
  system: SettingsIcon,
};

const SEVERITY_DOT_COLOR: Record<string, string> = {
  critical: "rgba(239,68,68,0.6)",
  high: "rgba(249,115,22,0.5)",
  medium: "rgba(234,179,8,0.4)",
  low: "var(--cr-text-muted)",
  info: "var(--cr-text-ghost)",
};

function getCategoryIcon(icon: string) {
  switch (icon) {
    case "bug": return BugIcon;
    case "shield": return ShieldAlertIcon;
    case "landmark": return LandmarkIcon;
    default: return BugIcon;
  }
}

/** Verdict badge config */
const VERDICT_BADGE: Record<ValidatorVerdict, {
  label: string; color: string; bgColor: string; borderColor: string;
  icon: "shield" | "bug" | "help";
}> = {
  still_present: { label: "Still Present", color: "#f87171", bgColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.20)", icon: "bug" },
  partially_fixed: { label: "Partially Fixed", color: "#fb923c", bgColor: "rgba(249,115,22,0.10)", borderColor: "var(--cr-border-strong)", icon: "help" },
  fixed: { label: "Fixed ✓", color: "#34d399", bgColor: "rgba(52,211,153,0.10)", borderColor: "rgba(52,211,153,0.20)", icon: "shield" },
  unable_to_determine: { label: "Unable to Verify", color: "#facc15", bgColor: "rgba(234,179,8,0.10)", borderColor: "rgba(234,179,8,0.20)", icon: "help" },
};

interface FindingCardProps {
  finding: Finding;
  selected?: boolean;
  selectionMode?: boolean;
  validationResult?: ValidationResult;
  isValidating?: boolean;
  onToggleSelect?: (findingId: string) => void;
  onProposePatch?: (findingId: string) => void;
  onMarkFalsePositive?: (findingId: string) => void;
  onSendToValidator?: (findingId: string) => void;
  onExplain?: (findingId: string) => void;
  onSendToCodingAgent?: (findingId: string, agentId: string) => void;
  onMarkFixed?: (findingId: string) => void;
}

export function FindingCard({
  finding,
  selected,
  selectionMode,
  validationResult,
  isValidating = false,
  onToggleSelect,
  onProposePatch,
  onMarkFalsePositive,
  onSendToValidator,
  onExplain,
  onSendToCodingAgent,
  onMarkFixed,
}: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const handoffRef = useRef<HTMLDivElement>(null);
  const handoffBtnRef = useRef<HTMLButtonElement>(null);
  const openFile = useOpenFile();
  const agentConfig = getAgentConfig(finding.agent);
  const categoryConfig = getCategoryConfig(finding.category);
  const severity = getSeverityConfig(finding.severity);
  const AgentIcon = AGENT_ICONS[finding.agent] || SettingsIcon;
  const CategoryIcon = getCategoryIcon(categoryConfig.icon);
  const severityDotColor = SEVERITY_DOT_COLOR[finding.severity] || "var(--cr-text-ghost)";

  // Close handoff dropdown on outside click
  useEffect(() => {
    if (!handoffOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = handoffRef.current?.contains(target);
      // Portal menu is rendered at z-index 9999
      const portalMenus = document.querySelectorAll("[style*='z-index: 9999']");
      let insidePortal = false;
      portalMenus.forEach((el) => {
        if (el.contains(target)) insidePortal = true;
      });
      if (!insideTrigger && !insidePortal) {
        setHandoffOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [handoffOpen]);

  const handleReVerify = () => onSendToValidator?.(finding.id);

  const verdictBadge = validationResult ? VERDICT_BADGE[validationResult.verdict] : null;
  const isStillPresent = validationResult?.verdict === "still_present" || validationResult?.verdict === "partially_fixed";
  const isFixed = validationResult?.verdict === "fixed";

  // Background color logic
  let bgColor = hovered && !selected && !isValidating && !isStillPresent && !isFixed
    ? "var(--cr-bg-hover)" : "transparent";
  if (selected) bgColor = "rgba(99,102,241,0.05)";
  if (isValidating) bgColor = "rgba(52,211,153,0.05)";
  if (isStillPresent && !isValidating) bgColor = "rgba(239,68,68,0.05)";
  if (isFixed && !isValidating) bgColor = "rgba(52,211,153,0.05)";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        transition: "background 200ms ease",
        borderBottom: "1px solid var(--cr-border-subtle)",
        background: bgColor,
      }}
    >
      {/* Header — always visible */}
      <div
        style={{ padding: "12px 16px", cursor: "pointer", userSelect: "none" }}
        onClick={() => {
          if (selectionMode && onToggleSelect) onToggleSelect(finding.id);
          else setExpanded((p) => !p);
        }}
      >
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {/* Selection checkbox OR severity dot */}
          {selectionMode ? (
            <div style={{
              width: 20, height: 20, borderRadius: 6,
              border: selected ? "2px solid #6366f1" : "2px solid var(--cr-border-strong)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginTop: 2,
              background: selected ? "#6366f1" : "transparent",
              boxShadow: selected ? "0 1px 4px rgba(99,102,241,0.3)" : "none",
              transition: "all 150ms ease",
            }}>
              {selected && <CheckIcon style={{ width: 12, height: 12, color: "white" }} strokeWidth={3} />}
            </div>
          ) : (
            <span title={severity.label}>
              <CircleIcon style={{
                width: 10, height: 10, flexShrink: 0, marginTop: 6,
                fill: severityDotColor, color: severityDotColor,
              }} strokeWidth={0} />
            </span>
          )}

          {/* Title + description */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--cr-text-primary)", lineHeight: 1.4, flex: 1, minWidth: 0 }}>
                {finding.title}
              </h3>

              {/* Verdict badge — inline, no overlap */}
              {verdictBadge && !isValidating && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 5,
                  borderRadius: 8, padding: "3px 9px",
                  border: `1px solid ${verdictBadge.borderColor}`,
                  background: verdictBadge.bgColor,
                  flexShrink: 0, whiteSpace: "nowrap",
                }}>
                  {verdictBadge.icon === "bug" ? (
                    <BugIcon style={{ width: 11, height: 11, color: verdictBadge.color }} />
                  ) : verdictBadge.icon === "shield" ? (
                    <ShieldCheckIcon style={{ width: 11, height: 11, color: verdictBadge.color }} />
                  ) : (
                    <ShieldAlertIcon style={{ width: 11, height: 11, color: verdictBadge.color }} />
                  )}
                  <span style={{ fontSize: 10, fontWeight: 600, color: verdictBadge.color }}>
                    {verdictBadge.label}
                  </span>
                </div>
              )}

              {/* Verifying badge — inline */}
              {isValidating && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.25)",
                  borderRadius: 8, padding: "3px 9px", flexShrink: 0, whiteSpace: "nowrap",
                }}>
                  <LoaderIcon style={{ width: 11, height: 11, color: "#34d399", animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#34d399" }}>Checking...</span>
                </div>
              )}
            </div>
            <p style={{
              fontSize: 11.5, color: "var(--cr-text-secondary)", lineHeight: 1.6, marginTop: 6,
              ...(expanded ? {} : {
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }),
            }}>
              {finding.description}
            </p>
          </div>

          {/* Expand chevron */}
          {!selectionMode && (
            <ChevronDownIcon style={{
              width: 16, height: 16, color: "var(--cr-text-ghost)", flexShrink: 0,
              marginTop: 2, transition: "transform 200ms ease",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }} />
          )}
        </div>

        {/* Meta row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginTop: 10,
          marginLeft: "calc(10px + 0.75rem)",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--cr-text-muted)" }}>
            <CategoryIcon style={{ width: 10, height: 10 }} />
            {categoryConfig.label}
          </span>
          <span style={{ color: "var(--cr-text-ghost)" }}>&middot;</span>
          <span style={{ fontSize: 10, color: "var(--cr-text-muted)" }}>{severity.label}</span>
          <span style={{ color: "var(--cr-text-ghost)" }}>&middot;</span>
          <span style={{ fontSize: 10, fontFamily: "var(--cr-font-mono)", color: "var(--cr-text-ghost)" }}>
            {Math.round(finding.confidence * 100)}%
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            marginLeft: "auto", fontSize: 10, color: "var(--cr-text-ghost)",
          }}>
            <AgentIcon style={{ width: 10, height: 10 }} />
            {agentConfig.shortLabel}
          </span>
        </div>

        {/* File chips */}
        {finding.evidence.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12,
            marginLeft: "calc(10px + 0.75rem)",
          }}>
            {finding.evidence.map((ev, i) => (
              <FileChip
                key={i}
                filePath={ev.filePath}
                line={ev.startLine}
                onClick={() => openFile(ev.filePath, ev.startLine)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {expanded && !selectionMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
              opacity: { duration: 0.2, delay: 0.05 },
            }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              display: "flex", flexDirection: "column", gap: 12,
              padding: "0 16px 16px",
              paddingLeft: "calc(10px + 0.75rem)",
            }}>
              {/* Evidence snippets */}
              {finding.evidence.map((ev, i) => (
                <div key={i} style={{
                  borderRadius: 6, border: "1px solid var(--cr-border-subtle)",
                  background: "var(--cr-bg-root)", overflow: "hidden",
                }}>
                  <FileHeader
                    filePath={ev.filePath}
                    startLine={ev.startLine}
                    endLine={ev.endLine}
                    onClick={() => openFile(ev.filePath, ev.startLine)}
                  />
                  <pre style={{
                    padding: "12px 14px", fontSize: 10.5, color: "var(--cr-text-secondary)",
                    fontFamily: "var(--cr-font-mono)", overflowX: "auto", maxHeight: 144,
                    lineHeight: 1.6, margin: 0,
                  }}>
                    {ev.snippet}
                  </pre>
                </div>
              ))}

              {/* Action Buttons */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 4 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Primary row */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {onExplain && (
                    <button onClick={() => onExplain(finding.id)} className="cr-btn cr-btn-purple">
                      <SparklesIcon style={{ width: 14, height: 14 }} />
                      Explain
                    </button>
                  )}
                  {onProposePatch && (
                    <button onClick={() => onProposePatch(finding.id)} className="cr-btn cr-btn-blue">
                      <WrenchIcon style={{ width: 14, height: 14 }} />
                      Generate Fix
                    </button>
                  )}
                  {onSendToValidator && (
                    <button
                      onClick={handleReVerify}
                      disabled={isValidating}
                      className="cr-btn cr-btn-emerald"
                      style={{
                        ...(isValidating ? { background: "rgba(52,211,153,0.10)", color: "rgba(52,211,153,0.6)", borderColor: "rgba(52,211,153,0.20)", cursor: "wait" } : {}),
                        ...(validationResult && isStillPresent ? { background: "rgba(239,68,68,0.15)", color: "#fca5a5", borderColor: "rgba(239,68,68,0.30)" } : {}),
                        ...(validationResult && isFixed ? { background: "rgba(52,211,153,0.15)", color: "#6ee7b7", borderColor: "rgba(52,211,153,0.30)" } : {}),
                      }}
                    >
                      {isValidating ? (
                        <LoaderIcon style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                      ) : validationResult ? (
                        isStillPresent ? <BugIcon style={{ width: 14, height: 14 }} /> : <CheckIcon style={{ width: 14, height: 14 }} />
                      ) : (
                        <ShieldCheckIcon style={{ width: 14, height: 14 }} />
                      )}
                      {isValidating ? "Checking Fix..." : validationResult ? verdictBadge?.label || "Re-check" : "Verify Fix"}
                    </button>
                  )}
                </div>

                {/* Secondary row */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {onSendToCodingAgent && (
                    <div style={{ position: "relative" }} ref={handoffRef}>
                      <button
                        ref={handoffBtnRef}
                        onClick={() => setHandoffOpen((p) => !p)}
                        className="cr-btn cr-btn-orange"
                      >
                        <SunIcon style={{ width: 14, height: 14 }} />
                        Handoff To
                        <ChevronDownIcon style={{
                          width: 12, height: 12,
                          transition: "transform 150ms ease",
                          transform: handoffOpen ? "rotate(180deg)" : "rotate(0deg)",
                        }} />
                      </button>
                      <HandoffMenu
                        open={handoffOpen}
                        triggerRef={handoffBtnRef}
                        onSelect={(agentId) => {
                          onSendToCodingAgent(finding.id, agentId);
                          setHandoffOpen(false);
                        }}
                      />
                    </div>
                  )}

                  <div style={{ flex: 1 }} />

                  {/* Mark Fixed — visible when validator says "fixed" */}
                  {onMarkFixed && isFixed && (
                    <button onClick={() => onMarkFixed(finding.id)} className="cr-btn cr-btn-emerald">
                      <CheckIcon style={{ width: 14, height: 14 }} />
                      Mark Fixed
                    </button>
                  )}

                  {onMarkFalsePositive && (
                    <button onClick={() => onMarkFalsePositive(finding.id)} className="cr-btn cr-btn-ghost">
                      <XCircleIcon style={{ width: 14, height: 14 }} />
                      False Positive
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
