import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ClipboardCopyIcon,
  FileDownIcon,
  SettingsIcon,
} from "lucide-react";
import { CODING_AGENTS } from "@/lib/constants";

/** Map lucide icon names to components */
const LUCIDE_ICONS: Record<string, React.FC<{ style?: React.CSSProperties }>> = {
  "clipboard-copy": ClipboardCopyIcon,
  "file-down": FileDownIcon,
  settings: SettingsIcon,
};

function AgentIcon({ icon, iconColor }: { icon: string; iconColor?: string }) {
  if (icon.startsWith("lucide:")) {
    const name = icon.replace("lucide:", "");
    const LucideIcon = LUCIDE_ICONS[name];
    if (LucideIcon) {
      return (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          borderRadius: 6,
          background: "var(--cr-bg-tertiary)",
          border: "1px solid var(--cr-border-subtle)",
          flexShrink: 0,
        }}>
          <LucideIcon style={{ width: 12, height: 12, color: iconColor || "currentColor" }} />
        </div>
      );
    }
  }
  // Image-based logo
  if (icon && !icon.startsWith("lucide:")) {
    return (
      <img
        src={icon}
        alt=""
        style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, objectFit: "cover" }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return null;
}

interface HandoffMenuProps {
  open: boolean;
  onSelect: (agentId: string) => void;
  /** Ref to the trigger button — used to position the portal dropdown */
  triggerRef: React.RefObject<HTMLElement | null>;
  /** "left" or "right" alignment */
  align?: "left" | "right";
}

/**
 * Handoff menu rendered via React Portal.
 * This escapes any overflow-hidden ancestors (e.g. Framer Motion collapse wrappers)
 * so the dropdown is always fully visible.
 */
export function HandoffMenu({ open, onSelect, triggerRef, align = "left" }: HandoffMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Calculate position from trigger button's bounding rect
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 224;

    let left: number;
    if (align === "right") {
      left = rect.right - menuWidth;
    } else {
      left = rect.left;
    }

    // Clamp to viewport
    left = Math.max(4, Math.min(left, window.innerWidth - menuWidth - 4));

    setPos({
      top: rect.bottom + 8,
      left,
    });
  }, [triggerRef, align]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.96 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{
            position: "fixed",
            width: 224,
            borderRadius: 12,
            border: "1px solid var(--cr-border-strong)",
            background: "#1c1c1c",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
            zIndex: 9999,
            overflow: "hidden",
            top: pos.top,
            left: pos.left,
          }}
        >
          {/* Header */}
          <div style={{
            padding: "10px 12px 6px 12px",
            borderBottom: "1px solid var(--cr-border)",
          }}>
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              color: "var(--cr-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              Send to Coding Agent
            </span>
          </div>

          <div style={{ padding: "4px 0" }}>
            {CODING_AGENTS.map((agent) => {
              if (agent.separator) {
                return (
                  <div
                    key={agent.id}
                    style={{
                      borderTop: "1px solid var(--cr-border)",
                      margin: "4px 12px",
                    }}
                  />
                );
              }
              const isHovered = hoveredId === agent.id;
              return (
                <button
                  key={agent.id}
                  onClick={() => onSelect(agent.id)}
                  onMouseEnter={() => setHoveredId(agent.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "8px 12px",
                    textAlign: "left",
                    background: isHovered ? "rgba(255,255,255,0.06)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 100ms ease",
                  }}
                >
                  {/* Agent icon */}
                  <AgentIcon icon={agent.icon} />

                  {/* Label */}
                  <span style={{
                    fontSize: 12,
                    fontWeight: 500,
                    flex: 1,
                    lineHeight: 1.3,
                    color: agent.color?.includes("red") ? "#fca5a5"
                         : agent.color?.includes("amber") ? "#fcd34d"
                         : agent.color?.includes("blue") ? "#93c5fd"
                         : agent.color?.includes("emerald") ? "#6ee7b7"
                         : "#e5e5e5",
                  }}>
                    {agent.label}
                  </span>

                  {/* Suffix badge */}
                  {agent.suffix && (
                    <span style={{
                      fontSize: 9,
                      color: "var(--cr-text-muted)",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontFamily: "var(--cr-font-mono)",
                    }}>
                      {agent.suffix}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
