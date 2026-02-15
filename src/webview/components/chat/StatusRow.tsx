import {
  AlertTriangleIcon,
  InfoIcon,
  CheckCircle2Icon,
  CircleXIcon,
} from "lucide-react";
import type { StatusBlock } from "@/lib/types";

interface StatusRowProps {
  block: StatusBlock;
}

const LEVEL_CONFIG: Record<string, {
  Icon: React.FC<{ style?: React.CSSProperties }>;
  iconColor: string;
  textColor: string;
}> = {
  info: {
    Icon: InfoIcon,
    iconColor: "var(--cr-text-ghost)",
    textColor: "var(--cr-text-muted)",
  },
  warning: {
    Icon: AlertTriangleIcon,
    iconColor: "rgba(251,191,36,0.50)",
    textColor: "rgba(252,211,77,0.60)",
  },
  error: {
    Icon: CircleXIcon,
    iconColor: "rgba(248,113,113,0.50)",
    textColor: "rgba(252,165,165,0.60)",
  },
  success: {
    Icon: CheckCircle2Icon,
    iconColor: "rgba(52,211,153,0.50)",
    textColor: "rgba(110,231,183,0.60)",
  },
};

export function StatusRow({ block }: StatusRowProps) {
  const config = LEVEL_CONFIG[block.level] || LEVEL_CONFIG.info;
  const { Icon } = config;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "2px 0",
      fontSize: 10.5,
      lineHeight: "normal",
    }}>
      <Icon style={{ width: 12, height: 12, flexShrink: 0, color: config.iconColor }} />
      <span style={{
        color: config.textColor,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {block.step && (
          <span style={{ fontWeight: 600, marginRight: 4 }}>{block.step}:</span>
        )}
        {block.text}
      </span>
    </div>
  );
}
