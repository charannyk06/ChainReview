import { useRef, useCallback, useEffect, useState } from "react";
import {
  SendIcon,
  FolderSearchIcon,
  GitCompareArrowsIcon,
  LoaderCircleIcon,
  SquareIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MentionInput, MentionInputHandle, AVAILABLE_AGENTS } from "./MentionInput";

interface ChatInputProps {
  onSend: (query: string, agents?: string[], targetPath?: string) => void;
  onStartRepoReview?: (agents?: string[]) => void;
  onStartDiffReview?: (agents?: string[]) => void;
  onCancelReview?: () => void;
  disabled?: boolean;
  isReviewing?: boolean;
  className?: string;
}

export function ChatInput({
  onSend,
  onStartRepoReview,
  onStartDiffReview,
  onCancelReview,
  disabled = false,
  isReviewing = false,
  className,
}: ChatInputProps) {
  const mentionRef = useRef<MentionInputHandle>(null);
  const [currentText, setCurrentText] = useState("");
  const [currentMentions, setCurrentMentions] = useState<string[]>([]);

  useEffect(() => {
    if (!disabled && !isReviewing) {
      mentionRef.current?.focus();
    }
  }, [disabled, isReviewing]);

  const handleSubmit = useCallback(() => {
    const text = mentionRef.current?.getText() || "";
    const mentions = mentionRef.current?.getMentions() || [];
    const trimmed = text.trim();
    
    if (!trimmed || disabled || isReviewing) return;

    // Parse target path from text (e.g., "@Security check src/auth/")
    const pathMatch = trimmed.match(/(?:check|analyze|review)\s+([^\s@]+)/i);
    const targetPath = pathMatch?.[1];

    // Expand @all to all review agents
    let agents = mentions;
    if (mentions.includes("all")) {
      agents = ["security", "architecture", "bugs"];
    }

    onSend(trimmed, agents.length > 0 ? agents : undefined, targetPath);
    mentionRef.current?.clear();
    setCurrentText("");
    setCurrentMentions([]);
  }, [disabled, isReviewing, onSend]);

  const handleChange = useCallback((text: string, mentions: string[]) => {
    setCurrentText(text);
    setCurrentMentions(mentions);
  }, []);

  const handleRepoReview = useCallback(() => {
    // If there are mentions, use those agents; otherwise run all
    let agents = currentMentions;
    if (agents.includes("all")) {
      agents = ["security", "architecture", "bugs"];
    }
    onStartRepoReview?.(agents.length > 0 ? agents : undefined);
  }, [currentMentions, onStartRepoReview]);

  const handleDiffReview = useCallback(() => {
    let agents = currentMentions;
    if (agents.includes("all")) {
      agents = ["security", "architecture", "bugs"];
    }
    onStartDiffReview?.(agents.length > 0 ? agents : undefined);
  }, [currentMentions, onStartDiffReview]);

  const hasContent = currentText.trim().length > 0;
  const hasMentions = currentMentions.length > 0;

  return (
    <div className={cn("flex-shrink-0 px-3 pb-3 pt-2", className)}>
      {/* Review progress indicator */}
      {isReviewing && (
        <div className="flex items-center justify-between px-3.5 py-2 mb-3 rounded-xl bg-[var(--cr-accent-subtle)] border border-[var(--cr-border-subtle)]">
          <div className="flex items-center gap-2.5">
            <LoaderCircleIcon className="size-3.5 text-[var(--cr-accent)] animate-spin" />
            <span className="text-[11px] text-[var(--cr-accent-hover)] font-medium">
              Agents are reviewing...
            </span>
          </div>
          {onCancelReview && (
            <button
              onClick={onCancelReview}
              className="cr-btn cr-btn-red"
              style={{ padding: "5px 12px", fontSize: "10px" }}
            >
              <SquareIcon className="size-2.5 fill-current" />
              Stop
            </button>
          )}
        </div>
      )}

      {/* Agent badges when mentioned */}
      {hasMentions && !isReviewing && (
        <div className="flex items-center gap-1.5 px-1 pb-2">
          <span className="text-[10px] text-[var(--cr-text-muted)]">Agents:</span>
          {currentMentions.map((agentId) => {
            const agent = AVAILABLE_AGENTS.find((a) => a.id === agentId);
            if (!agent) return null;
            return (
              <div
                key={agentId}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--cr-accent-subtle)] border border-[var(--cr-accent)]/20"
              >
                <span className="text-[var(--cr-accent)]">{agent.icon}</span>
                <span className="text-[10px] font-medium text-[var(--cr-accent)]">
                  {agent.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Input card */}
      <div className="rounded-2xl border border-[var(--cr-border-strong)] bg-[var(--cr-bg-secondary)] overflow-hidden shadow-sm">
        {/* Mention Input */}
        <div className="relative">
          <MentionInput
            ref={mentionRef}
            disabled={disabled || isReviewing}
            placeholder={
              isReviewing
                ? "Review in progress..."
                : "Type @ to mention an agent (e.g., @Security check src/auth/)"
            }
            onSubmit={handleSubmit}
            onChange={handleChange}
          />

          {/* Send button */}
          <div className="absolute right-3 bottom-3.5">
            {hasContent && !isReviewing ? (
              <button
                onClick={handleSubmit}
                disabled={disabled}
                className={cn(
                  "flex items-center justify-center size-8 rounded-lg",
                  "bg-[var(--cr-accent)] text-white hover:bg-[var(--cr-accent-hover)]",
                  "transition-all duration-100 active:scale-95",
                  "disabled:opacity-35 shadow-sm"
                )}
              >
                <SendIcon className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-0">
          <div className="flex items-center gap-1">
            {onStartRepoReview && !isReviewing && (
              <button
                onClick={handleRepoReview}
                disabled={disabled}
                className="cr-btn cr-btn-ghost"
                style={{ padding: "5px 12px", fontSize: "10px" }}
              >
                <FolderSearchIcon className="size-3" />
                {hasMentions ? "Review with Selected" : "Review Repo"}
              </button>
            )}
            {onStartDiffReview && !isReviewing && (
              <button
                onClick={handleDiffReview}
                disabled={disabled}
                className="cr-btn cr-btn-ghost"
                style={{ padding: "5px 12px", fontSize: "10px" }}
              >
                <GitCompareArrowsIcon className="size-3" />
                Review Diff
              </button>
            )}
          </div>

          <span className="text-[10px] text-[var(--cr-text-ghost)] select-none pr-1">
            {isReviewing
              ? "Click Stop to cancel"
              : hasContent
              ? "Send (⌘ + ↵)"
              : "Type @ for agents"}
          </span>
        </div>
      </div>
    </div>
  );
}
