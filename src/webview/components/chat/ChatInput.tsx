import { useRef, useCallback, useEffect, useState } from "react";
import {
  ArrowUpIcon,
  FolderSearchIcon,
  GitCompareArrowsIcon,
  LoaderCircleIcon,
  SquareIcon,
  AtSignIcon,
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
  hasMessages?: boolean;
  className?: string;
}

const VALID_REVIEW_AGENTS = new Set(["security", "architecture", "bugs"]);

function resolveAgents(mentions: string[]): string[] {
  if (mentions.includes("all")) return ["security", "architecture", "bugs"];
  return mentions.filter((m) => VALID_REVIEW_AGENTS.has(m));
}

export function ChatInput({
  onSend,
  onStartRepoReview,
  onStartDiffReview,
  onCancelReview,
  disabled = false,
  isReviewing = false,
  hasMessages = false,
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

    const pathMatch = trimmed.match(/(?:check|analyze|review)\s+([^\s@]+)/i);
    const targetPath = pathMatch?.[1];
    const agents = resolveAgents(mentions);

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
    const agents = resolveAgents(currentMentions);
    onStartRepoReview?.(agents.length > 0 ? agents : undefined);
  }, [currentMentions, onStartRepoReview]);

  const handleDiffReview = useCallback(() => {
    const agents = resolveAgents(currentMentions);
    onStartDiffReview?.(agents.length > 0 ? agents : undefined);
  }, [currentMentions, onStartDiffReview]);

  const hasContent = currentText.trim().length > 0;
  const hasMentions = currentMentions.length > 0;

  return (
    <div className={cn("flex-shrink-0 px-5 py-3", className)}>
      {/* Review progress bar */}
      {isReviewing && (
        <div className="flex items-center justify-between px-3 py-2 mb-2.5 rounded-lg bg-[var(--cr-accent-subtle)] border border-[var(--cr-border-subtle)]">
          <div className="flex items-center gap-2">
            <LoaderCircleIcon className="size-3.5 text-[var(--cr-accent)] animate-spin" />
            <span className="text-[11px] text-[var(--cr-accent-hover)] font-medium">
              Agents are reviewing...
            </span>
          </div>
          {onCancelReview && (
            <button onClick={onCancelReview} className="cr-btn cr-btn-xs cr-btn-red">
              <SquareIcon className="size-2 fill-current" />
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
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06]"
              >
                <span className="text-[var(--cr-text-secondary)] [&>svg]:size-3">{agent.icon}</span>
                <span className="text-[10px] font-medium text-[var(--cr-text-secondary)]">
                  {agent.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Input card ── */}
      <div className={cn(
        "rounded-2xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)]",
        "focus-within:border-[var(--cr-border-strong)]",
        "transition-colors duration-150",
      )}>
        {/* Text area */}
        <div className="relative">
          <MentionInput
            ref={mentionRef}
            disabled={disabled || isReviewing}
            placeholder={
              isReviewing
                ? "Review in progress..."
                : hasMessages
                  ? "Add a follow up..."
                  : "Ask about your codebase..."
            }
            onSubmit={handleSubmit}
            onChange={handleChange}
          />
        </div>

        {/* ── Toolbar row ── */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
          {/* Left: action buttons */}
          <div className="flex items-center gap-1">
            {onStartRepoReview && !isReviewing && (
              <button
                onClick={handleRepoReview}
                disabled={disabled}
                title="Full repo review"
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-lg",
                  "text-[10px] font-medium text-[var(--cr-text-muted)]",
                  "hover:text-[var(--cr-text-secondary)] hover:bg-white/[0.04]",
                  "transition-colors disabled:opacity-35"
                )}
              >
                <FolderSearchIcon className="size-3.5" />
                {hasMentions ? "Review" : "Repo"}
              </button>
            )}
            {onStartDiffReview && !isReviewing && (
              <button
                onClick={handleDiffReview}
                disabled={disabled}
                title="Review git diff"
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-lg",
                  "text-[10px] font-medium text-[var(--cr-text-muted)]",
                  "hover:text-[var(--cr-text-secondary)] hover:bg-white/[0.04]",
                  "transition-colors disabled:opacity-35"
                )}
              >
                <GitCompareArrowsIcon className="size-3.5" />
                Diff
              </button>
            )}
          </div>

          {/* Right: stop/send button */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--cr-text-ghost)] select-none">
              {isReviewing ? "" : hasContent ? "" : "@ agents"}
            </span>
            {isReviewing && onCancelReview ? (
              <button
                onClick={onCancelReview}
                className={cn(
                  "flex items-center justify-center size-7 rounded-lg",
                  "bg-red-500/15 text-red-400 hover:bg-red-500/25",
                  "transition-all duration-100 active:scale-90",
                )}
                title="Stop review"
              >
                <SquareIcon className="size-3 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={disabled || isReviewing || !hasContent}
                className={cn(
                  "flex items-center justify-center size-7 rounded-lg",
                  "transition-all duration-100 active:scale-90",
                  hasContent && !isReviewing
                    ? "bg-[var(--cr-text-primary)] text-[var(--cr-bg-root)] hover:opacity-90"
                    : "bg-white/[0.06] text-[var(--cr-text-ghost)] cursor-default",
                )}
              >
                <ArrowUpIcon className="size-4" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
