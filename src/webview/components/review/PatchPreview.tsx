import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { DiffViewer } from "./DiffViewer";
import type { Patch } from "@/lib/types";

interface PatchPreviewProps {
  patch: Patch | null;
  onApply?: (patchId: string) => void;
  onDismiss?: () => void;
  className?: string;
}

export function PatchPreview({
  patch,
  onApply,
  onDismiss,
  className,
}: PatchPreviewProps) {
  return (
    <AnimatePresence>
      {patch && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4",
            className
          )}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onDismiss}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative z-10 w-full max-w-lg max-h-[80vh] flex flex-col rounded-xl border border-[var(--cr-border-strong)] bg-[var(--cr-bg-secondary)] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--cr-border)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--cr-text-primary)]">
                  Patch Proposal
                </h3>
                <p className="text-[11px] text-[var(--cr-text-muted)] mt-0.5 font-mono">
                  Finding: {patch.findingId}
                </p>
              </div>
              {patch.validated ? (
                <span className="text-[10px] font-medium bg-emerald-500/15 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Validated
                </span>
              ) : (
                <span className="text-[10px] font-medium bg-yellow-500/15 text-yellow-300 px-2.5 py-0.5 rounded-full border border-yellow-500/20">
                  Pending Validation
                </span>
              )}
            </div>

            {/* Diff */}
            <div className="flex-1 overflow-y-auto p-4">
              <DiffViewer diff={patch.diff} />
              {patch.validationMessage && (
                <p className="mt-3 text-xs text-[var(--cr-text-muted)] bg-[var(--cr-bg-tertiary)] rounded-lg p-3 border border-[var(--cr-border-subtle)]">
                  {patch.validationMessage}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 py-3 border-t border-[var(--cr-border)] flex gap-2 justify-end">
              <button
                onClick={onDismiss}
                className="cr-btn cr-btn-secondary"
              >
                Dismiss
              </button>
              <button
                onClick={() => onApply?.(patch.id)}
                disabled={!patch.validated}
                className={cn(
                  "cr-btn",
                  patch.validated
                    ? "cr-btn-emerald"
                    : "bg-[var(--cr-bg-tertiary)] text-[var(--cr-text-muted)] cursor-not-allowed border-[var(--cr-border-subtle)]"
                )}
              >
                Apply Patch
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
