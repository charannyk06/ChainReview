import { useState, useRef, useCallback, useEffect } from "react";
import {
  SendIcon,
  FolderSearchIcon,
  GitCompareArrowsIcon,
  LoaderCircleIcon,
  SquareIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (query: string) => void;
  onStartRepoReview?: () => void;
  onStartDiffReview?: () => void;
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
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, []);

  useEffect(() => { adjustHeight(); }, [value, adjustHeight]);

  useEffect(() => {
    if (!disabled && !isReviewing) textareaRef.current?.focus();
  }, [disabled, isReviewing]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isReviewing) return;
    onSend(trimmed);
    setValue("");
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    });
  }, [value, disabled, isReviewing, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasContent = value.trim().length > 0;

  return (
    <div className={cn("flex-shrink-0 px-3 pb-3 pt-2", className)}>
      {/* Review progress indicator — above the input card */}
      {isReviewing && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 rounded-lg bg-[var(--cr-accent-subtle)] border border-[var(--cr-border-subtle)]">
          <div className="flex items-center gap-2">
            <LoaderCircleIcon className="size-3 text-[var(--cr-accent)] animate-spin" />
            <span className="text-[11px] text-[var(--cr-accent-hover)] font-medium">
              Agents are reviewing...
            </span>
          </div>
          {onCancelReview && (
            <button
              onClick={onCancelReview}
              className="cr-btn cr-btn-red"
              style={{ padding: "4px 10px", fontSize: "10px" }}
            >
              <SquareIcon className="size-2.5 fill-current" />
              Stop
            </button>
          )}
        </div>
      )}

      {/* Input card — rounded with border and spacing on all sides */}
      <div className="rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] overflow-hidden">
        {/* Input area */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isReviewing}
            placeholder={
              isReviewing
                ? "Review in progress..."
                : "Describe your task (@mention for context)"
            }
            rows={1}
            className={cn(
              "w-full resize-none bg-transparent px-4 py-3 pr-11",
              "text-[13px] leading-relaxed text-[var(--cr-text-primary)]",
              "placeholder:text-[var(--cr-text-muted)]",
              "focus:outline-none",
              "disabled:opacity-35 disabled:cursor-not-allowed",
              "min-h-[42px] max-h-[150px]",
            )}
          />

          {/* Send button */}
          <div className="absolute right-2.5 bottom-2.5">
            {hasContent && !isReviewing ? (
              <button
                onClick={handleSubmit}
                disabled={disabled}
                className={cn(
                  "flex items-center justify-center size-7 rounded-md",
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

        {/* Bottom bar — inside the card */}
        <div className="flex items-center justify-between px-3 pb-2 pt-0">
          <div className="flex items-center gap-0.5">
            {onStartRepoReview && !isReviewing && (
              <button
                onClick={onStartRepoReview}
                disabled={disabled}
                className="cr-btn cr-btn-ghost"
                style={{ padding: "4px 10px", fontSize: "10px" }}
              >
                <FolderSearchIcon className="size-3" />
                Review Repo
              </button>
            )}
            {onStartDiffReview && !isReviewing && (
              <button
                onClick={onStartDiffReview}
                disabled={disabled}
                className="cr-btn cr-btn-ghost"
                style={{ padding: "4px 10px", fontSize: "10px" }}
              >
                <GitCompareArrowsIcon className="size-3" />
                Review Diff
              </button>
            )}
          </div>

          <span className="text-[10px] text-[var(--cr-text-ghost)] select-none">
            {isReviewing ? "Click Stop to cancel" : hasContent ? "Send (\u2318 + \u21B5)" : "Shift+\u21B5 newline"}
          </span>
        </div>
      </div>
    </div>
  );
}
