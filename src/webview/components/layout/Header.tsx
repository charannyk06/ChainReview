import { PlusIcon, ServerIcon, ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onNewThread?: () => void;
  onOpenMCPManager?: () => void;
  onOpenHistory?: () => void;
  className?: string;
}

export function Header({ onNewThread, onOpenMCPManager, onOpenHistory, className }: HeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-4 py-2 border-b shrink-0",
        "border-[var(--cr-border)] bg-[var(--cr-bg-primary)]",
        className
      )}
    >
      {/* Left: Brand */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-[12px] font-semibold text-[var(--cr-text-primary)] tracking-tight">
          ChainReview
        </span>
        <span className="text-[9px] font-medium text-[var(--cr-text-muted)] bg-[var(--cr-bg-tertiary)] px-1.5 py-0.5 rounded-full leading-none">
          v0.1
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Task History */}
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            title="Task History"
            className={cn(
              "size-7 flex items-center justify-center rounded-lg",
              "text-[var(--cr-text-muted)]",
              "hover:text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-hover)]",
              "transition-all duration-150 cursor-pointer"
            )}
          >
            <ClockIcon className="size-3.5" />
          </button>
        )}

        {/* MCP Server Manager */}
        {onOpenMCPManager && (
          <button
            onClick={onOpenMCPManager}
            title="MCP Server Manager"
            className={cn(
              "size-7 flex items-center justify-center rounded-lg",
              "text-[var(--cr-text-muted)]",
              "hover:text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-hover)]",
              "transition-all duration-150 cursor-pointer"
            )}
          >
            <ServerIcon className="size-3.5" />
          </button>
        )}

        {/* New Thread */}
        {onNewThread && (
          <button
            onClick={onNewThread}
            title="New Thread"
            className={cn(
              "size-7 flex items-center justify-center rounded-lg",
              "text-[var(--cr-text-muted)]",
              "hover:text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-hover)]",
              "transition-all duration-150 cursor-pointer"
            )}
          >
            <PlusIcon className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
