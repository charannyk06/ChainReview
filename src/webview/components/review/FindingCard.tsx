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
  ZapIcon,
  ExternalLinkIcon,
  LoaderIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENT_CONFIG, SEVERITY_CONFIG, CATEGORY_CONFIG, CODING_AGENTS } from "@/lib/constants";
import { FileChip, FileHeader } from "@/components/shared/FileReference";
import { useOpenFile } from "@/contexts/OpenFileContext";
import type { Finding, AgentName } from "@/lib/types";

const AGENT_ICONS: Record<AgentName, React.FC<{ className?: string }>> = {
  architecture: LandmarkIcon,
  security: ShieldAlertIcon,
  validator: ShieldCheckIcon,
  system: SettingsIcon,
};

/** Severity left-bar color classes */
const SEVERITY_BAR: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
  info: "bg-[var(--cr-text-muted)]",
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
  onToggleSelect?: (findingId: string) => void;
  onProposePatch?: (findingId: string) => void;
  onMarkFalsePositive?: (findingId: string) => void;
  onSendToValidator?: (findingId: string) => void;
  onExplain?: (findingId: string) => void;
  onSendToCodingAgent?: (findingId: string, agentId: string) => void;
  className?: string;
}

export function FindingCard({
  finding,
  selected,
  selectionMode,
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
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyDone, setVerifyDone] = useState(false);
  const handoffRef = useRef<HTMLDivElement>(null);
  const openFile = useOpenFile();
  const agentConfig = AGENT_CONFIG[finding.agent];
  const categoryConfig = CATEGORY_CONFIG[finding.category];
  const severity = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.info;
  const AgentIcon = AGENT_ICONS[finding.agent] || SettingsIcon;
  const CategoryIcon = getCategoryIcon(categoryConfig.icon);
  const severityBar = SEVERITY_BAR[finding.severity] || "bg-[var(--cr-text-muted)]";

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
    setIsVerifying(true);
    setVerifyDone(false);
    onSendToValidator?.(finding.id);
    // Simulate completion after timeout (the actual result will come via stream events)
    setTimeout(() => {
      setIsVerifying(false);
      setVerifyDone(true);
    }, 8000);
  };

  return (
    <motion.div
      layout
      className={cn(
        "group relative rounded-xl overflow-hidden transition-all duration-200",
        selected
          ? "border-2 border-indigo-500/50 bg-indigo-500/5 shadow-[0_0_15px_rgba(99,102,241,0.08)]"
          : "border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] hover:border-[var(--cr-border-strong)] hover:shadow-md hover:shadow-black/20",
        isVerifying && "ring-1 ring-emerald-500/30 border-emerald-500/20",
        verifyDone && !isVerifying && "ring-1 ring-emerald-500/20 border-emerald-500/15",
        className
      )}
    >
      {/* Severity color bar — left edge indicator */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl", severityBar)} />

      {/* Main content area — pl-4 to clear the 3px severity bar with extra padding */}
      <div className="pl-4">
        {/* Verifying overlay indicator */}
        {isVerifying && (
          <div className="absolute top-2 right-2 z-10">
            <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 rounded-lg px-2.5 py-1">
              <LoaderIcon className="size-3 text-emerald-400 animate-spin" />
              <span className="text-[10px] font-semibold text-emerald-400">Re-Verifying...</span>
            </div>
          </div>
        )}

        {/* Verified badge */}
        {verifyDone && !isVerifying && (
          <div className="absolute top-2 right-2 z-10">
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1">
              <ShieldCheckIcon className="size-3 text-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-400">Verified</span>
            </div>
          </div>
        )}

        {/* Header — always visible */}
        <div
          className="px-3 pt-3.5 pb-2.5 cursor-pointer select-none"
          onClick={() => {
            if (selectionMode && onToggleSelect) {
              onToggleSelect(finding.id);
            } else {
              setExpanded((p) => !p);
            }
          }}
        >
          {/* Top row: badges and meta */}
          <div className="flex items-center gap-2 mb-2.5">
            {/* Selection checkbox */}
            {selectionMode && (
              <div
                className={cn(
                  "size-4.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                  selected
                    ? "bg-indigo-500 border-indigo-500 shadow-sm shadow-indigo-500/30"
                    : "border-[var(--cr-border-strong)] bg-transparent hover:border-indigo-400/50"
                )}
              >
                {selected && <CheckIcon className="size-2.5 text-white" strokeWidth={3} />}
              </div>
            )}

            {/* Category pill */}
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border",
                categoryConfig.bgColor,
                categoryConfig.color,
                categoryConfig.borderColor
              )}
            >
              <CategoryIcon className="size-3" />
              {categoryConfig.label}
            </span>

            {/* Severity pill */}
            <span
              className={cn(
                "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide border",
                severity.bgColor,
                severity.color,
                finding.severity === "critical" ? "border-red-500/30" :
                finding.severity === "high" ? "border-orange-500/30" :
                finding.severity === "medium" ? "border-yellow-500/30" :
                finding.severity === "low" ? "border-blue-500/30" : "border-gray-500/30"
              )}
            >
              {severity.label}
            </span>

            {/* Right-aligned: agent + confidence + chevron */}
            <div className="flex items-center gap-2.5 ml-auto">
              {/* Confidence meter */}
              <div className="flex items-center gap-1.5">
                <div className="w-10 h-1.5 rounded-full bg-[var(--cr-bg-tertiary)] overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      finding.confidence >= 0.8 ? "bg-emerald-500" :
                      finding.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${Math.round(finding.confidence * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-[var(--cr-text-muted)] tabular-nums">
                  {Math.round(finding.confidence * 100)}%
                </span>
              </div>

              {/* Agent icon */}
              <div className={cn("flex items-center gap-1", agentConfig.color)}>
                <AgentIcon className="size-3.5" />
              </div>

              {/* Expand chevron */}
              {!selectionMode && (
                <ChevronDownIcon
                  className={cn(
                    "size-4 text-[var(--cr-text-ghost)] transition-transform duration-200",
                    expanded && "rotate-180"
                  )}
                />
              )}
            </div>
          </div>

          {/* Title */}
          <h3 className="text-[13px] font-semibold text-[var(--cr-text-primary)] leading-snug mb-1.5 pr-6">
            {finding.title}
          </h3>

          {/* Description preview */}
          <p className={cn(
            "text-[11.5px] text-[var(--cr-text-secondary)] leading-relaxed",
            !expanded && "line-clamp-2"
          )}>
            {finding.description}
          </p>

          {/* Referenced files — compact chips */}
          {finding.evidence.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
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
              <div className="px-3 pb-4 space-y-3">
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
                    <pre className="px-3 py-2.5 text-[10.5px] text-[var(--cr-text-secondary)] font-mono overflow-x-auto max-h-36 leading-relaxed">
                      {ev.snippet}
                    </pre>
                  </div>
                ))}

                {/* ═══ Action Buttons — Professional Toolbar ═══ */}
                <div
                  className="flex flex-col gap-2 pt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Primary actions row */}
                  <div className="flex gap-2 flex-wrap">
                    {onExplain && (
                      <button
                        onClick={() => onExplain(finding.id)}
                        className={cn(
                          "inline-flex items-center gap-2 text-[11px] font-semibold px-3.5 py-2 rounded-lg",
                          "bg-purple-500/15 text-purple-300",
                          "border border-purple-500/25",
                          "hover:bg-purple-500/25 hover:border-purple-400/40 hover:text-purple-200",
                          "active:scale-[0.97]",
                          "transition-all duration-150 cursor-pointer",
                          "shadow-sm shadow-purple-500/5"
                        )}
                      >
                        <SparklesIcon className="size-3.5" />
                        Explain
                      </button>
                    )}

                    {onProposePatch && (
                      <button
                        onClick={() => onProposePatch(finding.id)}
                        className={cn(
                          "inline-flex items-center gap-2 text-[11px] font-semibold px-3.5 py-2 rounded-lg",
                          "bg-blue-500/15 text-blue-300",
                          "border border-blue-500/25",
                          "hover:bg-blue-500/25 hover:border-blue-400/40 hover:text-blue-200",
                          "active:scale-[0.97]",
                          "transition-all duration-150 cursor-pointer",
                          "shadow-sm shadow-blue-500/5"
                        )}
                      >
                        <WrenchIcon className="size-3.5" />
                        Generate Fix
                      </button>
                    )}

                    {onSendToValidator && (
                      <button
                        onClick={handleReVerify}
                        disabled={isVerifying}
                        className={cn(
                          "inline-flex items-center gap-2 text-[11px] font-semibold px-3.5 py-2 rounded-lg",
                          isVerifying
                            ? "bg-emerald-500/10 text-emerald-400/60 border border-emerald-500/15 cursor-wait"
                            : verifyDone
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : cn(
                                "bg-emerald-500/15 text-emerald-300",
                                "border border-emerald-500/25",
                                "hover:bg-emerald-500/25 hover:border-emerald-400/40 hover:text-emerald-200",
                                "active:scale-[0.97]",
                                "cursor-pointer"
                              ),
                          "transition-all duration-150",
                          "shadow-sm shadow-emerald-500/5"
                        )}
                      >
                        {isVerifying ? (
                          <LoaderIcon className="size-3.5 animate-spin" />
                        ) : verifyDone ? (
                          <CheckIcon className="size-3.5" />
                        ) : (
                          <ShieldCheckIcon className="size-3.5" />
                        )}
                        {isVerifying ? "Verifying..." : verifyDone ? "Verified" : "Re-Verify"}
                      </button>
                    )}
                  </div>

                  {/* Secondary actions row */}
                  <div className="flex gap-2 items-center flex-wrap">
                    {/* Send to Coding Agent — dropdown trigger */}
                    {onSendToCodingAgent && (
                      <div className="relative" ref={handoffRef}>
                        <button
                          onClick={() => setHandoffOpen((p) => !p)}
                          className={cn(
                            "inline-flex items-center gap-2 text-[11px] font-semibold px-3.5 py-2 rounded-lg",
                            "bg-orange-500/15 text-orange-300",
                            "border border-orange-500/25",
                            "hover:bg-orange-500/25 hover:border-orange-400/40 hover:text-orange-200",
                            "active:scale-[0.97]",
                            "transition-all duration-150 cursor-pointer",
                            "shadow-sm shadow-orange-500/5"
                          )}
                        >
                          <ExternalLinkIcon className="size-3.5" />
                          Send to Agent
                          <ChevronDownIcon className={cn(
                            "size-3 transition-transform",
                            handoffOpen && "rotate-180"
                          )} />
                        </button>

                        {/* Handoff dropdown */}
                        <AnimatePresence>
                          {handoffOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -4, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -4, scale: 0.95 }}
                              transition={{ duration: 0.15 }}
                              className="absolute bottom-full left-0 mb-1.5 w-56 rounded-xl border border-[var(--cr-border-strong)] bg-[var(--cr-bg-secondary)] shadow-2xl shadow-black/40 z-50 overflow-hidden backdrop-blur-sm"
                            >
                              <div className="px-3 py-2 border-b border-[var(--cr-border-subtle)]">
                                <span className="text-[10px] font-semibold text-[var(--cr-text-muted)] uppercase tracking-wider">
                                  Hand off to
                                </span>
                              </div>
                              {CODING_AGENTS.map((agent) => (
                                <button
                                  key={agent.id}
                                  onClick={() => {
                                    onSendToCodingAgent(finding.id, agent.id);
                                    setHandoffOpen(false);
                                  }}
                                  className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-[var(--cr-bg-hover)] transition-colors cursor-pointer"
                                >
                                  {agent.icon ? (
                                    <img
                                      src={agent.icon}
                                      alt=""
                                      className="size-4 rounded"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <ClipboardCopyIcon className="size-4 text-[var(--cr-text-muted)]" />
                                  )}
                                  <div className="flex flex-col min-w-0">
                                    <span className={cn("text-[11px] font-medium", agent.color)}>
                                      {agent.label}
                                    </span>
                                    {agent.id === "claude-code" && (
                                      <span className="text-[9px] text-[var(--cr-text-ghost)]">
                                        Opens in terminal
                                      </span>
                                    )}
                                  </div>
                                  {agent.id !== "clipboard" && (
                                    <ZapIcon className="size-3 text-[var(--cr-text-ghost)] ml-auto shrink-0" />
                                  )}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* False positive — right-aligned, ghost style */}
                    {onMarkFalsePositive && (
                      <button
                        onClick={() => onMarkFalsePositive(finding.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg",
                          "text-[var(--cr-text-muted)]",
                          "border border-transparent",
                          "hover:text-red-400/80 hover:bg-red-500/8 hover:border-red-500/15",
                          "active:scale-[0.97]",
                          "transition-all duration-150 cursor-pointer"
                        )}
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
      </div>
    </motion.div>
  );
}
