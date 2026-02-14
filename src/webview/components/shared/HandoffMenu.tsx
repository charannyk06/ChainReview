import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ClipboardCopyIcon,
  FileDownIcon,
  SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CODING_AGENTS } from "@/lib/constants";

/** Map lucide icon names to components */
const LUCIDE_ICONS: Record<string, React.FC<{ className?: string }>> = {
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
        <div className="flex items-center justify-center size-6 rounded-md bg-[var(--cr-bg-tertiary)] border border-[var(--cr-border-subtle)] shrink-0">
          <LucideIcon className={cn("size-3", iconColor)} />
        </div>
      );
    }
  }
  // Image-based logo — render as a clean rounded square
  if (icon && !icon.startsWith("lucide:")) {
    return (
      <img
        src={icon}
        alt=""
        className="size-6 rounded-md shrink-0 object-cover"
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
  className?: string;
}

/**
 * Handoff menu rendered via React Portal.
 * This escapes any overflow-hidden ancestors (e.g. Framer Motion collapse wrappers)
 * so the dropdown is always fully visible.
 */
export function HandoffMenu({ open, onSelect, triggerRef, align = "left", className }: HandoffMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Calculate position from trigger button's bounding rect
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 224; // w-56 = 14rem = 224px

    let left: number;
    if (align === "right") {
      left = rect.right - menuWidth;
    } else {
      left = rect.left;
    }

    // Clamp to viewport
    left = Math.max(4, Math.min(left, window.innerWidth - menuWidth - 4));

    setPos({
      top: rect.bottom + 8, // mt-2 equivalent
      left,
    });
  }, [triggerRef, align]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    // Re-position on scroll/resize
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
          className={cn(
            "fixed w-56 rounded-xl border border-[var(--cr-border-strong)] bg-[#1c1c1c] shadow-2xl shadow-black/70 z-[9999] overflow-hidden",
            className
          )}
          style={{
            top: pos.top,
            left: pos.left,
            backdropFilter: "none",
          }}
        >
          {/* Header */}
          <div className="px-3 pt-2.5 pb-1.5 border-b border-[var(--cr-border)]">
            <span className="text-[9px] font-semibold text-[var(--cr-text-muted)] uppercase tracking-wider">
              Send to Coding Agent
            </span>
          </div>

          <div className="py-1">
            {CODING_AGENTS.map((agent) => {
              if (agent.separator) {
                return (
                  <div
                    key={agent.id}
                    className="border-t border-[var(--cr-border)] my-1 mx-3"
                  />
                );
              }
              return (
                <button
                  key={agent.id}
                  onClick={() => onSelect(agent.id)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 text-left",
                    "hover:bg-white/[0.06] active:bg-white/[0.08]",
                    "transition-colors duration-100 cursor-pointer"
                  )}
                >
                  {/* Agent icon — image logo or lucide fallback */}
                  <AgentIcon icon={agent.icon} iconColor={agent.iconColor} />

                  {/* Label */}
                  <span className={cn("text-[12px] font-medium flex-1 leading-tight", agent.color)}>
                    {agent.label}
                  </span>

                  {/* Suffix badge */}
                  {agent.suffix && (
                    <span className="text-[9px] text-[var(--cr-text-muted)] bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.5 rounded font-mono">
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
