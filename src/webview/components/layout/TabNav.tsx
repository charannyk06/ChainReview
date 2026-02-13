import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  MessageSquareIcon,
  AlertTriangleIcon,
  ClockIcon,
} from "lucide-react";

export type TabId = "chat" | "findings" | "timeline";

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  findingsCount?: number;
  eventsCount?: number;
}

const TABS: { id: TabId; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: "chat", label: "Chat", Icon: MessageSquareIcon },
  { id: "findings", label: "Findings", Icon: AlertTriangleIcon },
  { id: "timeline", label: "Timeline", Icon: ClockIcon },
];

export function TabNav({
  activeTab,
  onTabChange,
  findingsCount = 0,
  eventsCount = 0,
}: TabNavProps) {
  const getBadge = (tab: TabId) => {
    if (tab === "findings" && findingsCount > 0) return findingsCount;
    if (tab === "timeline" && eventsCount > 0) return eventsCount;
    return null;
  };

  return (
    <div className="flex border-b border-[var(--cr-border)] bg-[var(--cr-bg-primary)] shrink-0">
      {TABS.map((tab) => {
        const badge = getBadge(tab.id);
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-all duration-150",
              isActive
                ? "text-[var(--cr-text-primary)]"
                : "text-[var(--cr-text-muted)] hover:text-[var(--cr-text-tertiary)]"
            )}
          >
            <tab.Icon className={cn(
              "size-3.5 transition-colors",
              isActive ? "text-[var(--cr-accent)]" : "text-current"
            )} />
            <span>{tab.label}</span>
            {badge !== null && (
              <span className={cn(
                "text-[9px] font-semibold min-w-[16px] text-center px-1 py-0 rounded-full leading-snug",
                isActive
                  ? "bg-[var(--cr-accent-muted)] text-[var(--cr-accent-hover)]"
                  : "bg-[var(--cr-bg-tertiary)] text-[var(--cr-text-muted)]"
              )}>
                {badge}
              </span>
            )}
            {isActive && (
              <motion.div
                layoutId="active-tab-indicator"
                className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[var(--cr-accent)]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
