import { motion } from "motion/react";
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

const TABS: { id: TabId; label: string; Icon: React.FC<{ style?: React.CSSProperties }> }[] = [
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
    <div style={{
      display: "flex",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      background: "#161616",
      flexShrink: 0,
    }}>
      {TABS.map((tab) => {
        const badge = getBadge(tab.id);
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              position: "relative",
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 500,
              border: "none",
              background: "transparent",
              color: isActive ? "#e5e5e5" : "#525252",
              cursor: "pointer",
              transition: "all 150ms ease",
              lineHeight: 1,
            }}
          >
            <tab.Icon style={{
              width: 15,
              height: 15,
              color: isActive ? "#818cf8" : "currentColor",
              transition: "color 150ms ease",
            }} />
            <span>{tab.label}</span>
            {badge !== null && (
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                minWidth: 18,
                textAlign: "center",
                padding: "2px 6px",
                borderRadius: 9999,
                lineHeight: 1.2,
                background: isActive ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                color: isActive ? "#a5b4fc" : "#525252",
              }}>
                {badge}
              </span>
            )}
            {isActive && (
              <motion.div
                layoutId="active-tab-indicator"
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 8,
                  right: 8,
                  height: 2,
                  borderRadius: 9999,
                  background: "#6366f1",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
