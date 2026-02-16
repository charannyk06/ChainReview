import { motion, AnimatePresence } from "motion/react";
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
          className={className}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.70)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
            onClick={onDismiss}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            style={{
              position: "relative",
              zIndex: 10,
              width: "100%",
              maxWidth: 520,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              borderRadius: "var(--cr-radius-xl)",
              border: "1px solid var(--cr-border-strong)",
              background: "var(--cr-bg-secondary)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.3)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--cr-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--cr-text-primary)",
                    margin: 0,
                  }}
                >
                  Patch Proposal
                </h3>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--cr-text-muted)",
                    marginTop: 2,
                    fontFamily: "var(--cr-font-mono)",
                  }}
                >
                  Finding: {patch.findingId}
                </p>
              </div>
              {patch.validated ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: "rgba(52, 211, 153, 0.12)",
                    color: "#6ee7b7",
                    padding: "3px 10px",
                    borderRadius: "var(--cr-radius-full)",
                    border: "1px solid rgba(52, 211, 153, 0.20)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Validated
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: "rgba(234, 179, 8, 0.12)",
                    color: "#fde047",
                    padding: "3px 10px",
                    borderRadius: "var(--cr-radius-full)",
                    border: "1px solid rgba(234, 179, 8, 0.20)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Pending Validation
                </span>
              )}
            </div>

            {/* Diff body — scrollable */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                minHeight: 0,
              }}
              className="thin-scrollbar"
            >
              <DiffViewer diff={patch.diff} />
              {patch.validationMessage && (
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: "var(--cr-text-muted)",
                    background: "var(--cr-bg-tertiary)",
                    borderRadius: "var(--cr-radius-lg)",
                    padding: 12,
                    border: "1px solid var(--cr-border-subtle)",
                    lineHeight: 1.5,
                  }}
                >
                  {patch.validationMessage}
                </p>
              )}
            </div>

            {/* Footer actions — sticky bottom */}
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--cr-border)",
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                flexShrink: 0,
                background: "var(--cr-bg-secondary)",
              }}
            >
              <button
                onClick={onDismiss}
                className="cr-btn cr-btn-secondary"
              >
                Dismiss
              </button>
              <button
                onClick={() => onApply?.(patch.id)}
                disabled={!patch.validated}
                className={
                  patch.validated
                    ? "cr-btn cr-btn-emerald"
                    : "cr-btn"
                }
                style={
                  !patch.validated
                    ? {
                        background: "var(--cr-bg-tertiary)",
                        color: "var(--cr-text-muted)",
                        cursor: "not-allowed",
                        borderColor: "var(--cr-border-subtle)",
                      }
                    : undefined
                }
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
