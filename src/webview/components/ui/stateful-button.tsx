"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

type ButtonState = "idle" | "loading" | "success" | "error";

export interface StatefulButtonProps {
  onClick: () => Promise<void>;
  children: React.ReactNode;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  className?: string;
  disabled?: boolean;
  successDuration?: number;
  errorDuration?: number;
}

function SpinnerIcon() {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-25"
      />
      <path
        d="M12 2a10 10 0 019.95 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-75"
      />
    </motion.svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <motion.path
        d="M5 12l5 5L20 7"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3 }}
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <motion.line
        x1="18"
        y1="6"
        x2="6"
        y2="18"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.2 }}
      />
      <motion.line
        x1="6"
        y1="6"
        x2="18"
        y2="18"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.2, delay: 0.1 }}
      />
    </svg>
  );
}

export function StatefulButton({
  onClick,
  children,
  loadingText = "Loading...",
  successText = "Done",
  errorText = "Failed",
  className,
  disabled = false,
  successDuration = 2000,
  errorDuration = 2000,
}: StatefulButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(async () => {
    if (state !== "idle" || disabled) return;

    setState("loading");

    try {
      await onClick();
      setState("success");

      timeoutRef.current = setTimeout(() => {
        setState("idle");
      }, successDuration);
    } catch {
      setState("error");

      timeoutRef.current = setTimeout(() => {
        setState("idle");
      }, errorDuration);
    }
  }, [onClick, state, disabled, successDuration, errorDuration]);

  const isDisabled = disabled || state !== "idle";

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        state === "idle" &&
          "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
        state === "loading" && "cursor-wait bg-blue-600/80 text-white",
        state === "success" && "bg-emerald-600 text-white",
        state === "error" && "bg-red-600 text-white",
        isDisabled && state === "idle" && "cursor-not-allowed opacity-50",
        className
      )}
      aria-busy={state === "loading"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === "idle" && (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            {children}
          </motion.span>
        )}

        {state === "loading" && (
          <motion.span
            key="loading"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <SpinnerIcon />
            {loadingText}
          </motion.span>
        )}

        {state === "success" && (
          <motion.span
            key="success"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <CheckIcon />
            {successText}
          </motion.span>
        )}

        {state === "error" && (
          <motion.span
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <ErrorIcon />
            {errorText}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
