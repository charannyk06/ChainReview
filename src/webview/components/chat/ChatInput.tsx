import { useRef, useCallback, useEffect, useState } from "react";
import {
  ArrowUpIcon,
  FolderSearchIcon,
  GitCompareArrowsIcon,
  LoaderCircleIcon,
  SquareIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MentionInput, MentionInputHandle } from "./MentionInput";

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

  return (
    <div style={{ padding: "0 12px 12px 12px" }} className={cn("flex-shrink-0", className)}>
      {/* ── Review Status Bar (above input, separate from the card) ── */}
      {isReviewing && (
        <div
          style={{ padding: "8px 12px", marginBottom: 8 }}
          className="flex items-center justify-between rounded-xl bg-[var(--cr-accent-subtle)] border border-[var(--cr-border-subtle)]"
        >
          <div className="flex items-center gap-2">
            <LoaderCircleIcon className="size-3.5 text-[var(--cr-accent)] animate-spin" />
            <span className="text-[11px] text-[var(--cr-accent-hover)] font-medium">
              Agents are reviewing...
            </span>
          </div>
          {onCancelReview && (
            <button
              onClick={onCancelReview}
              style={{ padding: "3px 10px" }}
              className="flex items-center gap-1.5 text-[10px] font-semibold rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors"
            >
              <SquareIcon className="size-2.5 fill-current" />
              Stop
            </button>
          )}
        </div>
      )}

      {/* ── Input Card — Claude Code style ── */}
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "#1a1a1a",
          overflow: "hidden",
          transition: "border-color 150ms ease",
        }}
        className="focus-within:!border-[rgba(255,255,255,0.14)]"
      >
        {/* Text area */}
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

        {/* ── Divider line ── */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0" }} />

        {/* ── Toolbar row ── */}
        <div
          style={{ padding: "6px 10px" }}
          className="flex items-center justify-between"
        >
          {/* Left: action buttons */}
          <div className="flex items-center gap-0.5">
            {onStartRepoReview && !isReviewing && (
              <button
                onClick={handleRepoReview}
                disabled={disabled}
                title="Full repo review"
                style={{ padding: "5px 8px", borderRadius: 8 }}
                className="flex items-center gap-1.5 text-[10.5px] font-medium text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] hover:bg-white/[0.04] transition-colors disabled:opacity-35"
              >
                <FolderSearchIcon style={{ width: 14, height: 14 }} />
                Repo
              </button>
            )}
            {onStartDiffReview && !isReviewing && (
              <button
                onClick={handleDiffReview}
                disabled={disabled}
                title="Review git diff"
                style={{ padding: "5px 8px", borderRadius: 8 }}
                className="flex items-center gap-1.5 text-[10.5px] font-medium text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] hover:bg-white/[0.04] transition-colors disabled:opacity-35"
              >
                <GitCompareArrowsIcon style={{ width: 14, height: 14 }} />
                Diff
              </button>
            )}
          </div>

          {/* Right: hints + send */}
          <div className="flex items-center gap-2">
            {!isReviewing && !hasContent && (
              <span className="text-[10px] text-[var(--cr-text-ghost)] select-none">
                @ agents
              </span>
            )}
            {/* Slash hint */}
            {!isReviewing && !hasContent && (
              <span className="text-[10px] text-[var(--cr-text-ghost)] select-none">/</span>
            )}
            {/* Send button */}
            <button
              onClick={isReviewing && onCancelReview ? onCancelReview : handleSubmit}
              disabled={!isReviewing && (disabled || !hasContent)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 100ms ease",
                border: "none",
                cursor: (!isReviewing && !hasContent) ? "default" : "pointer",
                background: isReviewing
                  ? "rgba(239, 68, 68, 0.15)"
                  : hasContent
                    ? "#e5e5e5"
                    : "rgba(255,255,255,0.06)",
                color: isReviewing
                  ? "#f87171"
                  : hasContent
                    ? "#0f0f0f"
                    : "rgba(255,255,255,0.15)",
              }}
            >
              {isReviewing ? (
                <SquareIcon style={{ width: 12, height: 12 }} className="fill-current" />
              ) : (
                <ArrowUpIcon style={{ width: 16, height: 16 }} strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
