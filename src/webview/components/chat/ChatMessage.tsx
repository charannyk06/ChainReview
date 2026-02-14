import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubAgentTile } from "./SubAgentTile";
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
      // Findings only appear in the Findings tab — not rendered in chat
      return null;
    case "status":
      return <StatusRow key={block.id} block={block as StatusBlock} />;
    default:
      return null;
  }
}

/** Compute a summary of tool calls for the collapsed header */
function useToolSummary(blocks: ContentBlock[]) {
  return useMemo(() => {
    const toolCalls = blocks.filter(
      (b): b is ToolCallBlock => b.kind === "tool_call"
    ).length;
    const findings = blocks.filter((b) => b.kind === "finding_card").length;
    const thinking = blocks.filter((b) => b.kind === "thinking").length;
    return { toolCalls, findings, thinking };
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

  // ── Auto-collapse when agent finishes ──
  // When isComplete transitions from false → true, collapse the card
  useEffect(() => {
    if (isComplete && shouldCollapse) {
      setExpanded(false);
    }
  }, [isComplete, shouldCollapse]);

  // User messages — full-width dark card with generous spacing
  if (message.role === "user") {
    const userText =
      message.blocks[0]?.kind === "text" ? message.blocks[0].text : "";
    const hasMarkdown = /[*_`#\-|]/.test(userText);

    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="px-5 py-2"
      >
        <div className="rounded-xl bg-[var(--cr-bg-secondary)] border border-[var(--cr-border)] px-4 py-3.5">
          {hasMarkdown ? (
            <div className="text-[13px] text-[var(--cr-text-primary)] leading-[1.7] [&_h1]:text-[14px] [&_h2]:text-[13.5px] [&_h3]:text-[13px] [&_p]:text-[13px] [&_li]:text-[13px] [&_code]:text-[12px]">
              <MarkdownBlock text={userText} />
            </div>
          ) : (
            <p className="text-[13px] text-[var(--cr-text-primary)] leading-[1.7]">
              {userText}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  // Find agent lifecycle blocks for the header
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

  // Collapsible Agent Section
  if (isAgentMessage && startedBlock) {
    const headerEvent = completedBlock
      ? completedBlock.event
      : startedBlock.event;
    const headerMessage = completedBlock
      ? completedBlock.message
      : startedBlock.message;

    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="px-5 py-1.5"
      >
        <button
          className="w-full text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <SubAgentTile
                agent={startedBlock.agent}
                event={headerEvent}
                message={headerMessage}
                toolCount={summary.toolCalls}
                findingCount={summary.findings}
              />
            </div>
            {shouldCollapse && (
              <ChevronDownIcon
                className={cn(
                  "size-3.5 text-[var(--cr-text-muted)] transition-transform duration-150 shrink-0",
                  !expanded && "-rotate-90"
                )}
              />
            )}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {(expanded || !shouldCollapse) && innerBlocks.length > 0 && (
            <motion.div
              initial={shouldCollapse ? { height: 0, opacity: 0 } : false}
              animate={{ height: "auto", opacity: 1 }}
              exit={shouldCollapse ? { height: 0, opacity: 0 } : undefined}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2.5 mt-3 ml-3 pl-4 border-l border-[var(--cr-border-subtle)]">
                {innerBlocks.map((block) => renderInnerBlock(block))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {message.status === "streaming" && (
          <div className="ml-3 pl-4 border-l border-[var(--cr-border-subtle)] mt-2">
            <TextShimmer />
          </div>
        )}
      </motion.div>
    );
  }

  // Regular assistant messages — no collapsing
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="px-5 py-1.5"
    >
      <div className="flex flex-col gap-2.5">
        {message.blocks.map((block) => renderInnerBlock(block))}
        {message.status === "streaming" && <TextShimmer />}
      </div>
    </motion.div>
  );
}

export { ChatMessage as ConversationMessageView };
