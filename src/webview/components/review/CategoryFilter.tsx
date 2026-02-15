import { useState } from "react";
import {
  BugIcon,
  ShieldAlertIcon,
  LandmarkIcon,
  LayersIcon,
} from "lucide-react";
import type { FindingCategory } from "@/lib/types";

type FilterOption = "all" | FindingCategory;

interface CategoryFilterProps {
  active: FilterOption;
  onChange: (category: FilterOption) => void;
  counts: Record<FilterOption, number>;
}

const CATEGORIES: {
  id: FilterOption;
  label: string;
  dotColor: string;
  activeColor: string;
  activeBg: string;
  Icon: React.FC<{ style?: React.CSSProperties }>;
}[] = [
  {
    id: "all",
    label: "All",
    dotColor: "#737373",
    activeColor: "#e5e5e5",
    activeBg: "rgba(255,255,255,0.08)",
    Icon: LayersIcon,
  },
  {
    id: "bugs",
    label: "Bug",
    dotColor: "#fb7185",
    activeColor: "#fda4af",
    activeBg: "rgba(244,63,94,0.10)",
    Icon: BugIcon,
  },
  {
    id: "security",
    label: "Security",
    dotColor: "#fbbf24",
    activeColor: "#fcd34d",
    activeBg: "rgba(245,158,11,0.10)",
    Icon: ShieldAlertIcon,
  },
  {
    id: "architecture",
    label: "Architecture",
    dotColor: "#60a5fa",
    activeColor: "#93c5fd",
    activeBg: "rgba(59,130,246,0.10)",
    Icon: LandmarkIcon,
  },
];

export function CategoryFilter({
  active,
  onChange,
  counts,
}: CategoryFilterProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", gap: 6 }}>
      {CATEGORIES.map((cat) => {
        const isActive = active === cat.id;
        const isHovered = hoveredId === cat.id;
        const count = counts[cat.id] || 0;

        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            onMouseEnter={() => setHoveredId(cat.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 9999,
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              transition: "all 150ms ease",
              background: isActive ? cat.activeBg : isHovered ? "var(--cr-bg-hover)" : "transparent",
              color: isActive ? cat.activeColor : isHovered ? "var(--cr-text-secondary)" : "var(--cr-text-muted)",
            }}
          >
            {/* Colored dot indicator */}
            <div style={{
              width: 6,
              height: 6,
              borderRadius: 9999,
              flexShrink: 0,
              background: cat.dotColor,
              opacity: isActive ? 1 : 0.4,
              transition: "opacity 150ms ease",
            }} />

            <span>{cat.label}</span>

            {/* Count badge */}
            {count > 0 && (
              <span style={{
                fontSize: 9,
                fontFamily: "var(--cr-font-mono)",
                minWidth: 16,
                textAlign: "center",
                padding: "0 4px",
                borderRadius: 9999,
                background: isActive ? "rgba(255,255,255,0.10)" : "var(--cr-bg-hover)",
                color: isActive ? "inherit" : "var(--cr-text-muted)",
              }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
