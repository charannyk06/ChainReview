"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface LoadingState {
  text: string;
}

export interface MultiStepLoaderProps {
  loadingStates: LoadingState[];
  loading: boolean;
  duration?: number;
  loop?: boolean;
  className?: string;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={cn("h-4 w-4", className)}
    >
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className={cn("h-4 w-4", className)}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </motion.svg>
  );
}

export function MultiStepLoader({
  loadingStates,
  loading,
  duration = 2000,
  loop = true,
  className,
}: MultiStepLoaderProps) {
  const [currentState, setCurrentState] = useState(0);

  useEffect(() => {
    if (!loading) {
      setCurrentState(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentState((prev) => {
        if (prev >= loadingStates.length - 1) {
          if (loop) return 0;
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, duration);

    return () => clearInterval(interval);
  }, [loading, loadingStates.length, duration, loop]);

  if (!loading) return null;

  return (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div
          key="loader-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm",
            "bg-black/60",
            className
          )}
        >
          <div className="relative flex flex-col gap-3 w-full max-w-md mx-4">
            {loadingStates.map((state, index) => {
              const isCompleted = index < currentState;
              const isCurrent = index === currentState;
              const isUpcoming = index > currentState;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{
                    opacity: isUpcoming ? 0.4 : 1,
                    y: 0,
                  }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
                    isCompleted &&
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
                    isCurrent &&
                      "border-blue-500/30 bg-blue-500/10 text-blue-400",
                    isUpcoming &&
                      "border-neutral-700 bg-neutral-900/50 text-neutral-500"
                  )}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {isCompleted && <CheckIcon className="text-emerald-400" />}
                    {isCurrent && <LoaderIcon className="text-blue-400" />}
                    {isUpcoming && (
                      <div className="h-2 w-2 rounded-full bg-neutral-600" />
                    )}
                  </div>
                  <span className="truncate">{state.text}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
