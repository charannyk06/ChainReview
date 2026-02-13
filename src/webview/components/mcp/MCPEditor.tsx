import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { XIcon, PlusIcon, TrashIcon, SaveIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MCPServerConfig } from "@/lib/types";

interface MCPEditorProps {
  /** Pass existing config for editing, null for new server */
  initialConfig: MCPServerConfig | null;
  onSave: (config: MCPServerConfig) => void;
  onCancel: () => void;
}

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

  // Sync form → JSON when switching to JSON mode
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
      } catch (err) {
        setJsonError("Invalid JSON");
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

  const canSave = jsonMode ? jsonText.trim().length > 0 : name.trim().length > 0 && command.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--cr-border)] shrink-0">
        <h2 className="text-[12px] font-semibold text-[var(--cr-text-primary)]">
          {isEditing ? "Edit Server" : "Add MCP Server"}
        </h2>
        <button
          onClick={onCancel}
          className="size-6 flex items-center justify-center rounded-md text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-hover)] transition-colors"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="px-4 pt-3">
        <div className="flex gap-1 bg-[var(--cr-bg-root)] rounded-lg p-0.5">
          <button
            onClick={() => setJsonMode(false)}
            className={cn(
              "flex-1 text-[10px] font-medium py-1 rounded-md transition-colors",
              !jsonMode
                ? "bg-[var(--cr-bg-secondary)] text-[var(--cr-text-primary)] shadow-sm"
                : "text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)]"
            )}
          >
            Form
          </button>
          <button
            onClick={() => setJsonMode(true)}
            className={cn(
              "flex-1 text-[10px] font-medium py-1 rounded-md transition-colors",
              jsonMode
                ? "bg-[var(--cr-bg-secondary)] text-[var(--cr-text-primary)] shadow-sm"
                : "text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)]"
            )}
          >
            JSON
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <AnimatePresence mode="wait">
          {jsonMode ? (
            <motion.div
              key="json"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setJsonError(null);
                }}
                placeholder='{\n  "name": "My Server",\n  "command": "node",\n  "args": ["server.js"],\n  "env": {}\n}'
                className={cn(
                  "w-full h-48 bg-[var(--cr-bg-root)] border rounded-lg px-3 py-2 text-[11px] font-mono text-[var(--cr-text-secondary)] resize-none focus:outline-none focus:ring-1",
                  jsonError
                    ? "border-red-500/50 focus:ring-red-500/30"
                    : "border-[var(--cr-border-subtle)] focus:ring-indigo-500/30 focus:border-indigo-500/30"
                )}
                spellCheck={false}
              />
              {jsonError && (
                <p className="text-[10px] text-red-400 mt-1">{jsonError}</p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="space-y-3"
            >
              {/* Name */}
              <div>
                <label className="text-[10px] text-[var(--cr-text-muted)] font-medium uppercase tracking-wider">
                  Server Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My MCP Server"
                  className="mt-1 w-full bg-[var(--cr-bg-root)] border border-[var(--cr-border-subtle)] rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--cr-text-primary)] placeholder:text-[var(--cr-text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/30"
                />
              </div>

              {/* Command */}
              <div>
                <label className="text-[10px] text-[var(--cr-text-muted)] font-medium uppercase tracking-wider">
                  Command *
                </label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="node, npx, python, etc."
                  className="mt-1 w-full bg-[var(--cr-bg-root)] border border-[var(--cr-border-subtle)] rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--cr-text-primary)] placeholder:text-[var(--cr-text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/30 font-mono"
                />
              </div>

              {/* Arguments */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-[var(--cr-text-muted)] font-medium uppercase tracking-wider">
                    Arguments
                  </label>
                  <button
                    onClick={addArg}
                    className="flex items-center gap-0.5 text-[9px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <PlusIcon className="size-2.5" />
                    Add
                  </button>
                </div>
                <div className="mt-1 space-y-1">
                  {args.map((arg, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={arg}
                        onChange={(e) => updateArg(idx, e.target.value)}
                        placeholder={`arg ${idx + 1}`}
                        className="flex-1 bg-[var(--cr-bg-root)] border border-[var(--cr-border-subtle)] rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--cr-text-primary)] placeholder:text-[var(--cr-text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/30 font-mono"
                      />
                      {args.length > 1 && (
                        <button
                          onClick={() => removeArg(idx)}
                          className="size-6 flex items-center justify-center rounded-md text-[var(--cr-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <TrashIcon className="size-2.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Environment Variables */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-[var(--cr-text-muted)] font-medium uppercase tracking-wider">
                    Environment Variables
                  </label>
                  <button
                    onClick={addEnvPair}
                    className="flex items-center gap-0.5 text-[9px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <PlusIcon className="size-2.5" />
                    Add
                  </button>
                </div>
                <div className="mt-1 space-y-1">
                  {envPairs.map((pair, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={pair.key}
                        onChange={(e) => updateEnvPair(idx, "key", e.target.value)}
                        placeholder="KEY"
                        className="w-[35%] bg-[var(--cr-bg-root)] border border-[var(--cr-border-subtle)] rounded-lg px-2.5 py-1.5 text-[11px] text-indigo-400 placeholder:text-[var(--cr-text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/30 font-mono"
                      />
                      <span className="text-[10px] text-[var(--cr-text-muted)]">=</span>
                      <input
                        type="text"
                        value={pair.value}
                        onChange={(e) => updateEnvPair(idx, "value", e.target.value)}
                        placeholder="value"
                        className="flex-1 bg-[var(--cr-bg-root)] border border-[var(--cr-border-subtle)] rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--cr-text-primary)] placeholder:text-[var(--cr-text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/30 font-mono"
                      />
                      {envPairs.length > 1 && (
                        <button
                          onClick={() => removeEnvPair(idx)}
                          className="size-6 flex items-center justify-center rounded-md text-[var(--cr-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <TrashIcon className="size-2.5" />
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

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-[var(--cr-border)] shrink-0">
        <button
          onClick={onCancel}
          className="cr-btn cr-btn-secondary"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="cr-btn cr-btn-indigo"
        >
          <SaveIcon className="size-3" />
          {isEditing ? "Update" : "Add Server"}
        </button>
      </div>
    </motion.div>
  );
}
