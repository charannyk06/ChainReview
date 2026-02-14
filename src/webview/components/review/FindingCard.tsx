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
  ClipboardCopyIcon,
  CheckIcon,
  WrenchIcon,
  ExternalLinkIcon,
  LoaderIcon,
  CircleIcon,
  SunIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAgentConfig, getSeverityConfig, getCategoryConfig } from "@/lib/constants";
import { HandoffMenu } from "@/components/shared/HandoffMenu";
import { FileChip, FileHeader } from "@/components/shared/FileReference";
import { useOpenFile } from "@/contexts/OpenFileContext";
import type { Finding, AgentName, ValidationResult, ValidatorVerdict } from "@/lib/types";

const AGENT_ICONS: Record<AgentName, React.FC<{ className?: string }>> = {
  architecture: LandmarkIcon,
  security: ShieldAlertIcon,
  bugs: BugIcon,
  validator: ShieldCheckIcon,
  explainer: SparklesIcon,
  system: SettingsIcon,
};

/** Severity dot color classes — subtle, muted tones */
const SEVERITY_DOT: Record<string, string> = {
  critical: "text-red-500/60",
  high: "text-orange-500/50",
  medium: "text-yellow-500/40",
  low: "text-[var(--cr-text-muted)]",
  info: "text-[var(--cr-text-ghost)]",
};

/** Get the category icon component */
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
  className?: string;
}

