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
import { cn } from "@/lib/utils";
import { getSeverityConfig, getAgentConfig, getCategoryConfig } from "@/lib/constants";
import { FileChip, FileHeader } from "@/components/shared/FileReference";
import { HandoffMenu } from "@/components/shared/HandoffMenu";
import { useOpenFile } from "@/contexts/OpenFileContext";
import type { Finding, AgentName } from "@/lib/types";

const AGENT_ICONS: Record<AgentName, React.FC<{ className?: string }>> = {
  architecture: LandmarkIcon,
  security: ShieldAlertIcon,
  bugs: BugIcon,
  validator: ShieldCheckIcon,
  explainer: BookOpenIcon,
  system: SettingsIcon,
};

/** Severity left-bar color classes — muted tones */
const SEVERITY_BAR: Record<string, string> = {
  critical: "bg-red-500/50",
  high: "bg-orange-500/40",
  medium: "bg-yellow-500/30",
  low: "bg-[var(--cr-text-ghost)]",
  info: "bg-[var(--cr-text-ghost)]",
};

function getCategoryIcon(icon: string) {
  switch (icon) {
    case "bug":
      return BugIcon;
    case "shield":
      return ShieldAlertIcon;
    case "landmark":
      return LandmarkIcon;
    default:
      return BugIcon;
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
  const handoffRef = useRef<HTMLDivElement>(null);
  const handoffBtnRef = useRef<HTMLButtonElement>(null);
  const openFile = useOpenFile();
  const severity = getSeverityConfig(finding.severity);
  const agentConfig = getAgentConfig(finding.agent);
  const categoryConfig = getCategoryConfig(finding.category);
  const AgentIcon = AGENT_ICONS[finding.agent] || SettingsIcon;
  const CategoryIcon = getCategoryIcon(categoryConfig.icon);
  const severityBar = SEVERITY_BAR[finding.severity] || "bg-[var(--cr-text-ghost)]";

  // Close handoff dropdown on outside click (accounts for portal menu)
  useEffect(() => {
    if (!handoffOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = handoffRef.current?.contains(target);
      const portalMenu = document.querySelector("[class*='z-\\[9999\\]']");
      const insidePortal = portalMenu?.contains(target);
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
      className="my-2 relative rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] hover:border-[var(--cr-border-strong)] overflow-hidden transition-all duration-200"
    >
      {/* Severity color bar — left edge indicator */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg", severityBar)} />

      {/* Main content area */}
      <div className="pl-3">
        {/* Header — always visible, clickable */}
        <button
          onClick={() => setExpanded((p) => !p)}
          className="w-full text-left px-3.5 pt-3 pb-2.5 hover:bg-[var(--cr-bg-hover)] transition-colors"
        >
          {/* Top row: plain text meta */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 text-[9px] text-[var(--cr-text-muted)]">
              <CategoryIcon className="size-2" />
              {categoryConfig.label}
            </span>
            <span className="text-[var(--cr-text-ghost)]">&middot;</span>
            <span className="text-[9px] text-[var(--cr-text-muted)]">{severity.label}</span>
            <span className="text-[var(--cr-text-ghost)]">&middot;</span>
            <span className="text-[9px] font-mono text-[var(--cr-text-ghost)]">{Math.round(finding.confidence * 100)}%</span>

            <div className="flex items-center gap-1.5 ml-auto">
              <span className="inline-flex items-center gap-0.5 text-[var(--cr-text-ghost)]">
                <AgentIcon className="size-2" />
              </span>
              <ChevronRightIcon
                className={cn(
                  "size-3 text-[var(--cr-text-ghost)] transition-transform duration-200",
                  expanded && "rotate-90"
                )}
              />
            </div>
          </div>

          {/* Title */}
          <h4 className="text-[12px] font-semibold text-[var(--cr-text-primary)] leading-snug mb-1.5">
            {finding.title}
          </h4>

          {/* Description preview */}
          <p className={cn(
            "text-[11px] text-[var(--cr-text-secondary)] leading-relaxed",
            !expanded && "line-clamp-2"
          )}>
            {finding.description}
          </p>

          {/* Referenced files — compact chips with colored extension badges */}
          {finding.evidence.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
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
              className="overflow-hidden"
            >
              <div className="px-3.5 pb-3.5 space-y-3 border-t border-[var(--cr-border-subtle)] pt-3">
                {/* Evidence snippets with proper file headers */}
                {finding.evidence.map((ev, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-primary)] overflow-hidden"
                  >
                    {/* Clickable file header with colored extension badge */}
                    <FileHeader
                      filePath={ev.filePath}
                      startLine={ev.startLine}
                      endLine={ev.endLine}
                      onClick={() => openFile(ev.filePath, ev.startLine)}
                    />
                    <pre className="px-3 py-2.5 text-[10.5px] text-[var(--cr-text-secondary)] font-mono overflow-x-auto max-h-28 leading-relaxed">
                      {ev.snippet}
                    </pre>
                  </div>
                ))}

                {/* Action buttons — matching FindingCard style */}
                <div
                  className="flex gap-1.5 pt-1 flex-wrap items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onExplain && (
                    <button
                      onClick={() => onExplain(finding.id)}
                      className="cr-btn cr-btn-sm cr-btn-purple"
                    >
                      <SparklesIcon className="size-3" />
                      Explain
                    </button>
                  )}
                  {onProposePatch && (
                    <button
                      onClick={() => onProposePatch(finding.id)}
                      className="cr-btn cr-btn-sm cr-btn-blue"
                    >
                      <WrenchIcon className="size-3" />
                      Fix
                    </button>
                  )}
                  {onSendToValidator && (
                    <button
                      onClick={() => onSendToValidator(finding.id)}
                      className="cr-btn cr-btn-sm cr-btn-emerald"
                    >
                      <ShieldCheckIcon className="size-3" />
                      Validate
                    </button>
                  )}

                  {/* Send to Coding Agent */}
                  {onSendToCodingAgent && (
                    <div className="relative" ref={handoffRef}>
                      <button
                        ref={handoffBtnRef}
                        onClick={() => setHandoffOpen((p) => !p)}
                        className="cr-btn cr-btn-sm cr-btn-orange"
                      >
                        <SendIcon className="size-3" />
                        Send to Agent
                        <ChevronRightIcon className={cn(
                          "size-3 transition-transform",
                          handoffOpen && "rotate-90"
                        )} />
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

                  {/* False positive — right-aligned, ghost button */}
                  {onMarkFalsePositive && (
                    <button
                      onClick={() => onMarkFalsePositive(finding.id)}
                      className="cr-btn cr-btn-sm cr-btn-ghost ml-auto"
                    >
                      <XCircleIcon className="size-3" />
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
