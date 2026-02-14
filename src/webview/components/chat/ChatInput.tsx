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
              className="cr-btn cr-btn-sm cr-btn-red"
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
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06]"
              >
                <span className="text-[var(--cr-text-secondary)]">{agent.icon}</span>
                <span className="text-[10px] font-medium text-[var(--cr-text-secondary)]">
                  {agent.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Input card */}
      <div className="rounded-xl bg-[var(--cr-bg-input)] overflow-hidden ring-1 ring-white/[0.04] focus-within:ring-white/[0.08] transition-all duration-150">
        {/* Mention Input */}
        <div className="relative">
          <MentionInput
            ref={mentionRef}
            disabled={disabled || isReviewing}
            placeholder={
              isReviewing
                ? "Review in progress..."
                : "Ask anything about your codebase..."
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
                  "flex items-center justify-center size-7 rounded-lg",
                  "bg-[var(--cr-text-tertiary)] text-[var(--cr-bg-root)]",
                  "hover:bg-[var(--cr-text-secondary)]",
                  "transition-all duration-100 active:scale-95",
                  "disabled:opacity-35"
                )}
              >
                <SendIcon className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 pb-2 pt-0">
          <div className="flex items-center gap-2">
            {onStartRepoReview && !isReviewing && (
              <button
                onClick={handleRepoReview}
                disabled={disabled}
                className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] transition-colors disabled:opacity-35"
              >
                <FolderSearchIcon className="size-3" />
                {hasMentions ? "Review Selected" : "Review Repo"}
              </button>
            )}
            {onStartDiffReview && !isReviewing && (
              <button
                onClick={handleDiffReview}
                disabled={disabled}
                className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] transition-colors disabled:opacity-35"
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
              ? "⏎ Send"
              : "@ agents"}
          </span>
        </div>
      </div>
    </div>
  );
}
