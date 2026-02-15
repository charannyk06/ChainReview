import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeftIcon,
  PlusIcon,
  SparklesIcon,
  PlugIcon,
  ServerIcon,
  WrenchIcon,
  GlobeIcon,
  ShieldCheckIcon,
} from "lucide-react";
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

const CRP_TOOLS = [
  { name: "repo", icon: "📁" },
  { name: "code", icon: "🔍" },
  { name: "patch", icon: "🩹" },
  { name: "review", icon: "📝" },
  { name: "chat", icon: "💬" },
];

export function MCPManagerPanel({
  servers,
  onClose,
  onAddServer,
  onUpdateServer,
  onRemoveServer,
  onToggleServer,
  onRefreshServer,
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0f0f0f" }}>
      <AnimatePresence mode="wait">
        {view === "list" ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ display: "flex", flexDirection: "column", height: "100%" }}
          >
            {/* ── Header ── */}
            <div style={{
              padding: "14px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "linear-gradient(180deg, #1a1a1a 0%, #161616 100%)",
              flexShrink: 0,
              position: "relative",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  onClick={onClose}
                  style={{
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "#525252",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#e5e5e5";
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#525252";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <ArrowLeftIcon style={{ width: 16, height: 16 }} />
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ServerIcon style={{ width: 16, height: 16, color: "#818cf8" }} />
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: "#e5e5e5", margin: 0, lineHeight: 1 }}>
                      MCP Servers
                    </h2>
                  </div>
                  <p style={{ fontSize: 10, color: "#525252", marginTop: 4, fontWeight: 500 }}>
                    Extend ChainReview with external tools & capabilities
                  </p>
                </div>

                <button
                  onClick={handleAddNew}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: "1px solid rgba(99,102,241,0.3)",
                    background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.10) 100%)",
                    color: "#a5b4fc",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 200ms ease",
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.18) 100%)";
                    e.currentTarget.style.borderColor = "rgba(99,102,241,0.45)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.10) 100%)";
                    e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)";
                  }}
                >
                  <PlusIcon style={{ width: 14, height: 14 }} />
                  Add Server
                </button>
              </div>
            </div>

            {/* ── Server List ── */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }} className="cr-scrollbar">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* ── Built-in CRP Server Card — Premium ── */}
                <div style={{
                  borderRadius: 14,
                  border: "1px solid rgba(52,211,153,0.18)",
                  background: "linear-gradient(135deg, rgba(52,211,153,0.05) 0%, #1c1c1c 50%, rgba(52,211,153,0.03) 100%)",
                  overflow: "hidden",
                  position: "relative",
                }}>
                  {/* Subtle top glow */}
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 1,
                    background: "linear-gradient(90deg, transparent 0%, rgba(52,211,153,0.3) 50%, transparent 100%)",
                  }} />

                  <div style={{ padding: 16, position: "relative" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      {/* Icon */}
                      <div style={{ position: "relative" }}>
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 4px 12px rgba(52,211,153,0.20)",
                        }}>
                          <SparklesIcon style={{ width: 22, height: 22, color: "white" }} />
                        </div>
                        {/* Connected dot */}
                        <span style={{
                          position: "absolute",
                          bottom: -2,
                          right: -2,
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: "#34d399",
                          border: "2.5px solid #1c1c1c",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "white" }} />
                        </span>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#e5e5e5", margin: 0, lineHeight: 1 }}>
                            ChainReview CRP Server
                          </h3>
                          <span style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#34d399",
                            background: "rgba(52,211,153,0.12)",
                            padding: "2px 8px",
                            borderRadius: 9999,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            lineHeight: 1.3,
                          }}>
                            Built-in
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: "#737373", marginTop: 4 }}>
                          Core review, search, patch, and analysis tools
                        </p>

                        {/* Tool badges */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10 }}>
                          {CRP_TOOLS.map((tool) => (
                            <span
                              key={tool.name}
                              style={{
                                fontSize: 9,
                                fontWeight: 600,
                                color: "rgba(52,211,153,0.8)",
                                background: "rgba(52,211,153,0.08)",
                                border: "1px solid rgba(52,211,153,0.10)",
                                padding: "3px 8px",
                                borderRadius: 6,
                                lineHeight: 1,
                              }}
                            >
                              crp.{tool.name}
                            </span>
                          ))}
                          <span style={{
                            fontSize: 9,
                            fontWeight: 600,
                            color: "#525252",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            padding: "3px 8px",
                            borderRadius: 6,
                            lineHeight: 1,
                          }}>
                            +15 more
                          </span>
                        </div>
                      </div>

                      {/* Status pill */}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 10px",
                        borderRadius: 9999,
                        background: "rgba(52,211,153,0.08)",
                        border: "1px solid rgba(52,211,153,0.12)",
                        flexShrink: 0,
                      }}>
                        <span style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#34d399",
                          boxShadow: "0 0 6px rgba(52,211,153,0.4)",
                        }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#34d399", lineHeight: 1 }}>
                          Connected
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Section divider ── */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
                  <span style={{ fontSize: 9, fontWeight: 600, color: "#404040", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    External Servers
                  </span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
                </div>

                {/* ── User-added servers or empty state ── */}
                {servers.length === 0 ? (
                  <div style={{
                    borderRadius: 14,
                    border: "1px dashed rgba(255,255,255,0.08)",
                    background: "#161616",
                    padding: "32px 24px",
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                      {/* Icon group */}
                      <div style={{ display: "flex", alignItems: "center", gap: -8, marginBottom: 16 }}>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          background: "rgba(99,102,241,0.08)",
                          border: "1px solid rgba(99,102,241,0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                          <PlugIcon style={{ width: 18, height: 18, color: "rgba(99,102,241,0.5)" }} />
                        </div>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#a3a3a3", marginBottom: 4 }}>
                        No External Servers
                      </p>
                      <p style={{ fontSize: 11, color: "#525252", lineHeight: 1.5, maxWidth: 240, marginBottom: 16 }}>
                        Connect MCP servers to give review agents access to additional tools, databases, and APIs
                      </p>

                      {/* Feature list */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 220, marginBottom: 20 }}>
                        {[
                          { icon: WrenchIcon, text: "Custom analysis tools", color: "#818cf8" },
                          { icon: GlobeIcon, text: "External API integrations", color: "#60a5fa" },
                          { icon: ShieldCheckIcon, text: "Security scanners", color: "#34d399" },
                        ].map(({ icon: Icon, text, color }) => (
                          <div key={text} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Icon style={{ width: 12, height: 12, color, flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: "#737373", fontWeight: 500 }}>{text}</span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={handleAddNew}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "9px 18px",
                          borderRadius: 10,
                          border: "1px solid rgba(99,102,241,0.25)",
                          background: "linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(139,92,246,0.06) 100%)",
                          color: "#a5b4fc",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 200ms ease",
                          lineHeight: 1,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "linear-gradient(135deg, rgba(99,102,241,0.20) 0%, rgba(139,92,246,0.14) 100%)";
                          e.currentTarget.style.borderColor = "rgba(99,102,241,0.40)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(139,92,246,0.06) 100%)";
                          e.currentTarget.style.borderColor = "rgba(99,102,241,0.25)";
                        }}
                      >
                        <PlusIcon style={{ width: 14, height: 14 }} />
                        Add MCP Server
                      </button>
                    </div>
                  </div>
                ) : (
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

            {/* ── Footer ── */}
            <div style={{
              padding: "10px 16px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              background: "#131313",
              flexShrink: 0,
            }}>
              <p style={{ fontSize: 10, color: "#404040", lineHeight: 1.5 }}>
                <span style={{ color: "#818cf8", fontWeight: 600 }}>MCP</span>{" "}
                servers provide additional tools via the Model Context Protocol.
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
            style={{ display: "flex", flexDirection: "column", height: "100%" }}
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
