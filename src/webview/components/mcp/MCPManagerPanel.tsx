import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeftIcon,
  PlusIcon,
  ServerIcon,
  RefreshCwIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MCPServerCard } from "./MCPServerCard";
import { MCPEditor } from "./MCPEditor";
import type { MCPServerInfo, MCPServerConfig } from "@/lib/types";

type PanelView = "list" | "editor";

interface MCPManagerPanelProps {
  servers: MCPServerInfo[];
  onClose: () => void;
  onAddServer: (config: MCPServerConfig) => void;
  onUpdateServer: (config: MCPServerConfig) => void;
  onRemoveServer: (serverId: string) => void;
  onToggleServer: (serverId: string, enabled: boolean) => void;
  onRefreshServer: (serverId: string) => void;
  className?: string;
}

export function MCPManagerPanel({
  servers,
  onClose,
  onAddServer,
  onUpdateServer,
  onRemoveServer,
  onToggleServer,
  onRefreshServer,
  className,
}: MCPManagerPanelProps) {
  const [view, setView] = useState<PanelView>("list");
  const [editingServer, setEditingServer] = useState<MCPServerInfo | null>(null);

  const handleAddNew = useCallback(() => {
    setEditingServer(null);
    setView("editor");
  }, []);

  const handleEdit = useCallback((server: MCPServerInfo) => {
    setEditingServer(server);
    setView("editor");
  }, []);

  const handleEditorSave = useCallback(
    (config: MCPServerConfig) => {
      if (editingServer) {
        onUpdateServer(config);
      } else {
        onAddServer(config);
      }
      setView("list");
      setEditingServer(null);
    },
    [editingServer, onAddServer, onUpdateServer]
  );

  const handleEditorCancel = useCallback(() => {
    setView("list");
    setEditingServer(null);
  }, []);

  const connectedCount = servers.filter((s) => s.status === "connected").length;
  const enabledCount = servers.filter((s) => s.config.enabled).length;

  return (
    <div className={cn("flex flex-col h-full bg-[var(--cr-bg-root)]", className)}>
      <AnimatePresence mode="wait">
        {view === "list" ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.12 }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--cr-border)] bg-[var(--cr-bg-primary)] shrink-0">
              <button
                onClick={onClose}
                className="size-6 flex items-center justify-center rounded-md text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-hover)] transition-colors"
              >
                <ArrowLeftIcon className="size-3.5" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-[12px] font-semibold text-[var(--cr-text-primary)]">
                  MCP Servers
                </h2>
              </div>
              <button
                onClick={handleAddNew}
                className="cr-btn cr-btn-indigo"
                style={{ padding: "4px 10px", fontSize: "10px" }}
              >
                <PlusIcon className="size-3" />
                Add
              </button>
            </div>

            {/* Status bar */}
            <div className="px-4 py-2 border-b border-[var(--cr-border-subtle)] bg-[var(--cr-bg-secondary)]">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <ServerIcon className="size-3 text-[var(--cr-text-muted)]" />
                  <span className="text-[10px] text-[var(--cr-text-muted)]">
                    {servers.length} server{servers.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {enabledCount > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="size-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] text-emerald-400">
                      {connectedCount}/{enabledCount} connected
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Server List */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable both-edges" }}>
              {servers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-8 text-center">
                  <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 border border-indigo-500/10 flex items-center justify-center mb-3">
                    <ServerIcon className="size-5 text-indigo-400" />
                  </div>
                  <p className="text-[12px] text-[var(--cr-text-secondary)] font-medium mb-1">
                    No MCP Servers
                  </p>
                  <p className="text-[10px] text-[var(--cr-text-muted)] leading-relaxed mb-3">
                    Add external MCP servers to extend ChainReview with additional tools and capabilities.
                  </p>
                  <button
                    onClick={handleAddNew}
                    className="cr-btn cr-btn-indigo"
                  >
                    <PlusIcon className="size-3" />
                    Add MCP Server
                  </button>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {/* Built-in CRP Server (always shown, not editable) */}
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] font-medium text-[var(--cr-text-primary)]">
                          ChainReview CRP Server
                        </span>
                        <span className="ml-1.5 text-[9px] font-medium text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full leading-none">
                          built-in
                        </span>
                      </div>
                      <span className="text-[9px] text-emerald-400 font-medium">
                        Connected
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--cr-text-muted)] mt-1 ml-3.5">
                      Core review, chat, search, and patch tools
                    </p>
                  </div>

                  {/* User-added servers */}
                  <AnimatePresence>
                    {servers.map((server) => (
                      <MCPServerCard
                        key={server.id}
                        server={server}
                        onToggle={onToggleServer}
                        onRefresh={onRefreshServer}
                        onRemove={onRemoveServer}
                        onEdit={handleEdit}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer info */}
            <div className="px-3 py-2 border-t border-[var(--cr-border-subtle)] shrink-0">
              <p className="text-[9px] text-[var(--cr-text-muted)] leading-relaxed">
                MCP servers provide additional tools for code review agents. Configure servers that expose tools via the Model Context Protocol.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="editor"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.12 }}
            className="flex flex-col h-full"
          >
            <MCPEditor
              initialConfig={editingServer?.config || null}
              onSave={handleEditorSave}
              onCancel={handleEditorCancel}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
