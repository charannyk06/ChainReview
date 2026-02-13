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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MCPServerInfo } from "@/lib/types";

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  connected: { icon: CheckCircle2Icon, color: "text-emerald-400", label: "Connected" },
  disconnected: { icon: CircleXIcon, color: "text-[var(--cr-text-muted)]", label: "Disconnected" },
  error: { icon: CircleAlertIcon, color: "text-red-400", label: "Error" },
  connecting: { icon: LoaderIcon, color: "text-amber-400", label: "Connecting" },
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
  const statusInfo = STATUS_CONFIG[server.status] || STATUS_CONFIG.disconnected;
  const StatusIcon = statusInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "rounded-lg border overflow-hidden transition-colors duration-150",
        server.config.enabled
          ? "border-[var(--cr-border)] bg-[var(--cr-bg-secondary)]"
          : "border-[var(--cr-border-subtle)] bg-[var(--cr-bg-secondary)]/50 opacity-60"
      )}
    >
      {/* Header Row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Status Icon */}
        <StatusIcon
          className={cn(
            "size-3.5 shrink-0",
            statusInfo.color,
            server.status === "connecting" && "animate-spin"
          )}
        />

        {/* Server name + status */}
        <button
          className="flex-1 min-w-0 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-medium text-[var(--cr-text-primary)] truncate">
              {server.name}
            </span>
            {server.tools.length > 0 && (
              <span className="text-[9px] font-medium text-[var(--cr-text-muted)] bg-[var(--cr-bg-tertiary)] px-1.5 py-0.5 rounded-full leading-none shrink-0">
                {server.tools.length} tool{server.tools.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {server.error && (
            <p className="text-[10px] text-red-400 mt-0.5 truncate">{server.error}</p>
          )}
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onEdit(server)}
            title="Edit"
            className="size-6 flex items-center justify-center rounded-md text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-hover)] transition-colors"
          >
            <PencilIcon className="size-3" />
          </button>
          <button
            onClick={() => onRefresh(server.id)}
            title="Refresh"
            className="size-6 flex items-center justify-center rounded-md text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-hover)] transition-colors"
          >
            <RefreshCwIcon className="size-3" />
          </button>
          <button
            onClick={() => onToggle(server.id, !server.config.enabled)}
            title={server.config.enabled ? "Disable" : "Enable"}
            className={cn(
              "size-6 flex items-center justify-center rounded-md transition-colors",
              server.config.enabled
                ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                : "text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-hover)]"
            )}
          >
            <PowerIcon className="size-3" />
          </button>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="size-6 flex items-center justify-center rounded-md text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-hover)] transition-colors"
          >
            <ChevronDownIcon
              className={cn(
                "size-3 transition-transform duration-150",
                !expanded && "-rotate-90"
              )}
            />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-[var(--cr-border-subtle)]">
              {/* Command */}
              <div className="mt-2">
                <p className="text-[9px] text-[var(--cr-text-muted)] font-medium uppercase tracking-wider mb-1">
                  Command
                </p>
                <div className="bg-[var(--cr-bg-root)] rounded-md px-2 py-1.5">
                  <code className="text-[10px] text-[var(--cr-text-secondary)] font-mono break-all">
                    {server.config.command} {server.config.args.join(" ")}
                  </code>
                </div>
              </div>

              {/* Environment Variables */}
              {server.config.env && Object.keys(server.config.env).length > 0 && (
                <div className="mt-2">
                  <p className="text-[9px] text-[var(--cr-text-muted)] font-medium uppercase tracking-wider mb-1">
                    Environment
                  </p>
                  <div className="bg-[var(--cr-bg-root)] rounded-md px-2 py-1.5 space-y-0.5">
                    {Object.entries(server.config.env).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <span className="text-[10px] text-indigo-400 font-mono">{key}</span>
                        <span className="text-[10px] text-[var(--cr-text-muted)]">=</span>
                        <span className="text-[10px] text-[var(--cr-text-secondary)] font-mono truncate">
                          {value.length > 20 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tools List */}
              {server.tools.length > 0 && (
                <div className="mt-2">
                  <p className="text-[9px] text-[var(--cr-text-muted)] font-medium uppercase tracking-wider mb-1">
                    Tools ({server.tools.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {server.tools.map((tool) => (
                      <span
                        key={tool.name}
                        title={tool.description}
                        className="inline-flex items-center gap-1 text-[10px] text-[var(--cr-text-secondary)] bg-[var(--cr-bg-root)] rounded px-1.5 py-0.5 border border-[var(--cr-border-subtle)]"
                      >
                        <WrenchIcon className="size-2.5 text-[var(--cr-text-muted)]" />
                        {tool.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Delete button */}
              <div className="mt-3 pt-2 border-t border-[var(--cr-border-subtle)]">
                <button
                  onClick={() => onRemove(server.id)}
                  className="flex items-center gap-1.5 text-[10px] text-red-400 hover:text-red-300 transition-colors"
                >
                  <TrashIcon className="size-3" />
                  Remove Server
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
