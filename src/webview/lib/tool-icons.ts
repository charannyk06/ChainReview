import type { ToolIcon } from "./types";

// ── Tool Display Names ──

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  "crp_repo_file": "Read File",
  "crp_repo_tree": "File Tree",
  "crp_repo_search": "Search Code",
  "crp_repo_diff": "Git Diff",
  "crp_repo_open": "Open Repository",
  "crp_code_import_graph": "Import Graph",
  "crp_code_pattern_scan": "Pattern Scan",
  "crp_patch_propose": "Propose Patch",
  "crp_patch_validate": "Validate Patch",
  "crp_patch_apply": "Apply Patch",
  "crp_review_record_event": "Record Event",
  "crp_exec_command": "Run Command",
  "crp_web_search": "Web Search",
  "crp_patch_generate": "Generate Fix",
  "crp_review_validate_finding": "Validate Finding",
};

// ── Tool Icon Map ──

export const TOOL_ICON_MAP: Record<string, ToolIcon> = {
  "crp_repo_file": "file",
  "crp_repo_tree": "tree",
  "crp_repo_search": "search",
  "crp_repo_diff": "git-diff",
  "crp_repo_open": "terminal",
  "crp_code_import_graph": "graph",
  "crp_code_pattern_scan": "scan",
  "crp_patch_propose": "brain",
  "crp_patch_validate": "check",
  "crp_patch_apply": "check",
  "crp_review_record_event": "terminal",
  "crp_exec_command": "terminal",
  "crp_web_search": "web",
  "crp_patch_generate": "brain",
  "crp_review_validate_finding": "shield",
};

// ── Arg Summarizer ──

export function summarizeToolArgs(tool: string, args: Record<string, unknown>): string {
  switch (tool) {
    case "crp_repo_file": {
      const filePath = args.path as string || "";
      const start = args.startLine as number | undefined;
      const end = args.endLine as number | undefined;
      if (start && end) {
        return `${filePath} (L${start}-${end})`;
      }
      return filePath;
    }
    case "crp_repo_tree": {
      const depth = args.maxDepth as number | undefined;
      const pattern = args.pattern as string | undefined;
      if (pattern) return `pattern: ${pattern}`;
      if (depth) return `depth: ${depth}`;
      return "full tree";
    }
    case "crp_repo_search": {
      const pat = args.pattern as string || "";
      const glob = args.glob as string | undefined;
      return glob ? `"${pat}" in ${glob}` : `"${pat}"`;
    }
    case "crp_repo_diff": {
      const ref1 = args.ref1 as string | undefined;
      const ref2 = args.ref2 as string | undefined;
      if (ref1 && ref2) return `${ref1}..${ref2}`;
      if (args.staged) return "staged changes";
      return "working tree";
    }
    case "crp_code_import_graph": {
      const subPath = args.path as string | undefined;
      return subPath || "entire repo";
    }
    case "crp_code_pattern_scan": {
      const config = args.config as string | undefined;
      return config || "auto";
    }
    default:
      return Object.keys(args).length > 0
        ? Object.entries(args).map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`).join(", ")
        : "";
  }
}

export function getToolDisplayName(tool: string): string {
  return TOOL_DISPLAY_NAMES[tool] || tool.split("_").pop() || tool;
}

export function getToolIcon(tool: string): ToolIcon {
  return TOOL_ICON_MAP[tool] || "terminal";
}
