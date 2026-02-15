import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  SearchIcon,
  FileIcon,
  FolderTreeIcon,
  GitCompareArrowsIcon,
  ShieldIcon,
  NetworkIcon,
  TerminalIcon,
  CheckIcon,
  CircleXIcon,
  BrainIcon,
  ScanSearchIcon,
  BugIcon,
  GlobeIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { ExtBadge } from "@/components/shared/FileReference";
import { useOpenFile } from "@/contexts/OpenFileContext";
import type { ToolCallBlock, ToolIcon } from "@/lib/types";

interface ToolCallRowProps {
  block: ToolCallBlock;
}

const ICON_MAP: Record<ToolIcon, React.FC<{ style?: React.CSSProperties }>> = {
  search: SearchIcon,
  file: FileIcon,
  tree: FolderTreeIcon,
  "git-diff": GitCompareArrowsIcon,
  shield: ShieldIcon,
  graph: NetworkIcon,
  terminal: TerminalIcon,
  check: CheckIcon,
  brain: BrainIcon,
  scan: ScanSearchIcon,
  bug: BugIcon,
  web: GlobeIcon,
};

// Both dot-names (MCP tools) and underscore-names (agent tools) for file reading
const FILE_TOOLS = new Set([
  "crp.repo.file", "crp.repo.read_file", "read_file",
  "crp_repo_file", "crp_repo_read_file",
]);

function getFilePathFromArgs(args: Record<string, unknown>): string | null {
  if (typeof args.path === "string") return args.path;
  if (typeof args.filePath === "string") return args.filePath;
  if (typeof args.file === "string") return args.file;
  return null;
}

export function ToolCallRow({ block }: ToolCallRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const openFile = useOpenFile();
  const IconComponent = ICON_MAP[block.icon] || TerminalIcon;

  const isRunning = block.status === "running";
  const isDone = block.status === "done";
  const isError = block.status === "error";

  const isFileTool = FILE_TOOLS.has(block.tool) || block.icon === "file";
  const filePath = isFileTool ? getFilePathFromArgs(block.args) : null;
  const argsSummaryIsPath = block.argsSummary && (
    block.argsSummary.includes("/") || block.argsSummary.includes(".")
  ) && !block.argsSummary.includes(" ");

  const bgColor = isRunning
    ? "var(--cr-accent-subtle)"
    : isError
      ? "var(--cr-error-muted)"
      : hovered
        ? "var(--cr-bg-hover)"
        : "transparent";

  return (
    <div style={{ margin: "1px 0" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 8px",
          borderRadius: 6,
          textAlign: "left",
          transition: "all 100ms ease",
          background: bgColor,
          border: "none",
          cursor: "pointer",
        }}
      >
        {/* Status dot */}
        {isRunning && (
          <LoaderCircleIcon style={{
            width: 12, height: 12, color: "var(--cr-accent)",
            flexShrink: 0, animation: "spin 1s linear infinite",
          }} />
        )}
        {isDone && (
          <div style={{
            width: 12, height: 12, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: 9999,
              background: "rgba(16,185,129,0.60)",
            }} />
          </div>
        )}
        {isError && (
          <CircleXIcon style={{ width: 12, height: 12, color: "rgba(248,113,113,0.70)", flexShrink: 0 }} />
        )}

        {/* Tool icon */}
        {isFileTool && (filePath || argsSummaryIsPath) ? (
          <ExtBadge filePath={filePath || block.argsSummary} />
        ) : (
          <IconComponent style={{ width: 12, height: 12, color: "var(--cr-text-muted)", flexShrink: 0 }} />
        )}

        <span style={{
          fontSize: 11, fontWeight: 500, color: "var(--cr-text-secondary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {block.displayName}
        </span>

        {block.argsSummary && (
          <span
            style={{
              fontSize: 10,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
              ...(isFileTool && (filePath || argsSummaryIsPath)
                ? { color: "rgba(129,140,248,0.80)", cursor: "pointer", fontFamily: "var(--cr-font-mono)" }
                : { color: "var(--cr-text-muted)" }),
            }}
            onClick={(e) => {
              if (isFileTool && (filePath || argsSummaryIsPath)) {
                e.stopPropagation();
                openFile(filePath || block.argsSummary);
              }
            }}
            title={filePath || block.argsSummary}
          >
            {block.argsSummary}
          </span>
        )}

        <ChevronRightIcon
          style={{
            width: 10, height: 10,
            color: "var(--cr-text-ghost)",
            transition: "transform 150ms ease",
            flexShrink: 0,
            opacity: hovered ? 1 : 0,
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              padding: "6px 10px",
              marginLeft: 20,
              marginTop: 2,
              fontSize: 10,
              fontFamily: "var(--cr-font-mono)",
              borderRadius: 6,
              background: "var(--cr-bg-secondary)",
              border: "1px solid var(--cr-border-subtle)",
            }}>
              {Object.keys(block.args).length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: "var(--cr-text-muted)" }}>args:</span>
                  <pre style={{
                    color: "var(--cr-text-tertiary)",
                    whiteSpace: "pre-wrap",
                    marginTop: 2, margin: 0,
                  }}>
                    {JSON.stringify(block.args, null, 2)}
                  </pre>
                </div>
              )}
              {block.result && (
                <div>
                  <span style={{ color: "var(--cr-text-muted)" }}>result:</span>
                  <pre style={{
                    color: "var(--cr-text-tertiary)",
                    whiteSpace: "pre-wrap",
                    marginTop: 2, margin: 0,
                    maxHeight: 96,
                    overflowY: "auto",
                  }}>
                    {block.result.length > 400
                      ? block.result.slice(0, 400) + "..."
                      : block.result}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
