import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDownIcon,
  PowerIcon,
  RefreshCwIcon,
  TrashIcon,
  PencilIcon,
  WrenchIcon,
  CircleAlertIcon,
  CheckCircle2Icon,
  LoaderIcon,
  CircleXIcon,
  TerminalIcon,
  KeyIcon,
  ZapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MCPServerInfo } from "@/lib/types";

const STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; label: string; glow?: string }
> = {
  connected: {
    icon: CheckCircle2Icon,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    label: "Connected",
    glow: "shadow-[0_0_12px_rgba(52,211,153,0.15)]",
  },
  disconnected: {
    icon: CircleXIcon,
    color: "text-zinc-500",
    bg: "bg-zinc-500/10",
    label: "Disconnected",
  },
  error: {
    icon: CircleAlertIcon,
    color: "text-red-400",
    bg: "bg-red-500/10",
    label: "Error",
    glow: "shadow-[0_0_12px_rgba(248,113,113,0.15)]",
  },
  connecting: {
    icon: LoaderIcon,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    label: "Connecting",
    glow: "shadow-[0_0_12px_rgba(251,191,36,0.15)]",
  },
};

interface MCPServerCardProps {
  server: MCPServerInfo;
  onToggle: (serverId: string, enabled: boolean) => void;
  onRefresh: (serverId: string) => void;
  onRemove: (serverId: string) => void;
  onEdit: (server: MCPServerInfo) => void;
}

