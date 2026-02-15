import { useRef, useCallback, useEffect, useState } from "react";
import {
  ArrowUpIcon,
  FolderSearchIcon,
  GitCompareArrowsIcon,
  LoaderCircleIcon,
  SquareIcon,
} from "lucide-react";
import { MentionInput, MentionInputHandle } from "./MentionInput";

interface ChatInputProps {
  onSend: (query: string, agents?: string[], targetPath?: string) => void;
  onStartRepoReview?: (agents?: string[]) => void;
  onStartDiffReview?: (agents?: string[]) => void;
  onCancelReview?: () => void;
  disabled?: boolean;
  isReviewing?: boolean;
  hasMessages?: boolean;
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
    <div style={{ padding: "0 12px 12px 12px", flexShrink: 0 }}>
      {/* ── Review Status Bar ── */}
      {isReviewing && (
        <div
          style={{
            padding: "8px 12px",
            marginBottom: 8,
            borderRadius: 12,
            background: "rgba(99,102,241,0.06)",
            border: "1px solid rgba(99,102,241,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LoaderCircleIcon
              style={{
                width: 14,
                height: 14,
                color: "#818cf8",
                animation: "spin 1s linear infinite",
              }}
            />
            <span style={{ fontSize: 11, color: "#a5b4fc", fontWeight: 600 }}>
              Agents are reviewing...
            </span>
          </div>
          {onCancelReview && (
            <button
              onClick={onCancelReview}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 8,
                border: "1px solid rgba(239,68,68,0.25)",
                background: "rgba(239,68,68,0.10)",
                color: "#f87171",
                cursor: "pointer",
                transition: "all 150ms ease",
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.20)";
                e.currentTarget.style.borderColor = "rgba(239,68,68,0.40)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.10)";
                e.currentTarget.style.borderColor = "rgba(239,68,68,0.25)";
              }}
            >
              <SquareIcon style={{ width: 8, height: 8, fill: "currentColor" }} />
              Stop
            </button>
          )}
        </div>
      )}

      {/* ── Input Card ── */}
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "#1a1a1a",
          overflow: "hidden",
          transition: "border-color 150ms ease",
        }}
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

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

        {/* ── Toolbar row ── */}
        <div
          style={{ padding: "6px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          {/* Left: action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {onStartRepoReview && !isReviewing && (
              <button
                onClick={handleRepoReview}
                disabled={disabled}
                title="Full repo review"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 8px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: "#525252",
                  fontSize: 10.5,
                  fontWeight: 500,
                  cursor: disabled ? "default" : "pointer",
                  transition: "all 150ms ease",
                  opacity: disabled ? 0.35 : 1,
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  if (!disabled) {
                    e.currentTarget.style.color = "#a3a3a3";
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#525252";
                  e.currentTarget.style.background = "transparent";
                }}
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 8px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: "#525252",
                  fontSize: 10.5,
                  fontWeight: 500,
                  cursor: disabled ? "default" : "pointer",
                  transition: "all 150ms ease",
                  opacity: disabled ? 0.35 : 1,
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  if (!disabled) {
                    e.currentTarget.style.color = "#a3a3a3";
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#525252";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <GitCompareArrowsIcon style={{ width: 14, height: 14 }} />
                Diff
              </button>
            )}
          </div>

          {/* Right: hints + send/stop */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isReviewing && !hasContent && (
              <span style={{ fontSize: 10, color: "#404040", userSelect: "none" }}>
                @ agents
              </span>
            )}
            {/* Send / Stop button */}
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
                <SquareIcon style={{ width: 12, height: 12, fill: "currentColor" }} />
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
