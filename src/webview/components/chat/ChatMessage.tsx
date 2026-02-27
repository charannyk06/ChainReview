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
import { getAgentConfig, getAgentInlineColors } from "@/lib/constants";
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
const AGENT_ICONS: Record<string, React.FC<{ style?: React.CSSProperties }>> = {
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
const TOOL_ICON_MAP: Record<ToolIcon, React.FC<{ style?: React.CSSProperties }>> = {
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
    const textBlocks = blocks.filter((b) => b.kind === "text");
    const messages = textBlocks.length;

    // Collect unique tool icons used
    const iconSet = new Set<ToolIcon>();
    for (const tc of toolCallBlocks) {
      if (tc.icon) iconSet.add(tc.icon);
    }
    const uniqueIcons = Array.from(iconSet);

    // Get the last text block as a preview for collapsed state
    const lastText = textBlocks.length > 0
      ? (textBlocks[textBlocks.length - 1] as { kind: "text"; text: string }).text
      : null;
    const textPreview = lastText
      ? lastText.length > 120 ? lastText.slice(0, 120) + "…" : lastText
      : null;

    return { toolCalls, findings, thinking, messages, uniqueIcons, textPreview };
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

  const shouldCollapse = isComplete && summary.toolCalls > 0;
  const [expanded, setExpanded] = useState(!isComplete);
  const [headerHovered, setHeaderHovered] = useState(false);

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
        style={{ padding: "8px 0" }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{
            padding: "14px 16px",
            maxWidth: "85%",
            borderRadius: 16,
            background: "rgba(255,255,255,0.06)",
          }}>
            {hasMarkdown ? (
              <div style={{
                fontSize: 13,
                color: "var(--cr-text-primary)",
                lineHeight: 1.65,
              }}>
                <MarkdownBlock text={userText} />
              </div>
            ) : (
              <p style={{
                fontSize: 13,
                color: "var(--cr-text-primary)",
                lineHeight: 1.65,
                margin: 0,
              }}>
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
    const colors = getAgentInlineColors(agentName);
    const AgentIcon = AGENT_ICONS[agentName] || BotIcon;
    const isActive = !completedBlock || completedBlock.event === "started";
    const isDone = completedBlock?.event === "completed";
    const isError = completedBlock?.event === "error";

    const agentColor = isActive ? colors.color
      : isDone ? "rgba(52,211,153,0.60)"
      : isError ? "rgba(248,113,113,0.60)"
      : "var(--cr-text-ghost)";

    const labelColor = isActive ? colors.color
      : isDone ? "rgba(52,211,153,0.50)"
      : isError ? "rgba(248,113,113,0.50)"
      : "var(--cr-text-ghost)";

    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        style={{ padding: "2px 0" }}
      >
        {/* Agent label divider — small inline label, not a tile */}
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: 4,
            textAlign: "left",
            borderRadius: 6,
            transition: "opacity 100ms ease",
            cursor: shouldCollapse ? "pointer" : "default",
            opacity: headerHovered && shouldCollapse ? 0.80 : 1,
            background: "transparent",
            border: "none",
          }}
          onClick={() => shouldCollapse && setExpanded(!expanded)}
          onMouseEnter={() => setHeaderHovered(true)}
          onMouseLeave={() => setHeaderHovered(false)}
        >
          <AgentIcon style={{ width: 12, height: 12, flexShrink: 0, color: agentColor }} />
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: labelColor,
          }}>
            {config.shortLabel}
          </span>

          {/* Status indicator */}
          {isActive && (
            <LoaderCircleIcon style={{
              width: 10,
              height: 10,
              color: "var(--cr-text-ghost)",
              animation: "spin 1s linear infinite",
            }} />
          )}
          {isDone && (
            <CheckCircle2Icon style={{ width: 10, height: 10, color: "rgba(52,211,153,0.40)" }} />
          )}
          {isError && (
            <CircleXIcon style={{ width: 10, height: 10, color: "rgba(248,113,113,0.40)" }} />
          )}

          {/* Collapse chevron — only when collapsible */}
          {shouldCollapse && (
            <ChevronRightIcon style={{
              width: 10,
              height: 10,
              color: "var(--cr-text-ghost)",
              transition: "transform 150ms ease",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            }} />
          )}
        </button>

        {/* Collapsed summary — tool/message count + unique tool icons + text preview */}
        {shouldCollapse && !expanded && (
          <div style={{ paddingLeft: 18, paddingBottom: 6 }}>
            {/* Tool count + icons row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {summary.uniqueIcons.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  {summary.uniqueIcons.map((icon) => {
                    const Ic = TOOL_ICON_MAP[icon];
                    return Ic ? (
                      <Ic key={icon} style={{ width: 11, height: 11, color: "var(--cr-text-muted)" }} />
                    ) : null;
                  })}
                  {summary.messages > 0 && (
                    <MessageSquareIcon style={{ width: 11, height: 11, color: "var(--cr-text-muted)" }} />
                  )}
                </div>
              )}
              <span style={{ fontSize: 10, color: "var(--cr-text-ghost)" }}>
                {summary.toolCalls} tool call{summary.toolCalls !== 1 ? "s" : ""}
                {summary.messages > 0 && ` · ${summary.messages} message${summary.messages !== 1 ? "s" : ""}`}
                {summary.findings > 0 && ` · ${summary.findings} finding${summary.findings !== 1 ? "s" : ""}`}
              </span>
            </div>
            {/* Text preview — show agent's final output */}
            {summary.textPreview && (
              <p style={{
                fontSize: 11.5,
                color: "var(--cr-text-secondary)",
                lineHeight: 1.55,
                marginTop: 6,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }}>
                {summary.textPreview}
              </p>
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
              style={{ overflow: "hidden" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {innerBlocks.map((block) => renderInnerBlock(block))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {message.status === "streaming" && (
          <div style={{ marginTop: 4 }}>
            <TextShimmer />
          </div>
        )}
      </motion.div>
    );
  }

  // ── Regular assistant messages — render blocks in emission order ──
  // Filter out finding cards and lifecycle events (same as agent path)
  const orderedBlocks = message.blocks.filter(
    (b) =>
      b.kind !== "finding_card" &&
      !(
        b.kind === "sub_agent_event" &&
        (b.event === "started" || b.event === "completed" || b.event === "error")
      )
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ padding: "6px 0" }}
    >
      {/* Collapsed summary header when complete */}
      {shouldCollapse && !expanded && (
        <div style={{ marginBottom: 6 }}>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: 4,
              textAlign: "left",
              borderRadius: 6,
              transition: "opacity 100ms ease",
              cursor: "pointer",
              opacity: headerHovered ? 0.80 : 1,
              background: "transparent",
              border: "none",
            }}
            onClick={() => setExpanded(true)}
            onMouseEnter={() => setHeaderHovered(true)}
            onMouseLeave={() => setHeaderHovered(false)}
          >
            {summary.uniqueIcons.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {summary.uniqueIcons.map((icon) => {
                  const Ic = TOOL_ICON_MAP[icon];
                  return Ic ? (
                    <Ic key={icon} style={{ width: 11, height: 11, color: "var(--cr-text-muted)" }} />
                  ) : null;
                })}
              </div>
            )}
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              color: "var(--cr-text-muted)",
            }}>
              Used {summary.toolCalls} tool{summary.toolCalls !== 1 ? "s" : ""}
              {summary.messages > 0 && ` · ${summary.messages} message${summary.messages !== 1 ? "s" : ""}`}
            </span>
            <ChevronRightIcon style={{
              width: 10,
              height: 10,
              color: "var(--cr-text-ghost)",
              transition: "transform 150ms ease",
              transform: "rotate(0deg)",
            }} />
          </button>
          {/* Text preview when collapsed */}
          {summary.textPreview && (
            <p style={{
              fontSize: 11.5,
              color: "var(--cr-text-secondary)",
              lineHeight: 1.55,
              marginTop: 2,
              paddingLeft: 4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            }}>
              {summary.textPreview}
            </p>
          )}
        </div>
      )}

      {/* Expanded: collapse toggle header */}
      {shouldCollapse && expanded && (
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: 4,
            marginBottom: 4,
            textAlign: "left",
            borderRadius: 6,
            transition: "opacity 100ms ease",
            cursor: "pointer",
            opacity: headerHovered ? 0.80 : 1,
            background: "transparent",
            border: "none",
          }}
          onClick={() => setExpanded(false)}
          onMouseEnter={() => setHeaderHovered(true)}
          onMouseLeave={() => setHeaderHovered(false)}
        >
          <span style={{
            fontSize: 10,
            fontWeight: 500,
            color: "var(--cr-text-muted)",
          }}>
            Hide {summary.toolCalls} tool{summary.toolCalls !== 1 ? "s" : ""}
          </span>
          <ChevronRightIcon style={{
            width: 10,
            height: 10,
            color: "var(--cr-text-ghost)",
            transition: "transform 150ms ease",
            transform: "rotate(90deg)",
          }} />
        </button>
      )}

      {/* Blocks in emission order — shown when expanded or streaming */}
      <AnimatePresence initial={false}>
        {(expanded || !shouldCollapse) && orderedBlocks.length > 0 && (
          <motion.div
            initial={shouldCollapse ? { height: 0, opacity: 0 } : false}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldCollapse ? { height: 0, opacity: 0 } : undefined}
            transition={{ duration: 0.15 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {orderedBlocks.map((block) => renderInnerBlock(block))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {message.status === "streaming" && <TextShimmer />}
    </motion.div>
  );
}

export { ChatMessage as ConversationMessageView };
