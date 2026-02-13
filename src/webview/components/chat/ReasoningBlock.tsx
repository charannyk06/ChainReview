import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDownIcon, ChevronRightIcon, BrainIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReasoningBlockProps {
  text: string;
  defaultCollapsed?: boolean;
}

export function ReasoningBlock({ text, defaultCollapsed = true }: ReasoningBlockProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScrollable = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - 1);
    }
  }, []);

  useEffect(() => {
    checkScrollable();
  }, [text, collapsed, checkScrollable]);

  return (
    <div className="my-1">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "inline-flex items-center gap-1.5 text-left select-none cursor-pointer px-1.5 py-1",
          "hover:bg-[var(--cr-bg-hover)] rounded-md transition-colors"
        )}
      >
        <BrainIcon className="size-3 text-[var(--cr-text-ghost)]" />
        <span className="text-[11px] font-medium text-[var(--cr-text-muted)]">Thoughts</span>
        {collapsed ? (
          <ChevronRightIcon className="size-3 text-[var(--cr-text-ghost)]" />
        ) : (
          <ChevronDownIcon className="size-3 text-[var(--cr-text-ghost)]" />
        )}
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="relative mt-0.5">
              <div
                ref={scrollRef}
                onScroll={checkScrollable}
                className="pl-2.5 border-l border-[var(--cr-border-subtle)] max-h-[150px] overflow-y-auto text-xs text-[var(--cr-text-muted)] leading-relaxed whitespace-pre-wrap break-words [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                <span className="block pb-2">{text}</span>
              </div>
              {canScrollDown && (
                <div className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none bg-gradient-to-t from-[var(--cr-bg-primary)] to-transparent" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
