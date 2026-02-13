import { SpotlightBackground } from "@/components/ui/spotlight";
import { ColourfulText } from "@/components/ui/colourful-text";
import { EncryptedText } from "@/components/ui/encrypted-text";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { FolderSearchIcon, GitCompareArrowsIcon, ClockIcon } from "lucide-react";

interface EmptyStateProps {
  onStartRepoReview: () => void;
  onStartDiffReview: () => void;
  onOpenHistory?: () => void;
}

export function EmptyState({
  onStartRepoReview,
  onStartDiffReview,
  onOpenHistory,
}: EmptyStateProps) {
  return (
    <SpotlightBackground
      className="flex flex-col items-center justify-center min-h-screen p-6"
      fill="rgba(99, 102, 241, 0.06)"
    >
      <div className="flex flex-col items-center gap-10">
        {/* Tagline */}
        <div className="text-center space-y-5">
          <div className="text-2xl font-bold tracking-tight">
            <ColourfulText text="ChainReview" />
          </div>
          <div className="text-[13px] text-[var(--cr-text-tertiary)] min-h-[20px]">
            <EncryptedText
              text="AI-powered repo-scale code review"
              interval={40}
              animateOn="mount"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 w-full max-w-[260px]">
          <HoverBorderGradient
            containerClassName="w-full rounded-lg"
            className="w-full flex items-center justify-center gap-2.5 bg-[var(--cr-bg-primary)] px-5 py-3.5 rounded-lg"
            as="button"
            duration={4}
            onClick={onStartRepoReview}
          >
            <FolderSearchIcon className="size-4 text-indigo-400" />
            <span className="text-[13px] font-medium text-white">
              Review Repository
            </span>
          </HoverBorderGradient>

          <HoverBorderGradient
            containerClassName="w-full rounded-lg"
            className="w-full flex items-center justify-center gap-2.5 bg-[var(--cr-bg-secondary)] px-5 py-3.5 rounded-lg"
            as="button"
            duration={5}
            onClick={onStartDiffReview}
          >
            <GitCompareArrowsIcon className="size-4 text-[var(--cr-text-tertiary)]" />
            <span className="text-[13px] font-medium text-[var(--cr-text-secondary)]">
              Review Diff
            </span>
          </HoverBorderGradient>
        </div>

        {/* History link */}
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 text-[11px] text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] transition-colors"
          >
            <ClockIcon className="size-3" />
            View past reviews
          </button>
        )}

        {/* Version */}
        <p className="text-[9px] text-[var(--cr-text-ghost)] tracking-widest uppercase font-medium">
          v0.1.0 &middot; Opus 4
        </p>
      </div>
    </SpotlightBackground>
  );
}
