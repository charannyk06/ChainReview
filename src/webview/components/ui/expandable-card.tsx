"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

interface ExpandableCardContextValue {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  layoutId: string;
}

const ExpandableCardContext = createContext<ExpandableCardContextValue | null>(
  null
);

function useExpandableCard() {
  const context = useContext(ExpandableCardContext);
  if (!context) {
    throw new Error(
      "useExpandableCard must be used within an ExpandableCard"
    );
  }
  return context;
}

export interface ExpandableCardProps {
  children: React.ReactNode;
  className?: string;
}

export function ExpandableCard({ children, className }: ExpandableCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        close();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  return (
    <ExpandableCardContext.Provider
      value={{ isOpen, toggle, close, layoutId: id }}
    >
      <div ref={containerRef} className={cn("relative", className)}>
        {children}
      </div>
    </ExpandableCardContext.Provider>
  );
}

export interface ExpandableCardTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export function ExpandableCardTrigger({
  children,
  className,
}: ExpandableCardTriggerProps) {
  const { toggle, layoutId, isOpen } = useExpandableCard();

  return (
    <>
      <motion.div
        layoutId={`expandable-card-${layoutId}`}
        onClick={toggle}
        className={cn(
          "cursor-pointer rounded-xl border border-neutral-800 bg-neutral-950 p-4",
          className
        )}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        {children}
      </motion.div>
    </>
  );
}

export interface ExpandableCardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ExpandableCardContent({
  children,
  className,
}: ExpandableCardContentProps) {
  const { isOpen, close, layoutId } = useExpandableCard();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />

          {/* Expanded content */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              layoutId={`expandable-card-${layoutId}`}
              className={cn(
                "w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl",
                className
              )}
            >
              {/* Close button */}
              <button
                onClick={close}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
