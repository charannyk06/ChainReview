import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LandmarkIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SettingsIcon,
  SparklesIcon,
  BookOpenIcon,
  XCircleIcon,
  ChevronRightIcon,
  BugIcon,
  WrenchIcon,
  SendIcon,
} from "lucide-react";
import { getSeverityConfig, getAgentConfig, getCategoryConfig } from "@/lib/constants";
import { FileChip, FileHeader } from "@/components/shared/FileReference";
import { HandoffMenu } from "@/components/shared/HandoffMenu";
import { useOpenFile } from "@/contexts/OpenFileContext";
import type { Finding, AgentName } from "@/lib/types";

const AGENT_ICONS: Record<AgentName, React.FC<{ style?: React.CSSProperties }>> = {
  architecture: LandmarkIcon,
  security: ShieldAlertIcon,
  bugs: BugIcon,
  validator: ShieldCheckIcon,
  explainer: BookOpenIcon,
  system: SettingsIcon,
};

const SEVERITY_BAR_COLOR: Record<string, string> = {
  critical: "rgba(239,68,68,0.50)",
  high: "rgba(249,115,22,0.40)",
  medium: "rgba(234,179,8,0.30)",
  low: "var(--cr-text-ghost)",
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

interface FindingInlineCardProps {
  finding: Finding;
  onProposePatch?: (findingId: string) => void;
  onMarkFalsePositive?: (findingId: string) => void;
  onSendToValidator?: (findingId: string) => void;
  onExplain?: (findingId: string) => void;
  onSendToCodingAgent?: (findingId: string, agentId?: string) => void;
}

export function FindingInlineCard({
  finding,
  onProposePatch,
  onMarkFalsePositive,
  onSendToValidator,
  onExplain,
  onSendToCodingAgent,
}: FindingInlineCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [cardHovered, setCardHovered] = useState(false);
  const handoffRef = useRef<HTMLDivElement>(null);
  const handoffBtnRef = useRef<HTMLButtonElement>(null);
  const openFile = useOpenFile();
  const severity = getSeverityConfig(finding.severity);
  const agentConfig = getAgentConfig(finding.agent);
  const categoryConfig = getCategoryConfig(finding.category);
  const AgentIcon = AGENT_ICONS[finding.agent] || SettingsIcon;
  const CategoryIcon = getCategoryIcon(categoryConfig.icon);
  const severityBar = SEVERITY_BAR_COLOR[finding.severity] || "var(--cr-text-ghost)";

  // Close handoff dropdown on outside click
  useEffect(() => {
    if (!handoffOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = handoffRef.current?.contains(target);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setCardHovered(true)}
      onMouseLeave={() => setCardHovered(false)}
      style={{
        margin: "8px 0",
        position: "relative",
        borderRadius: 12,
        border: `1px solid ${cardHovered ? "var(--cr-border-strong)" : "var(--cr-border)"}`,
        background: "var(--cr-bg-secondary)",
        overflow: "hidden",
        transition: "all 200ms ease",
      }}
    >
      {/* Severity color bar — left edge */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
        borderRadius: "12px 0 0 12px", background: severityBar,
      }} />

      {/* Main content area */}
      <div style={{ paddingLeft: 12 }}>
        {/* Header — clickable */}
        <button
          onClick={() => setExpanded((p) => !p)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "12px 14px 10px 14px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            transition: "background 150ms ease",
          }}
        >
          {/* Top row: meta */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, color: "var(--cr-text-muted)" }}>
              <CategoryIcon style={{ width: 8, height: 8 }} />
              {categoryConfig.label}
            </span>
            <span style={{ color: "var(--cr-text-ghost)" }}>&middot;</span>
            <span style={{ fontSize: 9, color: "var(--cr-text-muted)" }}>{severity.label}</span>
            <span style={{ color: "var(--cr-text-ghost)" }}>&middot;</span>
            <span style={{ fontSize: 9, fontFamily: "var(--cr-font-mono)", color: "var(--cr-text-ghost)" }}>
              {Math.round(finding.confidence * 100)}%
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "var(--cr-text-ghost)" }}>
                <AgentIcon style={{ width: 8, height: 8 }} />
              </span>
              <ChevronRightIcon style={{
                width: 12, height: 12, color: "var(--cr-text-ghost)",
                transition: "transform 200ms ease",
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              }} />
            </div>
          </div>

          {/* Title */}
          <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--cr-text-primary)", lineHeight: 1.4, marginBottom: 6 }}>
            {finding.title}
          </h4>

          {/* Description */}
          <p style={{
            fontSize: 11, color: "var(--cr-text-secondary)", lineHeight: 1.6,
            ...(expanded ? {} : {
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            }),
          }}>
            {finding.description}
          </p>

          {/* File chips */}
          {finding.evidence.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
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
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: "hidden" }}
            >
              <div style={{
                padding: "0 14px 14px 14px",
                display: "flex", flexDirection: "column", gap: 12,
                borderTop: "1px solid var(--cr-border-subtle)", paddingTop: 12,
              }}>
                {/* Evidence snippets */}
                {finding.evidence.map((ev, i) => (
                  <div key={i} style={{
                    borderRadius: 8, border: "1px solid var(--cr-border-subtle)",
                    background: "var(--cr-bg-primary)", overflow: "hidden",
                  }}>
                    <FileHeader
                      filePath={ev.filePath}
                      startLine={ev.startLine}
                      endLine={ev.endLine}
                      onClick={() => openFile(ev.filePath, ev.startLine)}
                    />
                    <pre style={{
                      padding: "10px 12px", fontSize: 10.5, color: "var(--cr-text-secondary)",
                      fontFamily: "var(--cr-font-mono)", overflowX: "auto", maxHeight: 112,
                      lineHeight: 1.6, margin: 0,
                    }}>
                      {ev.snippet}
                    </pre>
                  </div>
                ))}

                {/* Action buttons */}
                <div
                  style={{ display: "flex", gap: 6, paddingTop: 4, flexWrap: "wrap", alignItems: "center" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {onExplain && (
                    <button onClick={() => onExplain(finding.id)} className="cr-btn cr-btn-sm cr-btn-purple">
                      <SparklesIcon style={{ width: 12, height: 12 }} />
                      Explain
                    </button>
                  )}
                  {onProposePatch && (
                    <button onClick={() => onProposePatch(finding.id)} className="cr-btn cr-btn-sm cr-btn-blue">
                      <WrenchIcon style={{ width: 12, height: 12 }} />
                      Fix
                    </button>
                  )}
                  {onSendToValidator && (
                    <button onClick={() => onSendToValidator(finding.id)} className="cr-btn cr-btn-sm cr-btn-emerald">
                      <ShieldCheckIcon style={{ width: 12, height: 12 }} />
                      Validate
                    </button>
                  )}

                  {/* Send to Coding Agent */}
                  {onSendToCodingAgent && (
                    <div style={{ position: "relative" }} ref={handoffRef}>
                      <button
                        ref={handoffBtnRef}
                        onClick={() => setHandoffOpen((p) => !p)}
                        className="cr-btn cr-btn-sm cr-btn-orange"
                      >
                        <SendIcon style={{ width: 12, height: 12 }} />
                        Send to Agent
                        <ChevronRightIcon style={{
                          width: 12, height: 12,
                          transition: "transform 150ms ease",
                          transform: handoffOpen ? "rotate(90deg)" : "rotate(0deg)",
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

                  {/* False positive */}
                  {onMarkFalsePositive && (
                    <button
                      onClick={() => onMarkFalsePositive(finding.id)}
                      className="cr-btn cr-btn-sm cr-btn-ghost"
                      style={{ marginLeft: "auto" }}
                    >
                      <XCircleIcon style={{ width: 12, height: 12 }} />
                      False Positive
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
