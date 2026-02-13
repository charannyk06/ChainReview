import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import simpleGit from "simple-git";
import { redactSecrets } from "./redact";
import { setExecRepoPath } from "./exec";

const execFileAsync = promisify(execFile);

let activeRepoPath: string | null = null;

export function getActiveRepoPath(): string {
  if (!activeRepoPath) {
    throw new Error("No repository is open. Call crp.repo.open first.");
  }
  return activeRepoPath;
}

// ── crp.repo.open ──

export async function repoOpen(args: {
  repoPath: string;
}): Promise<{ path: string; name: string; branch: string }> {
  const repoPath = path.resolve(args.repoPath);

  if (!fs.existsSync(repoPath)) {
    throw new Error(`Path does not exist: ${repoPath}`);
  }

  const gitDir = path.join(repoPath, ".git");
  if (!fs.existsSync(gitDir)) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }

  const git = simpleGit(repoPath);
  const status = await git.status();

  activeRepoPath = repoPath;
  setExecRepoPath(repoPath);

  return {
    path: repoPath,
    name: path.basename(repoPath),
    branch: status.current || "unknown",
  };
}

// ── crp.repo.tree ──

export async function repoTree(args: {
  maxDepth?: number;
  pattern?: string;
}): Promise<{ files: string[]; totalFiles: number }> {
  const repoPath = getActiveRepoPath();
  const maxDepth = args.maxDepth ?? 10;

  const files: string[] = [];

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      // Skip hidden dirs, node_modules, dist
      if (
        entry.name.startsWith(".") ||
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "build" ||
        entry.name === "coverage"
      ) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(repoPath, fullPath);

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else {
        if (args.pattern) {
          if (relativePath.includes(args.pattern) || entry.name.includes(args.pattern)) {
            files.push(relativePath);
          }
        } else {
          files.push(relativePath);
        }
      }
    }
  }

  walk(repoPath, 0);

  return { files, totalFiles: files.length };
}

// ── crp.repo.file ──

export async function repoFile(args: {
  path: string;
  startLine?: number;
  endLine?: number;
}): Promise<{ content: string; lineCount: number; filePath: string }> {
  const repoPath = getActiveRepoPath();
  const filePath = path.resolve(repoPath, args.path);

  if (!filePath.startsWith(repoPath)) {
    throw new Error("Path traversal detected");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${args.path}`);
  }

  const rawContent = fs.readFileSync(filePath, "utf-8");
  const lines = rawContent.split("\n");

  if (args.startLine !== undefined || args.endLine !== undefined) {
    const start = Math.max(0, (args.startLine ?? 1) - 1);
    const end = Math.min(lines.length, args.endLine ?? lines.length);
    const sliced = lines.slice(start, end);
    return {
      content: redactSecrets(sliced.join("\n")),
      lineCount: lines.length,
      filePath: args.path,
    };
  }

  return {
    content: redactSecrets(rawContent),
    lineCount: lines.length,
    filePath: args.path,
  };
}

// ── crp.repo.search ──

export async function repoSearch(args: {
  pattern: string;
  glob?: string;
  maxResults?: number;
}): Promise<{
  matches: { file: string; line: number; text: string }[];
  totalMatches: number;
}> {
  const repoPath = getActiveRepoPath();
  const maxResults = args.maxResults ?? 50;

  const rgArgs = [
    "--json",
    "--max-count",
    String(maxResults),
    "--no-heading",
  ];

  if (args.glob) {
    rgArgs.push("--glob", args.glob);
  }

  rgArgs.push(args.pattern, repoPath);

  try {
    const { stdout } = await execFileAsync("rg", rgArgs, {
      maxBuffer: 10 * 1024 * 1024,
    });

    const matches: { file: string; line: number; text: string }[] = [];

    for (const line of stdout.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "match") {
          matches.push({
            file: path.relative(repoPath, parsed.data.path.text),
            line: parsed.data.line_number,
            text: redactSecrets(parsed.data.lines.text.trim()),
          });
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    return { matches, totalMatches: matches.length };
  } catch (err: any) {
    // rg returns exit code 1 when no matches found
    if (err.code === 1) {
      return { matches: [], totalMatches: 0 };
    }
    // If rg is not installed, fall back to basic grep
    if (err.code === "ENOENT") {
      return { matches: [], totalMatches: 0 };
    }
    throw err;
  }
}

// ── crp.repo.diff ──

export async function repoDiff(args: {
  ref1?: string;
  ref2?: string;
  staged?: boolean;
}): Promise<{ diff: string; filesChanged: number }> {
  const repoPath = getActiveRepoPath();
  const git = simpleGit(repoPath);

  let diff: string;

  if (args.ref1 && args.ref2) {
    diff = await git.diff([args.ref1, args.ref2]);
  } else if (args.staged) {
    diff = await git.diff(["--cached"]);
  } else if (args.ref1) {
    diff = await git.diff([args.ref1]);
  } else {
    // Default: unstaged changes
    diff = await git.diff();
    // If no unstaged, try staged
    if (!diff.trim()) {
      diff = await git.diff(["--cached"]);
    }
    // If still nothing, diff against HEAD~1
    if (!diff.trim()) {
      try {
        diff = await git.diff(["HEAD~1", "HEAD"]);
      } catch {
        diff = "";
      }
    }
  }

  const filesChanged = (diff.match(/^diff --git/gm) || []).length;

  return { diff, filesChanged };
}
