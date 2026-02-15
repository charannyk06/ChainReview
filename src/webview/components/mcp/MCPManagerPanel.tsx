import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeftIcon,
  PlusIcon,
  SparklesIcon,
  PlugIcon,
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

  return (
    <div className={cn("flex flex-col h-full bg-[var(--cr-bg-root)]", className)}>
      <AnimatePresence mode="wait">
        {view === "list" ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <div style={{ padding: "12px 16px" }} className="relative border-b border-[var(--cr-border)] bg-gradient-to-b from-[var(--cr-bg-secondary)] to-[var(--cr-bg-primary)] shrink-0">
              {/* Background decoration */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(99,102,241,0.05),transparent_50%)]" />
              
              <div className="relative flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05, x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="size-8 flex items-center justify-center rounded-lg text-[var(--cr-text-muted)] hover:text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-hover)] transition-colors"
                >
                  <ArrowLeftIcon className="size-4" />
                </motion.button>
                
                <div className="flex-1 min-w-0">
                  <h2 className="text-[14px] font-semibold text-[var(--cr-text-primary)] flex items-center gap-2">
                    <PlugIcon className="size-4 text-indigo-400" />
                    MCP Servers
                  </h2>
                  <p className="text-[10px] text-[var(--cr-text-muted)] mt-0.5">
                    Extend ChainReview with external tools
                  </p>
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddNew}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white text-[11px] font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all duration-200"
                >
                  <PlusIcon className="size-3.5" />
                  Add Server
                </motion.button>
              </div>
            </div>

            {/* Server List */}
            <div className="flex-1 overflow-y-auto cr-scrollbar">
              <div style={{ padding: 16 }} className="space-y-2">
                {/* Built-in CRP Server (premium card) */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="relative rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-[var(--cr-bg-secondary)] to-emerald-500/5 overflow-hidden"
                >
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(52,211,153,0.1),transparent_50%)]" />
                  
                  <div className="relative p-4">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="relative">
                        <div className="size-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                          <SparklesIcon className="size-5 text-white" />
                        </div>
                        <span className="absolute -bottom-1 -right-1 size-4 rounded-full bg-emerald-400 border-2 border-[var(--cr-bg-secondary)] flex items-center justify-center">
                          <span className="size-1.5 rounded-full bg-white" />
                        </span>
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[13px] font-semibold text-[var(--cr-text-primary)]">
                            ChainReview CRP Server
                          </h3>
                          <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Built-in
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--cr-text-muted)] mt-1">
                          Core review, chat, search, and patch tools
                        </p>
                        
                        {/* Tool badges */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {["repo", "code", "patch", "review", "chat"].map((tool) => (
                            <span
                              key={tool}
                              className="text-[9px] font-medium text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-md"
                            >
                              crp.{tool}
                            </span>
                          ))}
                          <span className="text-[9px] font-medium text-[var(--cr-text-muted)] bg-[var(--cr-bg-tertiary)] px-2 py-0.5 rounded-md">
                            +15 more
                          </span>
                        </div>
                      </div>
                      
                      {/* Status */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-full">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-medium text-emerald-400">
                          Connected
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Empty state for user servers */}
                {servers.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="relative mt-4 rounded-xl border border-dashed border-[var(--cr-border)] bg-[var(--cr-bg-secondary)]/30 p-6"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="size-12 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/10 flex items-center justify-center mb-3">
                        <PlugIcon className="size-6 text-indigo-400/60" />
                      </div>
                      <p className="text-[12px] font-medium text-[var(--cr-text-secondary)] mb-1">
                        No External Servers
                      </p>
                      <p className="text-[11px] text-[var(--cr-text-muted)] leading-relaxed max-w-[220px] mb-4">
                        Add MCP servers to extend ChainReview with additional tools and capabilities
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleAddNew}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 hover:from-indigo-500/20 hover:to-violet-500/20 border border-indigo-500/20 text-indigo-400 text-[11px] font-medium rounded-lg transition-all duration-200"
                      >
                        <PlusIcon className="size-3.5" />
                        Add MCP Server
                      </motion.button>
                    </div>
                  </motion.div>
                ) : (
                  /* User-added servers */
                  <AnimatePresence>
                    {servers.map((server, idx) => (
                      <motion.div
                        key={server.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * (idx + 1) }}
                      >
                        <MCPServerCard
                          server={server}
                          onToggle={onToggleServer}
                          onRefresh={onRefreshServer}
                          onRemove={onRemoveServer}
                          onEdit={handleEdit}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 16px" }} className="border-t border-[var(--cr-border-subtle)] bg-[var(--cr-bg-secondary)]/30 shrink-0">
              <p className="text-[10px] text-[var(--cr-text-muted)] leading-relaxed">
                <span className="text-indigo-400 font-medium">MCP</span> servers provide additional tools for code review agents via the Model Context Protocol.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="editor"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
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
