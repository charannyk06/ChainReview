import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronRightIcon,
  LandmarkIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SettingsIcon,
  BotIcon,
  BugIcon,
  BookOpenIcon,
  LoaderCircleIcon,
  CheckCircle2Icon,
  CircleXIcon,
  SearchIcon,
  FileIcon,
  FolderTreeIcon,
  GitCompareArrowsIcon,
  ShieldIcon,
  NetworkIcon,
  TerminalIcon,
  CheckIcon,
  BrainIcon,
  ScanSearchIcon,
  GlobeIcon,
  MessageSquareIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAgentConfig } from "@/lib/constants";
import { ToolCallRow } from "./ToolCallRow";
import { ReasoningBlock } from "./ReasoningBlock";
import { MarkdownBlock } from "./MarkdownBlock";
import { StatusRow } from "./StatusRow";
import { TextShimmer } from "./TextShimmer";
import type {
  ConversationMessage,
  ContentBlock,
  ToolCallBlock,
  SubAgentEventBlock,
  StatusBlock,
  AgentName,
  ToolIcon,
} from "@/lib/types";

export interface FindingActions {
  onProposePatch?: (findingId: string) => void;
  onMarkFalsePositive?: (findingId: string) => void;
  onSendToValidator?: (findingId: string) => void;
  onExplain?: (findingId: string) => void;
  onSendToCodingAgent?: (findingId: string, agentId?: string) => void;
}

interface ConversationMessageViewProps {
  message: ConversationMessage;
  findingActions?: FindingActions;
}

/** Agent icons — safe fallback */
const AGENT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  architecture: LandmarkIcon,
  security: ShieldAlertIcon,
  bugs: BugIcon,
  validator: ShieldCheckIcon,
  explainer: BookOpenIcon,
  system: SettingsIcon,
};

/** Render an inner block — finding_card blocks are EXCLUDED from chat (findings tab only) */
function renderInnerBlock(block: ContentBlock) {
  switch (block.kind) {
    case "sub_agent_event":
      return null;
    case "tool_call":
      return <ToolCallRow key={block.id} block={block} />;
    case "thinking":
      return <ReasoningBlock key={block.id} text={block.text} />;
    case "text":
      return <MarkdownBlock key={block.id} text={block.text} />;
    case "finding_card":
      return null;
    case "status":
      return <StatusRow key={block.id} block={block as StatusBlock} />;
    default:
      return null;
  }
}

/** Tool icon map for collapsed summary */
const TOOL_ICON_MAP: Record<ToolIcon, React.FC<{ className?: string }>> = {
  search: SearchIcon,
  file: FileIcon,
  tree: FolderTreeIcon,
  "git-diff": GitCompareArrowsIcon,
  shield: ShieldIcon,
  graph: NetworkIcon,
  terminal: TerminalIcon,
  check: CheckIcon,
  brain: BrainIcon,
  scan: ScanSearchIcon,
  bug: BugIcon,
  web: GlobeIcon,
};

/** Compute a summary of tool calls, messages, and unique tool icons for the collapsed header */
function useToolSummary(blocks: ContentBlock[]) {
  return useMemo(() => {
    const toolCallBlocks = blocks.filter(
      (b): b is ToolCallBlock => b.kind === "tool_call"
    );
    const toolCalls = toolCallBlocks.length;
    const findings = blocks.filter((b) => b.kind === "finding_card").length;
    const thinking = blocks.filter((b) => b.kind === "thinking").length;
    const messages = blocks.filter((b) => b.kind === "text").length;

    // Collect unique tool icons used
    const iconSet = new Set<ToolIcon>();
    for (const tc of toolCallBlocks) {
      if (tc.icon) iconSet.add(tc.icon);
    }
    const uniqueIcons = Array.from(iconSet);

    return { toolCalls, findings, thinking, messages, uniqueIcons };
  }, [blocks]);
}

