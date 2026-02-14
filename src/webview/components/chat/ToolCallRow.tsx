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
import { cn } from "@/lib/utils";
import { ExtBadge } from "@/components/shared/FileReference";
import { useOpenFile } from "@/contexts/OpenFileContext";
import type { ToolCallBlock, ToolIcon } from "@/lib/types";

interface ToolCallRowProps {
  block: ToolCallBlock;
}

const ICON_MAP: Record<ToolIcon, React.FC<{ className?: string }>> = {
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

  return (
    <div className="my-px">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-[5px] rounded-md text-left transition-all duration-100 group",
          "hover:bg-[var(--cr-bg-hover)]",
          isRunning && "bg-[var(--cr-accent-subtle)]",
          isError && "bg-[var(--cr-error-muted)]"
        )}
      >
        {/* Status dot */}
        {isRunning && (
          <LoaderCircleIcon className="size-3 text-[var(--cr-accent)] animate-spin shrink-0" />
        )}
        {isDone && (
          <div className="size-3 shrink-0 flex items-center justify-center">
            <div className="size-1.5 rounded-full bg-emerald-500/60" />
          </div>
        )}
        {isError && (
          <CircleXIcon className="size-3 text-red-400/70 shrink-0" />
        )}

        {/* Tool icon */}
        {isFileTool && (filePath || argsSummaryIsPath) ? (
          <ExtBadge filePath={filePath || block.argsSummary} />
        ) : (
          <IconComponent className="size-3 text-[var(--cr-text-tertiary)] shrink-0" />
        )}

        <span className="text-[11px] font-medium text-[var(--cr-text-secondary)] truncate">
          {block.displayName}
        </span>

        {block.argsSummary && (
          <span
            className={cn(
              "text-[10px] truncate flex-1 min-w-0",
              isFileTool && (filePath || argsSummaryIsPath)
                ? "text-indigo-400/80 hover:text-indigo-300 cursor-pointer font-mono"
                : "text-[var(--cr-text-tertiary)]"
            )}
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
          className={cn(
            "size-2.5 text-[var(--cr-text-ghost)] transition-transform shrink-0 opacity-0 group-hover:opacity-100",
            expanded && "rotate-90"
          )}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 py-1.5 ml-5 mt-0.5 text-[10px] font-mono rounded-md bg-[var(--cr-bg-secondary)] border border-[var(--cr-border-subtle)]">
              {Object.keys(block.args).length > 0 && (
                <div className="mb-1">
                  <span className="text-[var(--cr-text-tertiary)]">args:</span>
                  <pre className="text-[var(--cr-text-secondary)] whitespace-pre-wrap mt-0.5">
                    {JSON.stringify(block.args, null, 2)}
                  </pre>
                </div>
              )}
              {block.result && (
                <div>
                  <span className="text-[var(--cr-text-tertiary)]">result:</span>
                  <pre className="text-[var(--cr-text-secondary)] whitespace-pre-wrap mt-0.5 max-h-24 overflow-y-auto">
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
