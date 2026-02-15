import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  XIcon,
  PlusIcon,
  TrashIcon,
  SaveIcon,
  ServerIcon,
  TerminalIcon,
  KeyIcon,
  FileJsonIcon,
  ListIcon,
  SparklesIcon,
} from "lucide-react";
import type { MCPServerConfig } from "@/lib/types";

interface MCPEditorProps {
  initialConfig: MCPServerConfig | null;
  onSave: (config: MCPServerConfig) => void;
  onCancel: () => void;
}

/* Shared input style */
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0f0f0f",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 12,
  color: "#e5e5e5",
  outline: "none",
  transition: "all 150ms ease",
  fontFamily: "inherit",
};

const monoInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
};

export function MCPEditor({ initialConfig, onSave, onCancel }: MCPEditorProps) {
  const isEditing = !!initialConfig;

  const [name, setName] = useState(initialConfig?.name || "");
  const [command, setCommand] = useState(initialConfig?.command || "");
  const [args, setArgs] = useState<string[]>(initialConfig?.args || [""]);
  const [envPairs, setEnvPairs] = useState<Array<{ key: string; value: string }>>(
    initialConfig?.env
      ? Object.entries(initialConfig.env).map(([key, value]) => ({ key, value }))
      : [{ key: "", value: "" }]
  );
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (jsonMode) {
      const config = buildConfig();
      setJsonText(JSON.stringify(config, null, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonMode]);

  const buildConfig = useCallback((): MCPServerConfig => {
    const env: Record<string, string> = {};
    for (const pair of envPairs) {
      if (pair.key.trim()) {
        env[pair.key.trim()] = pair.value;
      }
    }
    return {
      id: initialConfig?.id || `mcp-${Date.now()}`,
      name: name.trim(),
      command: command.trim(),
      args: args.filter((a) => a.trim() !== ""),
      env: Object.keys(env).length > 0 ? env : undefined,
      enabled: initialConfig?.enabled ?? true,
    };
  }, [name, command, args, envPairs, initialConfig]);

  const handleSave = () => {
    if (jsonMode) {
      try {
        const parsed = JSON.parse(jsonText);
        if (!parsed.name || !parsed.command) {
          setJsonError("Config must include 'name' and 'command'");
          return;
        }
        onSave({
          id: initialConfig?.id || `mcp-${Date.now()}`,
          name: parsed.name,
          command: parsed.command,
          args: parsed.args || [],
          env: parsed.env,
          enabled: parsed.enabled ?? true,
        });
      } catch {
        setJsonError("Invalid JSON syntax");
      }
    } else {
      const config = buildConfig();
      if (!config.name) return;
      if (!config.command) return;
      onSave(config);
    }
  };

  const addArg = () => setArgs([...args, ""]);
  const removeArg = (idx: number) => setArgs(args.filter((_, i) => i !== idx));
  const updateArg = (idx: number, value: string) => {
    const newArgs = [...args];
    newArgs[idx] = value;
    setArgs(newArgs);
  };

  const addEnvPair = () => setEnvPairs([...envPairs, { key: "", value: "" }]);
  const removeEnvPair = (idx: number) => setEnvPairs(envPairs.filter((_, i) => i !== idx));
  const updateEnvPair = (idx: number, field: "key" | "value", val: string) => {
    const newPairs = [...envPairs];
    newPairs[idx] = { ...newPairs[idx], [field]: val };
    setEnvPairs(newPairs);
  };

  const canSave = jsonMode
    ? jsonText.trim().length > 0
    : name.trim().length > 0 && command.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── Header ── */}
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg, #1a1a1a 0%, #161616 100%)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.10) 100%)",
              border: "1px solid rgba(99,102,241,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <ServerIcon style={{ width: 16, height: 16, color: "#818cf8" }} />
            </div>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#e5e5e5", margin: 0, lineHeight: 1 }}>
                {isEditing ? "Edit Server" : "Add MCP Server"}
              </h2>
              <p style={{ fontSize: 10, color: "#525252", marginTop: 3, fontWeight: 500 }}>
                Configure server connection
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
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
            <XIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      {/* ── Mode toggle (Form / JSON) ── */}
      <div style={{ padding: "14px 16px 8px 16px" }}>
        <div style={{
          display: "flex",
          gap: 4,
          background: "#0f0f0f",
          border: "1px solid rgba(255,255,255,0.04)",
          borderRadius: 12,
          padding: 4,
        }}>
          <button
            onClick={() => setJsonMode(false)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              padding: "8px 0",
              borderRadius: 9,
              border: !jsonMode ? "1px solid rgba(99,102,241,0.20)" : "1px solid transparent",
              background: !jsonMode
                ? "linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(139,92,246,0.06) 100%)"
                : "transparent",
              color: !jsonMode ? "#818cf8" : "#525252",
              cursor: "pointer",
              transition: "all 150ms ease",
              lineHeight: 1,
            }}
          >
            <ListIcon style={{ width: 14, height: 14 }} />
            Form
          </button>
          <button
            onClick={() => setJsonMode(true)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              padding: "8px 0",
              borderRadius: 9,
              border: jsonMode ? "1px solid rgba(99,102,241,0.20)" : "1px solid transparent",
              background: jsonMode
                ? "linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(139,92,246,0.06) 100%)"
                : "transparent",
              color: jsonMode ? "#818cf8" : "#525252",
              cursor: "pointer",
              transition: "all 150ms ease",
              lineHeight: 1,
            }}
          >
            <FileJsonIcon style={{ width: 14, height: 14 }} />
            JSON
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 16px 16px" }} className="cr-scrollbar">
        <AnimatePresence mode="wait">
          {jsonMode ? (
            <motion.div
              key="json"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setJsonError(null);
                }}
                placeholder={`{
  "name": "My Server",
  "command": "node",
  "args": ["server.js"],
  "env": {}
}`}
                style={{
                  width: "100%",
                  height: 240,
                  background: "#0f0f0f",
                  border: jsonError
                    ? "1px solid rgba(239,68,68,0.40)"
                    : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  color: "#a3a3a3",
                  resize: "none",
                  outline: "none",
                  lineHeight: 1.65,
                  transition: "border-color 150ms ease",
                }}
                spellCheck={false}
                onFocus={(e) => {
                  if (!jsonError) e.currentTarget.style.borderColor = "rgba(99,102,241,0.30)";
                }}
                onBlur={(e) => {
                  if (!jsonError) e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                }}
              />
              {jsonError && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 8,
                  fontSize: 11,
                  color: "#f87171",
                }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#f87171",
                    flexShrink: 0,
                  }} />
                  {jsonError}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              style={{ display: "flex", flexDirection: "column", gap: 18 }}
            >
              {/* Server Name */}
              <div>
                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#525252",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 6,
                }}>
                  <SparklesIcon style={{ width: 12, height: 12 }} />
                  Server Name
                  <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My MCP Server"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.30)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                />
              </div>

              {/* Command */}
              <div>
                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#525252",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 6,
                }}>
                  <TerminalIcon style={{ width: 12, height: 12 }} />
                  Command
                  <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="node, npx, python, etc."
                  style={monoInputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.30)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                />
              </div>

              {/* Arguments */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#525252",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}>
                    <ListIcon style={{ width: 12, height: 12 }} />
                    Arguments
                  </label>
                  <button
                    onClick={addArg}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#818cf8",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      transition: "color 150ms ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#a5b4fc"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#818cf8"; }}
                  >
                    <PlusIcon style={{ width: 12, height: 12 }} />
                    Add
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {args.map((arg, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "#404040", fontFamily: "monospace", width: 16, textAlign: "right", flexShrink: 0 }}>
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={arg}
                        onChange={(e) => updateArg(idx, e.target.value)}
                        placeholder={`argument ${idx + 1}`}
                        style={{ ...monoInputStyle, borderRadius: 8 }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.30)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                      />
                      {args.length > 1 && (
                        <button
                          onClick={() => removeArg(idx)}
                          style={{
                            width: 28,
                            height: 28,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 6,
                            border: "none",
                            background: "transparent",
                            color: "#525252",
                            cursor: "pointer",
                            flexShrink: 0,
                            transition: "all 150ms ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#f87171";
                            e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "#525252";
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <TrashIcon style={{ width: 12, height: 12 }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Environment Variables */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#525252",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}>
                    <KeyIcon style={{ width: 12, height: 12 }} />
                    Environment Variables
                  </label>
                  <button
                    onClick={addEnvPair}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#818cf8",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      transition: "color 150ms ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#a5b4fc"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#818cf8"; }}
                  >
                    <PlusIcon style={{ width: 12, height: 12 }} />
                    Add
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {envPairs.map((pair, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="text"
                        value={pair.key}
                        onChange={(e) => updateEnvPair(idx, "key", e.target.value)}
                        placeholder="KEY"
                        style={{
                          ...monoInputStyle,
                          width: "35%",
                          borderRadius: 8,
                          color: "#34d399",
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(52,211,153,0.30)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                      />
                      <span style={{ fontSize: 12, color: "#404040", fontFamily: "monospace" }}>=</span>
                      <input
                        type="text"
                        value={pair.value}
                        onChange={(e) => updateEnvPair(idx, "value", e.target.value)}
                        placeholder="value"
                        style={{ ...monoInputStyle, flex: 1, borderRadius: 8 }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.30)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                      />
                      {envPairs.length > 1 && (
                        <button
                          onClick={() => removeEnvPair(idx)}
                          style={{
                            width: 28,
                            height: 28,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 6,
                            border: "none",
                            background: "transparent",
                            color: "#525252",
                            cursor: "pointer",
                            flexShrink: 0,
                            transition: "all 150ms ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#f87171";
                            e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "#525252";
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <TrashIcon style={{ width: 12, height: 12 }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding: "12px 16px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "#131313",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <p style={{ fontSize: 10, color: canSave ? "#525252" : "#404040", fontWeight: 500 }}>
          {canSave ? "Ready to save" : "Fill required fields"}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              fontSize: 11,
              fontWeight: 600,
              color: "#a3a3a3",
              background: "#1c1c1c",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8,
              cursor: "pointer",
              transition: "all 150ms ease",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#e5e5e5";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
              e.currentTarget.style.background = "#222222";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#a3a3a3";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
              e.currentTarget.style.background = "#1c1c1c";
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 8,
              border: "none",
              cursor: canSave ? "pointer" : "not-allowed",
              transition: "all 150ms ease",
              lineHeight: 1,
              background: canSave
                ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
                : "#222222",
              color: canSave ? "white" : "#525252",
              boxShadow: canSave ? "0 2px 8px rgba(99,102,241,0.25)" : "none",
              opacity: canSave ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (canSave) {
                e.currentTarget.style.background = "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(99,102,241,0.35)";
              }
            }}
            onMouseLeave={(e) => {
              if (canSave) {
                e.currentTarget.style.background = "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(99,102,241,0.25)";
              }
            }}
          >
            <SaveIcon style={{ width: 14, height: 14 }} />
            {isEditing ? "Update Server" : "Add Server"}
          </button>
        </div>
      </div>
    </div>
  );
}
