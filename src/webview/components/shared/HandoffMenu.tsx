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
        <div className="flex items-center justify-center size-7 rounded-md bg-[var(--cr-bg-tertiary)] border border-[var(--cr-border-subtle)] shrink-0">
          <LucideIcon className={cn("size-3.5", iconColor)} />
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
        className="size-7 rounded-md shrink-0 object-cover"
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
  /** "left" or "right" alignment */
  align?: "left" | "right";
  className?: string;
}

export function HandoffMenu({ open, onSelect, align = "left", className }: HandoffMenuProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.96 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={cn(
            "absolute bottom-full mb-2 w-56 rounded-xl border border-[var(--cr-border-strong)] bg-[var(--cr-bg-secondary)] shadow-2xl shadow-black/60 z-50 overflow-hidden backdrop-blur-md",
            align === "left" ? "left-0" : "right-0",
            className
          )}
        >
          {/* Header */}
          <div className="px-3 pt-2.5 pb-1.5 border-b border-[var(--cr-border-subtle)]">
            <span className="text-[9px] font-semibold text-[var(--cr-text-ghost)] uppercase tracking-wider">
              Send to Coding Agent
            </span>
          </div>

          <div className="py-1.5">
            {CODING_AGENTS.map((agent) => {
              if (agent.separator) {
                return (
                  <div
                    key={agent.id}
                    className="border-t border-[var(--cr-border-subtle)] my-1.5 mx-3"
                  />
                );
              }
              return (
                <button
                  key={agent.id}
                  onClick={() => onSelect(agent.id)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 text-left",
                    "hover:bg-[var(--cr-bg-hover)] active:bg-[var(--cr-bg-tertiary)]",
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
                    <span className="text-[9px] text-[var(--cr-text-ghost)] bg-[var(--cr-bg-tertiary)] border border-[var(--cr-border-subtle)] px-1.5 py-0.5 rounded font-mono">
                      {agent.suffix}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
