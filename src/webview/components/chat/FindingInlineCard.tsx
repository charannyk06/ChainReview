import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LandmarkIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SettingsIcon,
  SparklesIcon,
  XCircleIcon,
  ChevronRightIcon,
  BugIcon,
  ClipboardCopyIcon,
  WrenchIcon,
  SendIcon,
  ZapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SEVERITY_CONFIG, AGENT_CONFIG, CATEGORY_CONFIG, CODING_AGENTS } from "@/lib/constants";
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
  info: "bg-neutral-500",
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
  const openFile = useOpenFile();
  const severity = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.info;
  const agentConfig = AGENT_CONFIG[finding.agent];
  const categoryConfig = CATEGORY_CONFIG[finding.category];
  const AgentIcon = AGENT_ICONS[finding.agent] || SettingsIcon;
  const CategoryIcon = getCategoryIcon(categoryConfig.icon);
  const severityBar = SEVERITY_BAR[finding.severity] || "bg-neutral-500";

  // Close handoff dropdown on outside click
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="my-1.5 relative rounded-lg border border-neutral-800 bg-neutral-900/80 hover:border-neutral-700 overflow-hidden transition-all duration-200"
    >
      {/* Severity color bar — left edge indicator */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg", severityBar)} />

      {/* Main content area */}
      <div className="pl-3">
        {/* Header — always visible, clickable */}
        <button
          onClick={() => setExpanded((p) => !p)}
          className="w-full text-left px-3 pt-2.5 pb-2 hover:bg-neutral-800/20 transition-colors"
        >
          {/* Top row: badges and meta */}
          <div className="flex items-center gap-1.5 mb-1.5">
            {/* Category pill */}
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                categoryConfig.bgColor,
                categoryConfig.color
              )}
            >
              <CategoryIcon className="size-2.5" />
              {categoryConfig.label}
            </span>

            {/* Severity pill */}
            <span
              className={cn(
                "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                severity.bgColor,
                severity.color
              )}
            >
              {severity.label}
            </span>

            {/* Right-aligned: agent + confidence + chevron */}
            <div className="flex items-center gap-1.5 ml-auto">
              {/* Confidence meter */}
              <div className="flex items-center gap-1">
                <div className="w-6 h-1 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      finding.confidence >= 0.8 ? "bg-green-500" :
                      finding.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${Math.round(finding.confidence * 100)}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-neutral-500">
                  {Math.round(finding.confidence * 100)}%
                </span>
              </div>

              {/* Agent icon */}
              <div className={cn("flex items-center gap-0.5", agentConfig.color)}>
                <AgentIcon className="size-2.5" />
              </div>

              {/* Expand chevron */}
              <ChevronRightIcon
                className={cn(
                  "size-3 text-neutral-600 transition-transform duration-200",
                  expanded && "rotate-90"
                )}
              />
            </div>
          </div>

          {/* Title */}
          <h4 className="text-[12px] font-semibold text-neutral-100 leading-snug mb-1">
            {finding.title}
          </h4>

          {/* Description preview */}
          <p className={cn(
            "text-[10px] text-neutral-400 leading-relaxed",
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
              <div className="px-3 pb-3 space-y-2.5 border-t border-neutral-800/50 pt-2.5">
                {/* Evidence snippets with proper file headers */}
                {finding.evidence.map((ev, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-neutral-800/60 bg-neutral-950/60 overflow-hidden"
                  >
                    {/* Clickable file header with colored extension badge */}
                    <FileHeader
                      filePath={ev.filePath}
                      startLine={ev.startLine}
                      endLine={ev.endLine}
                      onClick={() => openFile(ev.filePath, ev.startLine)}
                    />
                    <pre className="px-2.5 py-2 text-[10px] text-neutral-300 font-mono overflow-x-auto max-h-28 leading-relaxed">
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
                      className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-md bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20 transition-all hover:border-purple-500/30"
                    >
                      <SparklesIcon className="size-3" />
                      Explain
                    </button>
                  )}
                  {onProposePatch && (
                    <button
                      onClick={() => onProposePatch(finding.id)}
                      className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-md bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-blue-500/20 transition-all hover:border-blue-500/30"
                    >
                      <WrenchIcon className="size-3" />
                      Fix
                    </button>
                  )}
                  {onSendToValidator && (
                    <button
                      onClick={() => onSendToValidator(finding.id)}
                      className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-md bg-green-500/10 text-green-300 hover:bg-green-500/20 border border-green-500/20 transition-all hover:border-green-500/30"
                    >
                      <ShieldCheckIcon className="size-3" />
                      Validate
                    </button>
                  )}

                  {/* Send to Coding Agent */}
                  {onSendToCodingAgent && (
                    <div className="relative" ref={handoffRef}>
                      <button
                        onClick={() => setHandoffOpen((p) => !p)}
                        className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-md bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 border border-orange-500/25 transition-all hover:border-orange-500/40"
                      >
                        <SendIcon className="size-3" />
                        Send to Agent
                        <ChevronRightIcon className={cn(
                          "size-3 transition-transform",
                          handoffOpen && "rotate-90"
                        )} />
                      </button>
                      <AnimatePresence>
                        {handoffOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-full left-0 mb-1 w-52 rounded-lg border border-neutral-700/60 bg-neutral-900 shadow-2xl z-50 overflow-hidden"
                          >
                            <div className="px-2 py-1.5 border-b border-neutral-800/60">
                              <span className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">
                                Send to
                              </span>
                            </div>
                            {CODING_AGENTS.map((agent) => (
                              <button
                                key={agent.id}
                                onClick={() => {
                                  onSendToCodingAgent(finding.id, agent.id);
                                  setHandoffOpen(false);
                                }}
                                className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-neutral-800/60 transition-colors"
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
                                  <ClipboardCopyIcon className="size-4 text-neutral-400" />
                                )}
                                <div className="flex flex-col">
                                  <span className={cn("text-[11px] font-medium", agent.color)}>
                                    {agent.label}
                                  </span>
                                  {agent.id === "claude-code" && (
                                    <span className="text-[9px] text-neutral-600">
                                      Opens in terminal
                                    </span>
                                  )}
                                </div>
                                {agent.id !== "clipboard" && (
                                  <ZapIcon className="size-3 text-neutral-700 ml-auto" />
                                )}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* False positive — right-aligned, subtle */}
                  {onMarkFalsePositive && (
                    <button
                      onClick={() => onMarkFalsePositive(finding.id)}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-md text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 transition-colors ml-auto"
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
