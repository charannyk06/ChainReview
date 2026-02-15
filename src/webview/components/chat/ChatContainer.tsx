import { useEffect, useRef, useCallback } from "react";
import { ChatMessage, type FindingActions } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import type { ConversationMessage } from "@/lib/types";

interface ChatContainerProps {
  messages: ConversationMessage[];
  onSendQuery?: (query: string, agents?: string[], targetPath?: string) => void;
  onStartRepoReview?: (agents?: string[]) => void;
  onStartDiffReview?: (agents?: string[]) => void;
  onCancelReview?: () => void;
  isReviewing?: boolean;
  findingActions?: FindingActions;
  className?: string;
}

export function ChatContainer({
  messages,
  onSendQuery,
  onStartRepoReview,
  onStartDiffReview,
  onCancelReview,
  isReviewing = false,
  findingActions,
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);
  const lastScrollTop = useRef(0);

  const lastMsg = messages[messages.length - 1];
  const blockCount = lastMsg?.blocks?.length ?? 0;

  // Detect if user has scrolled away from the bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const distFromBottom = scrollHeight - scrollTop - clientHeight;

    // User scrolled UP if they moved upward and are more than 80px from bottom
    if (scrollTop < lastScrollTop.current && distFromBottom > 80) {
      isUserScrolledUp.current = true;
    }

    // User scrolled back to bottom — re-enable auto-scroll
    if (distFromBottom < 40) {
      isUserScrolledUp.current = false;
    }

    lastScrollTop.current = scrollTop;
  }, []);

  // Auto-scroll only when user hasn't scrolled up
  useEffect(() => {
    if (!isUserScrolledUp.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, blockCount]);

  // Empty state — clean, minimal
  if (messages.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isReviewing ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--cr-accent)",
                      animation: `pulse-dot 1.2s ease-in-out ${i * 200}ms infinite`,
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 11, color: "var(--cr-text-tertiary)", fontWeight: 500 }}>
                Starting review...
              </span>
            </div>
          ) : (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "0 32px",
              textAlign: "center",
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: "var(--cr-bg-tertiary)",
                border: "1px solid var(--cr-border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <svg style={{ width: 18, height: 18, color: "var(--cr-text-tertiary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 12, color: "var(--cr-text-secondary)", fontWeight: 500, marginBottom: 2 }}>
                  ChainReview
                </p>
                <p style={{ fontSize: 11, color: "var(--cr-text-muted)", lineHeight: 1.6 }}>
                  Start a review or ask about your codebase
                </p>
              </div>
            </div>
          )}
        </div>
        {onSendQuery && (
          <ChatInput
            onSend={onSendQuery}
            onStartRepoReview={onStartRepoReview}
            onStartDiffReview={onStartDiffReview}
            onCancelReview={onCancelReview}
            disabled={false}
            isReviewing={isReviewing}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        ref={scrollRef}
        className="cr-scrollbar"
        style={{ flex: 1, overflowY: "auto", minHeight: 0 }}
        onScroll={handleScroll}
      >
        {/* Spacer pushes messages toward the bottom when there are few */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", justifyContent: "flex-end" }}>
          <div style={{ margin: "0 12px", paddingTop: 16, paddingBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                findingActions={findingActions}
              />
            ))}
          </div>
        </div>
        <div ref={bottomRef} />
      </div>

      {onSendQuery && (
        <ChatInput
          onSend={onSendQuery}
          onStartRepoReview={onStartRepoReview}
          onStartDiffReview={onStartDiffReview}
          onCancelReview={onCancelReview}
          disabled={false}
          isReviewing={isReviewing}
          hasMessages={messages.length > 0}
        />
      )}
    </div>
  );
}
