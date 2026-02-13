import { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChatMessage, type FindingActions } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import type { ConversationMessage } from "@/lib/types";

interface ChatContainerProps {
  messages: ConversationMessage[];
  onSendQuery?: (query: string) => void;
  onStartRepoReview?: () => void;
  onStartDiffReview?: () => void;
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
  className,
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
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex-1 flex items-center justify-center">
          {isReviewing ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[var(--cr-accent)]"
                    style={{ animation: `pulse-dot 1.2s ease-in-out ${i * 200}ms infinite` }}
                  />
                ))}
              </div>
              <span className="text-[11px] text-[var(--cr-text-tertiary)] font-medium">
                Starting review...
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-8 text-center">
              <div className="size-9 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 border border-indigo-500/10 flex items-center justify-center">
                <svg className="size-4.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <div>
                <p className="text-[12px] text-[var(--cr-text-secondary)] font-medium mb-0.5">
                  ChainReview
                </p>
                <p className="text-[11px] text-[var(--cr-text-muted)] leading-relaxed">
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
    <div className={cn("flex flex-col h-full", className)}>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        <div className="flex flex-col gap-2 pb-4 pt-2">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              findingActions={findingActions}
            />
          ))}
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
        />
      )}
    </div>
  );
}