/** Verdict badge config */
const VERDICT_BADGE: Record<ValidatorVerdict, { label: string; color: string; bgColor: string; borderColor: string; icon: "shield" | "bug" | "help" }> = {
  confirmed: { label: "Confirmed Bug", color: "text-red-400", bgColor: "bg-red-500/10", borderColor: "border-red-500/20", icon: "bug" },
  likely_valid: { label: "Likely Bug", color: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-[var(--cr-border-strong)]", icon: "bug" },
  uncertain: { label: "Uncertain", color: "text-yellow-400", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/20", icon: "help" },
  likely_false_positive: { label: "Likely OK", color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20", icon: "shield" },
  false_positive: { label: "No Bug — Verified", color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20", icon: "shield" },
};

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
  className,
}: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const handoffRef = useRef<HTMLDivElement>(null);
  const openFile = useOpenFile();
  const agentConfig = getAgentConfig(finding.agent);
  const categoryConfig = getCategoryConfig(finding.category);
  const severity = getSeverityConfig(finding.severity);
  const AgentIcon = AGENT_ICONS[finding.agent] || SettingsIcon;
  const CategoryIcon = getCategoryIcon(categoryConfig.icon);
  const severityDotColor = SEVERITY_DOT[finding.severity] || "text-gray-400";

  // Close handoff dropdown when clicking outside
  useEffect(() => {
    if (!handoffOpen) return;
    const handler = (e: MouseEvent) => {
      if (handoffRef.current && !handoffRef.current.contains(e.target as Node)) {
        setHandoffOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [handoffOpen]);

  const handleReVerify = () => {
    onSendToValidator?.(finding.id);
  };

  // Derive badge from actual validation result
  const verdictBadge = validationResult ? VERDICT_BADGE[validationResult.verdict] : null;
  const isConfirmedBug = validationResult?.verdict === "confirmed" || validationResult?.verdict === "likely_valid";
  const isVerifiedClean = validationResult?.verdict === "false_positive" || validationResult?.verdict === "likely_false_positive";

  return (
    <motion.div
      layout
      className={cn(
        "group relative rounded-xl transition-all duration-200",
        selected
          ? "border-2 border-indigo-500/50 bg-indigo-500/5 shadow-[0_0_15px_rgba(99,102,241,0.08)]"
          : "border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] hover:border-[var(--cr-border-strong)] hover:shadow-md hover:shadow-black/20",
        isValidating && "ring-1 ring-emerald-500/30 border-emerald-500/20",
        isConfirmedBug && !isValidating && "ring-1 ring-red-500/20 border-red-500/15",
        isVerifiedClean && !isValidating && "ring-1 ring-emerald-500/20 border-emerald-500/15",
        className
      )}
    >
      {/* Verifying overlay indicator */}
      {isValidating && (
        <div className="absolute top-3.5 right-3.5 z-10">
          <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 rounded-lg px-2.5 py-1">
            <LoaderIcon className="size-3 text-emerald-400 animate-spin" />
            <span className="text-[10px] font-semibold text-emerald-400">Verifying...</span>
          </div>
        </div>
      )}

      {/* Verdict badge */}
      {verdictBadge && !isValidating && (
        <div className="absolute top-3.5 right-3.5 z-10">
          <div className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 border", verdictBadge.bgColor, verdictBadge.borderColor)}>
            {verdictBadge.icon === "bug" ? (
              <BugIcon className={cn("size-3", verdictBadge.color)} />
            ) : verdictBadge.icon === "shield" ? (
              <ShieldCheckIcon className={cn("size-3", verdictBadge.color)} />
            ) : (
              <ShieldAlertIcon className={cn("size-3", verdictBadge.color)} />
            )}
            <span className={cn("text-[10px] font-semibold", verdictBadge.color)}>
              {verdictBadge.label}
            </span>
          </div>
        </div>
      )}

      {/* Header — always visible */}
      <div
        className="px-4 pt-3 pb-3 cursor-pointer select-none"
        onClick={() => {
          if (selectionMode && onToggleSelect) {
            onToggleSelect(finding.id);
          } else {
            setExpanded((p) => !p);
          }
        }}
      >
        {/* Top row: severity dot + title + meta */}
        <div className="flex items-start gap-3">
          {/* Selection checkbox OR severity dot */}
          {selectionMode ? (
            <div
              className={cn(
                "size-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                selected
                  ? "bg-indigo-500 border-indigo-500 shadow-sm shadow-indigo-500/30"
                  : "border-[var(--cr-border-strong)] bg-transparent hover:border-indigo-400/50"
              )}
            >
              {selected && <CheckIcon className="size-3 text-white" strokeWidth={3} />}
            </div>
          ) : (
            <CircleIcon
              className={cn("size-2.5 shrink-0 mt-1.5 fill-current", severityDotColor)}
              strokeWidth={0}
              title={severity.label}
            />
          )}

          {/* Title + description */}
          <div className="flex-1 min-w-0 pr-6">
            <h3 className="text-[13px] font-semibold text-[var(--cr-text-primary)] leading-snug">
              {finding.title}
            </h3>
            <p className={cn(
              "text-[11.5px] text-[var(--cr-text-secondary)] leading-relaxed mt-1.5",
              !expanded && "line-clamp-2"
            )}>
              {finding.description}
            </p>
          </div>

          {/* Expand chevron */}
          {!selectionMode && (
            <ChevronDownIcon
              className={cn(
                "size-4 text-[var(--cr-text-ghost)] shrink-0 mt-0.5 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          )}
        </div>

        {/* Meta row: plain text labels — aligned with title (past severity dot + gap) */}
        <div className="flex items-center gap-3 mt-2.5" style={{ marginLeft: 'calc(10px + 0.75rem)' }}>
          {/* Category — plain text */}
          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--cr-text-muted)]">
            <CategoryIcon className="size-2.5" />
            {categoryConfig.label}
          </span>

          <span className="text-[var(--cr-text-ghost)]">&middot;</span>

          {/* Severity — plain text */}
          <span className="text-[10px] text-[var(--cr-text-muted)]">
            {severity.label}
          </span>

          <span className="text-[var(--cr-text-ghost)]">&middot;</span>

          {/* Confidence — plain mono number */}
          <span className="text-[10px] font-mono text-[var(--cr-text-ghost)] tabular-nums">
            {Math.round(finding.confidence * 100)}%
          </span>

          {/* Agent — right-aligned, ghost */}
          <span className="inline-flex items-center gap-1 ml-auto text-[10px] text-[var(--cr-text-ghost)]">
            <AgentIcon className="size-2.5" />
            {agentConfig.shortLabel}
          </span>
        </div>

        {/* Referenced files — compact chips, aligned with title */}
        {finding.evidence.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3" style={{ marginLeft: 'calc(10px + 0.75rem)' }}>
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
      <AnimatePresence>
        {expanded && !selectionMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3" style={{ paddingLeft: 'calc(16px + 10px + 0.75rem)' }}>
              {/* Evidence snippets with proper file headers */}
              {finding.evidence.map((ev, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-primary)] overflow-hidden"
                >
                  <FileHeader
                    filePath={ev.filePath}
                    startLine={ev.startLine}
                    endLine={ev.endLine}
                    onClick={() => openFile(ev.filePath, ev.startLine)}
                  />
                  <pre className="px-3.5 py-3 text-[10.5px] text-[var(--cr-text-secondary)] font-mono overflow-x-auto max-h-36 leading-relaxed">
                    {ev.snippet}
                  </pre>
                </div>
              ))}

              {/* Action Buttons */}
              <div
                className="flex flex-col gap-3 pt-1"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Primary actions row */}
                <div className="flex gap-2 flex-wrap">
                  {onExplain && (
                    <button
                      onClick={() => onExplain(finding.id)}
                      className="cr-btn cr-btn-purple"
                    >
                      <SparklesIcon className="size-3.5" />
                      Explain
                    </button>
                  )}

                  {onProposePatch && (
                    <button
                      onClick={() => onProposePatch(finding.id)}
                      className="cr-btn cr-btn-blue"
                    >
                      <WrenchIcon className="size-3.5" />
                      Generate Fix
                    </button>
                  )}

                  {onSendToValidator && (
                    <button
                      onClick={handleReVerify}
                      disabled={isValidating}
                      className={cn(
                        "cr-btn",
                        isValidating
                          ? "bg-emerald-500/10 text-emerald-400/60 border-emerald-500/20 cursor-wait"
                          : validationResult
                          ? isConfirmedBug
                            ? "bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25"
                            : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                          : "cr-btn-emerald"
                      )}
                    >
                      {isValidating ? (
                        <LoaderIcon className="size-3.5 animate-spin" />
                      ) : validationResult ? (
                        isConfirmedBug ? <BugIcon className="size-3.5" /> : <CheckIcon className="size-3.5" />
                      ) : (
                        <ShieldCheckIcon className="size-3.5" />
                      )}
                      {isValidating
                        ? "Verifying..."
                        : validationResult
                        ? verdictBadge?.label || "Re-Verify"
                        : "Verify"}
                    </button>
                  )}
                </div>

                {/* Secondary actions row */}
                <div className="flex gap-2 items-center flex-wrap">
                  {/* Handoff To — dropdown trigger */}
                  {onSendToCodingAgent && (
                    <div className="relative" ref={handoffRef}>
                      <button
                        onClick={() => setHandoffOpen((p) => !p)}
                        className="cr-btn cr-btn-orange"
                      >
                        <SunIcon className="size-3.5" />
                        Handoff To
                        <ChevronDownIcon className={cn(
                          "size-3 transition-transform",
                          handoffOpen && "rotate-180"
                        )} />
                      </button>
                      <HandoffMenu
                        open={handoffOpen}
                        onSelect={(agentId) => {
                          onSendToCodingAgent(finding.id, agentId);
                          setHandoffOpen(false);
                        }}
                        align="left"
                      />
                    </div>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* False positive — right-aligned, ghost style */}
                  {onMarkFalsePositive && (
                    <button
                      onClick={() => onMarkFalsePositive(finding.id)}
                      className="cr-btn cr-btn-ghost"
                    >
                      <XCircleIcon className="size-3.5" />
                      False Positive
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
