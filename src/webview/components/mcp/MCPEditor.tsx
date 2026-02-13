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
import { cn } from "@/lib/utils";
import type { MCPServerConfig } from "@/lib/types";

interface MCPEditorProps {
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="relative px-4 py-3 border-b border-[var(--cr-border)] bg-gradient-to-b from-[var(--cr-bg-secondary)] to-[var(--cr-bg-primary)] shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(99,102,241,0.05),transparent_50%)]" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center">
              <ServerIcon className="size-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--cr-text-primary)]">
                {isEditing ? "Edit Server" : "Add MCP Server"}
              </h2>
              <p className="text-[10px] text-[var(--cr-text-muted)]">
                Configure server connection
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCancel}
            className="size-8 flex items-center justify-center rounded-lg text-[var(--cr-text-muted)] hover:text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-hover)] transition-colors"
          >
            <XIcon className="size-4" />
          </motion.button>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-1 bg-[var(--cr-bg-root)] border border-[var(--cr-border-subtle)] rounded-xl p-1">
          <button
            onClick={() => setJsonMode(false)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium py-2 rounded-lg transition-all duration-200",
              !jsonMode
                ? "bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm"
                : "text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)]"
            )}
          >
            <ListIcon className="size-3.5" />
            Form
          </button>
          <button
            onClick={() => setJsonMode(true)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium py-2 rounded-lg transition-all duration-200",
              jsonMode
                ? "bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm"
                : "text-[var(--cr-text-muted)] hover:text-[var(--cr-text-secondary)]"
            )}
          >
            <FileJsonIcon className="size-3.5" />
            JSON
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto cr-scrollbar px-4 py-2">
        <AnimatePresence mode="wait">
          {jsonMode ? (
            <motion.div
              key="json"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              <div className="relative">
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
                  className={cn(
                    "w-full h-56 bg-[var(--cr-bg-root)] border rounded-xl px-4 py-3 text-[12px] font-mono text-[var(--cr-text-secondary)] resize-none focus:outline-none focus:ring-2 transition-all duration-200",
                    jsonError
                      ? "border-red-500/50 focus:ring-red-500/20"
                      : "border-[var(--cr-border-subtle)] focus:ring-indigo-500/20 focus:border-indigo-500/30"
                  )}
                  spellCheck={false}
                />
                {/* Line numbers effect */}
                <div className="absolute left-4 top-3 pointer-events-none">
                  <div className="text-[10px] font-mono text-[var(--cr-text-muted)]/30 leading-[1.65]">
                    {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                      <div key={n}>{n}</div>
                    ))}
                  </div>
                </div>
              </div>
              {jsonError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-[11px] text-red-400"
                >
                  <span className="size-1.5 rounded-full bg-red-400" />
                  {jsonError}
                </motion.p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* Name */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] text-[var(--cr-text-muted)] font-medium uppercase tracking-wider">
                  <SparklesIcon className="size-3" />
                  Server Name
                  <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My MCP Server"
                  className="w-full bg-[var(--cr-bg-root)] border border-[var(--cr-border-subtle)] hover:border-[var(--cr-border)] focus:border-indigo-500/30 rounded-xl px-3 py-2.5 text-[12px] text-[var(--cr-text-primary)] placeholder:text-[var(--cr-text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                />
              </div>

              {/* Command */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] text-[var(--cr-text-muted)] font-medium uppercase tracking-wider">
                  <TerminalIcon className="size-3" />
                  Command
                  <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="node, npx, python, etc."
                  className="w-full bg-[var(--cr-bg-root)] border border-[var(--cr-border-subtle)] hover:border-[var(--cr-border)] focus:border-indigo-500/30 rounded-xl px-3 py-2.5 text-[12px] text-[var(--cr-text-primary)] placeholder:text-[var(--cr-text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 font-mono"
                />
              </div>

              {/* Arguments */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[10px] text-[var(--cr-text-muted)] font-medium uppercase tracking-wider">
                    <ListIcon className="size-3" />
                    Arguments
                  </label>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={addArg}
                    className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <PlusIcon className="size-3" />
                    Add
                  </motion.button>
                </div>
                <div className="space-y-1.5">
                  {args.map((arg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-1.5"
                    >
                      <span className="text-[10px] text-[var(--cr-text-muted)] font-mono w-4 text-right">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={arg}
                        onChange={(e) => updateArg(idx, e.target.value)}
                        placeholder={`argument ${idx + 1}`}
                        className="flex-1 bg-[var(--cr-bg-root)] border border-[var(--cr-border-subtle)] hover:border-[var(--cr-border)] focus:border-indigo-500/30 rounded-lg px-3 py-2 text-[12px] text-[var(--cr-text-primary)] placeholder:text-[var(--cr-text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 font-mono"
                      />
                      {args.length > 1 && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => removeArg(idx)}
                          className="size-7 flex items-center justify-center rounded-lg text-[var(--cr-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <TrashIcon className="size-3" />
                        </motion.button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Environment Variables */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[10px] text-[var(--cr-text-muted)] font-medium uppercase tracking-wider">
                    <KeyIcon className="size-3" />
                    Environment Variables
                  </label>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={addEnvPair}
                    className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <PlusIcon className="size-3" />
                    Add
                  </motion.button>
                </div>
                <div className="space-y-1.5">
                  {envPairs.map((pair, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={pair.key}
                        onChange={(e) => updateEnvPair(idx, "key", e.target.value)}
                        placeholder="KEY"
                        className="w-[35%] bg-[var(--cr-bg-root)] border border-[var(--cr-border-subtle)] hover:border-[var(--cr-border)] focus:border-emerald-500/30 rounded-lg px-3 py-2 text-[12px] text-emerald-400 placeholder:text-[var(--cr-text-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 font-mono"
                      />
                      <span className="text-[12px] text-[var(--cr-text-muted)] font-mono">=</span>
                      <input
                        type="text"
                        value={pair.value}
                        onChange={(e) => updateEnvPair(idx, "value", e.target.value)}
                        placeholder="value"
                        className="flex-1 bg-[var(--cr-bg-root)] border border-[var(--cr-border-subtle)] hover:border-[var(--cr-border)] focus:border-indigo-500/30 rounded-lg px-3 py-2 text-[12px] text-[var(--cr-text-primary)] placeholder:text-[var(--cr-text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 font-mono"
                      />
                      {envPairs.length > 1 && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => removeEnvPair(idx)}
                          className="size-7 flex items-center justify-center rounded-lg text-[var(--cr-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <TrashIcon className="size-3" />
                        </motion.button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--cr-border)] bg-[var(--cr-bg-secondary)]/30 shrink-0">
        <p className="text-[9px] text-[var(--cr-text-muted)]">
          {canSave ? "Ready to save" : "Fill required fields"}
        </p>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCancel}
            className="px-4 py-2 text-[11px] font-medium text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] bg-[var(--cr-bg-secondary)] hover:bg-[var(--cr-bg-hover)] border border-[var(--cr-border-subtle)] rounded-lg transition-all duration-200"
          >
            Cancel
          </motion.button>
          <motion.button
            whileHover={{ scale: canSave ? 1.02 : 1 }}
            whileTap={{ scale: canSave ? 0.98 : 1 }}
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium rounded-lg transition-all duration-200",
              canSave
                ? "bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                : "bg-[var(--cr-bg-tertiary)] text-[var(--cr-text-muted)] cursor-not-allowed"
            )}
          >
            <SaveIcon className="size-3.5" />
            {isEditing ? "Update Server" : "Add Server"}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