export function ChatMessage({
  message,
}: ConversationMessageViewProps) {
  const isAgentMessage =
    message.role === "assistant" &&
    message.agent &&
    message.agent !== "system";
  const isComplete = message.status === "complete";
  const summary = useToolSummary(message.blocks);

  const shouldCollapse = isAgentMessage && isComplete && summary.toolCalls > 0;
  const [expanded, setExpanded] = useState(!isComplete);

  // Auto-collapse when agent finishes
  useEffect(() => {
    if (isComplete && shouldCollapse) {
      setExpanded(false);
    }
  }, [isComplete, shouldCollapse]);

  // ── User messages — right-aligned bubble ──
  if (message.role === "user") {
    const userText =
      message.blocks[0]?.kind === "text" ? message.blocks[0].text : "";
    const hasMarkdown = /[*_`#\-|]/.test(userText);

    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="px-3 py-1.5"
      >
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl bg-white/[0.06] px-4 py-3">
            {hasMarkdown ? (
              <div className="text-[13px] text-[var(--cr-text-primary)] leading-[1.65] [&_h1]:text-[14px] [&_h2]:text-[13.5px] [&_h3]:text-[13px] [&_p]:text-[13px] [&_li]:text-[13px] [&_code]:text-[12px]">
                <MarkdownBlock text={userText} />
              </div>
            ) : (
              <p className="text-[13px] text-[var(--cr-text-primary)] leading-[1.65]">
                {userText}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Find agent lifecycle blocks
  const startedBlock = message.blocks.find(
    (b): b is SubAgentEventBlock =>
      b.kind === "sub_agent_event" && b.event === "started"
  );
  const completedBlock = message.blocks.find(
    (b): b is SubAgentEventBlock =>
      b.kind === "sub_agent_event" &&
      (b.event === "completed" || b.event === "error")
  );

  // Inner blocks (filter out lifecycle events AND finding cards)
  const innerBlocks = message.blocks.filter(
    (b) =>
      b.kind !== "finding_card" &&
      !(
        b.kind === "sub_agent_event" &&
        (b.event === "started" || b.event === "completed" || b.event === "error")
      )
  );

  // ── Agent messages — flat layout with small agent label divider ──
  if (isAgentMessage && startedBlock) {
    const agentName = startedBlock.agent;
    const config = getAgentConfig(agentName);
    const AgentIcon = AGENT_ICONS[agentName] || BotIcon;
    const isActive = !completedBlock || completedBlock.event === "started";
    const isDone = completedBlock?.event === "completed";
    const isError = completedBlock?.event === "error";

    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="px-3 py-0.5"
      >
        {/* Agent label divider — small inline label, not a tile */}
        <button
          className={cn(
            "flex items-center gap-1.5 py-1 text-left rounded-md transition-colors duration-100",
            shouldCollapse && "cursor-pointer hover:opacity-80"
          )}
          onClick={() => shouldCollapse && setExpanded(!expanded)}
        >
          <AgentIcon
            className={cn(
              "size-3 shrink-0",
              isActive && config.color,
              isDone && "text-emerald-400/60",
              isError && "text-red-400/60"
            )}
          />
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              isActive && config.color,
              isDone && "text-emerald-400/50",
              isError && "text-red-400/50"
            )}
          >
            {config.shortLabel}
          </span>

          {/* Status indicator */}
          {isActive && (
            <LoaderCircleIcon className="size-2.5 text-[var(--cr-text-ghost)] animate-spin" />
          )}
          {isDone && (
            <CheckCircle2Icon className="size-2.5 text-emerald-400/40" />
          )}
          {isError && (
            <CircleXIcon className="size-2.5 text-red-400/40" />
          )}

          {/* Collapse chevron — only when collapsible */}
          {shouldCollapse && (
            <ChevronRightIcon
              className={cn(
                "size-2.5 text-[var(--cr-text-ghost)] transition-transform duration-150",
                expanded && "rotate-90"
              )}
            />
          )}
        </button>

        {/* Collapsed summary — tool/message count + unique tool icons */}
        {shouldCollapse && !expanded && (
          <div className="flex items-center gap-2 pl-[18px] pb-1">
            <span className="text-[10px] text-[var(--cr-text-ghost)]">
              {summary.toolCalls} tool call{summary.toolCalls !== 1 ? "s" : ""}
              {summary.messages > 0 && `, ${summary.messages} message${summary.messages !== 1 ? "s" : ""}`}
            </span>
            {summary.uniqueIcons.length > 0 && (
              <div className="flex items-center gap-1">
                {summary.uniqueIcons.map((icon) => {
                  const Ic = TOOL_ICON_MAP[icon];
                  return Ic ? (
                    <Ic
                      key={icon}
                      className="size-3 text-[var(--cr-text-ghost)]"
                    />
                  ) : null;
                })}
                {summary.messages > 0 && (
                  <MessageSquareIcon className="size-3 text-[var(--cr-text-ghost)]" />
                )}
              </div>
            )}
          </div>
        )}

        {/* Inner blocks — flow directly */}
        <AnimatePresence initial={false}>
          {(expanded || !shouldCollapse) && innerBlocks.length > 0 && (
            <motion.div
              initial={shouldCollapse ? { height: 0, opacity: 0 } : false}
              animate={{ height: "auto", opacity: 1 }}
              exit={shouldCollapse ? { height: 0, opacity: 0 } : undefined}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-1">
                {innerBlocks.map((block) => renderInnerBlock(block))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {message.status === "streaming" && (
          <div className="mt-1">
            <TextShimmer />
          </div>
        )}
      </motion.div>
    );
  }

  // ── Regular assistant messages — flat ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="px-3 py-1.5"
    >
      <div className="flex flex-col gap-2.5">
        {message.blocks.map((block) => renderInnerBlock(block))}
        {message.status === "streaming" && <TextShimmer />}
      </div>
    </motion.div>
  );
}

export { ChatMessage as ConversationMessageView };