export function MCPServerCard({
  server,
  onToggle,
  onRefresh,
  onRemove,
  onEdit,
}: MCPServerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const statusInfo = STATUS_CONFIG[server.status] || STATUS_CONFIG.disconnected;
  const StatusIcon = statusInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative rounded-xl border overflow-hidden transition-all duration-300",
        server.config.enabled
          ? cn(
              "border-[var(--cr-border)] bg-gradient-to-b from-[var(--cr-bg-secondary)] to-[var(--cr-bg-primary)]",
              statusInfo.glow,
              isHovered && "border-[var(--cr-border-hover)]"
            )
          : "border-[var(--cr-border-subtle)] bg-[var(--cr-bg-secondary)]/40 opacity-50"
      )}
    >
      {/* Gradient overlay on hover */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-r from-indigo-500/[0.03] via-transparent to-violet-500/[0.03] opacity-0 transition-opacity duration-300",
          isHovered && server.config.enabled && "opacity-100"
        )}
      />

      {/* Header Row */}
      <div className="relative flex items-center gap-3 px-4 py-3">
        {/* Status indicator with pulse */}
        <div className="relative">
          <div
            className={cn(
              "size-8 rounded-lg flex items-center justify-center transition-colors duration-200",
              statusInfo.bg
            )}
          >
            <StatusIcon
              className={cn(
                "size-4",
                statusInfo.color,
                server.status === "connecting" && "animate-spin"
              )}
            />
          </div>
          {server.status === "connected" && (
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 border-2 border-[var(--cr-bg-secondary)]">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-50" />
            </span>
          )}
        </div>

        {/* Server info */}
        <button
          className="flex-1 min-w-0 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--cr-text-primary)] truncate">
              {server.name}
            </span>
            {server.tools.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full leading-none shrink-0">
                <ZapIcon className="size-2.5" />
                {server.tools.length} tool{server.tools.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--cr-text-muted)] mt-0.5 truncate">
            {server.error ? (
              <span className="text-red-400">{server.error}</span>
            ) : (
              <span className="font-mono opacity-70">{server.config.command}</span>
            )}
          </p>
        </button>

        {/* Action buttons */}
        <div
          className={cn(
            "flex items-center gap-1 transition-opacity duration-200",
            !isHovered && !expanded ? "opacity-0 group-hover:opacity-100" : "opacity-100"
          )}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onEdit(server)}
            title="Edit"
            className="size-7 flex items-center justify-center rounded-lg text-[var(--cr-text-muted)] hover:text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-hover)] transition-colors"
          >
            <PencilIcon className="size-3.5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05, rotate: 180 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onRefresh(server.id)}
            title="Refresh"
            className="size-7 flex items-center justify-center rounded-lg text-[var(--cr-text-muted)] hover:text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-hover)] transition-colors"
          >
            <RefreshCwIcon className="size-3.5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onToggle(server.id, !server.config.enabled)}
            title={server.config.enabled ? "Disable" : "Enable"}
            className={cn(
              "size-7 flex items-center justify-center rounded-lg transition-all duration-200",
              server.config.enabled
                ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                : "text-[var(--cr-text-muted)] hover:text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-hover)]"
            )}
          >
            <PowerIcon className="size-3.5" />
          </motion.button>

          {/* Expand toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setExpanded(!expanded)}
            className="size-7 flex items-center justify-center rounded-lg text-[var(--cr-text-muted)] hover:text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-hover)] transition-colors"
          >
            <motion.div
              animate={{ rotate: expanded ? 0 : -90 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDownIcon className="size-3.5" />
            </motion.div>
          </motion.button>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="relative px-4 pb-4 pt-2 border-t border-[var(--cr-border-subtle)]">
              {/* Background pattern */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.03),transparent_70%)]" />

              <div className="relative space-y-3">
                {/* Command */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <TerminalIcon className="size-3 text-[var(--cr-text-muted)]" />
                    <span className="text-[10px] text-[var(--cr-text-muted)] font-medium uppercase tracking-wider">
                      Command
                    </span>
                  </div>
                  <div className="bg-[var(--cr-bg-root)] border border-[var(--cr-border-subtle)] rounded-lg px-3 py-2">
                    <code className="text-[11px] text-[var(--cr-text-secondary)] font-mono">
                      <span className="text-indigo-400">{server.config.command}</span>
                      {server.config.args.length > 0 && (
                        <span className="text-[var(--cr-text-muted)]">
                          {" "}{server.config.args.join(" ")}
                        </span>
                      )}
                    </code>
                  </div>
                </div>

                {/* Environment Variables */}
                {server.config.env && Object.keys(server.config.env).length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <KeyIcon className="size-3 text-[var(--cr-text-muted)]" />
                      <span className="text-[10px] text-[var(--cr-text-muted)] font-medium uppercase tracking-wider">
                        Environment
                      </span>
                    </div>
                    <div className="bg-[var(--cr-bg-root)] border border-[var(--cr-border-subtle)] rounded-lg divide-y divide-[var(--cr-border-subtle)]">
                      {Object.entries(server.config.env).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 px-3 py-1.5">
                          <span className="text-[11px] text-emerald-400 font-mono font-medium">
                            {key}
                          </span>
                          <span className="text-[11px] text-[var(--cr-text-muted)]">=</span>
                          <span className="text-[11px] text-[var(--cr-text-secondary)] font-mono truncate">
                            {value.length > 24 ? `${value.slice(0, 10)}•••${value.slice(-6)}` : value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tools Grid */}
                {server.tools.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <WrenchIcon className="size-3 text-[var(--cr-text-muted)]" />
                      <span className="text-[10px] text-[var(--cr-text-muted)] font-medium uppercase tracking-wider">
                        Available Tools
                      </span>
                      <span className="text-[9px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">
                        {server.tools.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {server.tools.map((tool) => (
                        <motion.div
                          key={tool.name}
                          whileHover={{ scale: 1.02 }}
                          title={tool.description}
                          className="group/tool flex items-center gap-2 bg-[var(--cr-bg-root)] border border-[var(--cr-border-subtle)] hover:border-indigo-500/30 rounded-lg px-2.5 py-2 cursor-default transition-colors"
                        >
                          <div className="size-6 rounded-md bg-indigo-500/10 flex items-center justify-center shrink-0">
                            <WrenchIcon className="size-3 text-indigo-400" />
                          </div>
                          <span className="text-[10px] text-[var(--cr-text-secondary)] font-medium truncate group-hover/tool:text-[var(--cr-text-primary)] transition-colors">
                            {tool.name.split(".").pop()}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delete button */}
                <div className="pt-2 border-t border-[var(--cr-border-subtle)]">
                  <motion.button
                    whileHover={{ x: 2 }}
                    onClick={() => onRemove(server.id)}
                    className="flex items-center gap-2 text-[11px] text-red-400/80 hover:text-red-400 transition-colors"
                  >
                    <TrashIcon className="size-3.5" />
                    Remove Server
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
