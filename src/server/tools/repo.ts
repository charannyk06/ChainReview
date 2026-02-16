import * as fs from "fs";
import * as path from "path";
import { execFile, execSync } from "child_process";
import { promisify } from "util";
import simpleGit from "simple-git";
import { redactSecrets } from "./redact";
import { setExecRepoPath } from "./exec";

const execFileAsync = promisify(execFile);

/** Find the ripgrep (rg) binary, checking common paths and homebrew */
function findRgBinary(): string | null {
  const candidates = [
    "/opt/homebrew/bin/rg",
    "/usr/local/bin/rg",
    path.join(process.env.HOME || "", ".cargo/bin/rg"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  // Last resort: check PATH (may not work inside VS Code extension host)
  try {
    const result = execSync("which rg", { encoding: "utf-8", timeout: 3000 }).trim();
    if (result && fs.existsSync(result)) return result;
  } catch {
    // Not on PATH
  }

  return null;
}

let activeRepoPath: string | null = null;

export function getActiveRepoPath(): string {
  if (!activeRepoPath) {
    throw new Error("No repository is open. Call crp.repo.open first.");
  }
  return activeRepoPath;
}

/** Check if a repo is currently open */
export function hasActiveRepo(): boolean {
  return activeRepoPath !== null;
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

  // Secure path traversal check: resolved path must be strictly within repoPath.
  // We normalize both paths and use startsWith on the resolved + separator to prevent
  // bypasses like /tmp/repo2 passing when repoPath is /tmp/repo.
  const normalizedRepo = path.resolve(repoPath) + path.sep;
  const normalizedFile = path.resolve(filePath);
  if (!normalizedFile.startsWith(normalizedRepo) && normalizedFile !== path.resolve(repoPath)) {
    throw new Error("Path traversal detected: file is outside repository root");
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

  // Resolve the rg binary — it may not be on PATH inside VS Code extension host
  const rgBin = findRgBinary();

  if (rgBin) {
    return _searchWithRg(rgBin, args.pattern, repoPath, maxResults, args.glob);
  }

  // Fallback: use grep -r if rg is not installed
  return _searchWithGrep(args.pattern, repoPath, maxResults, args.glob);
}

/** Search using ripgrep (preferred — fast, JSON output) */
async function _searchWithRg(
  rgBin: string,
  pattern: string,
  repoPath: string,
  maxResults: number,
  glob?: string
): Promise<{ matches: { file: string; line: number; text: string }[]; totalMatches: number }> {
  const rgArgs = [
    "--json",
    "--max-count", String(maxResults),
    "--no-heading",
  ];

  if (glob) {
    rgArgs.push("--glob", glob);
  }

  rgArgs.push(pattern, repoPath);

  try {
    const { stdout } = await execFileAsync(rgBin, rgArgs, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
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
    if (err.code === 1 || err.status === 1) {
      return { matches: [], totalMatches: 0 };
    }
    throw err;
  }
}

/** Fallback search using grep -rn (slower but universally available) */
async function _searchWithGrep(
  pattern: string,
  repoPath: string,
  maxResults: number,
  glob?: string
): Promise<{ matches: { file: string; line: number; text: string }[]; totalMatches: number }> {
  try {
    // Note: grep --max-count is per-file, not global total. We enforce
    // the global limit in the result-parsing loop below.
    const grepArgs = ["-rn"];

    // Convert glob to grep --include patterns
    if (glob) {
      grepArgs.push("--include=" + glob);
    } else {
      // Default to TS/JS files
      grepArgs.push("--include=*.ts", "--include=*.tsx", "--include=*.js", "--include=*.jsx");
    }

    // Exclude common non-source dirs
    grepArgs.push("--exclude-dir=node_modules", "--exclude-dir=dist", "--exclude-dir=.git", "--exclude-dir=coverage");
    grepArgs.push(pattern, repoPath);

    const { stdout } = await execFileAsync("grep", grepArgs, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
    });

    const matches: { file: string; line: number; text: string }[] = [];

    for (const line of stdout.split("\n")) {
      if (!line.trim()) continue;
      // grep -rn output: /path/to/file:linenum:matched text
      const colonIdx = line.indexOf(":");
      if (colonIdx < 0) continue;
      const filePart = line.substring(0, colonIdx);
      const rest = line.substring(colonIdx + 1);
      const colonIdx2 = rest.indexOf(":");
      if (colonIdx2 < 0) continue;
      const lineNum = parseInt(rest.substring(0, colonIdx2), 10);
      const text = rest.substring(colonIdx2 + 1).trim();

      if (!isNaN(lineNum)) {
        matches.push({
          file: path.relative(repoPath, filePart),
          line: lineNum,
          text: redactSecrets(text),
        });
      }

      if (matches.length >= maxResults) break;
    }

    return { matches, totalMatches: matches.length };
  } catch (err: any) {
    // grep returns exit code 1 when no matches found
    if (err.code === 1 || err.status === 1) {
      return { matches: [], totalMatches: 0 };
    }
    return { matches: [], totalMatches: 0 };
  }
}

// ── crp.repo.diff ──

/** Validate that a git ref argument is safe (no shell metacharacters or flags) */
function isValidGitRef(ref: string): boolean {
  // Allow alphanumeric, dots, slashes, dashes, underscores, tildes, carets, colons
  // Reject anything that looks like a flag (--) or contains shell metacharacters
  return /^[a-zA-Z0-9._\/\-~^:@{}]+$/.test(ref) && !ref.startsWith("-");
}

export async function repoDiff(args: {
  ref1?: string;
  ref2?: string;
  staged?: boolean;
}): Promise<{ diff: string; filesChanged: number }> {
  const repoPath = getActiveRepoPath();
  const git = simpleGit(repoPath);

  // Validate git refs to prevent argument injection
  if (args.ref1 && !isValidGitRef(args.ref1)) {
    throw new Error(`Invalid git ref: ${args.ref1}`);
  }
  if (args.ref2 && !isValidGitRef(args.ref2)) {
    throw new Error(`Invalid git ref: ${args.ref2}`);
  }

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
    // If still nothing, diff against HEAD~5 to catch recent committed fixes
    if (!diff.trim()) {
      try {
        diff = await git.diff(["HEAD~5", "HEAD"]);
      } catch {
        // Fallback to HEAD~1 if repo has fewer than 5 commits
        try {
          diff = await git.diff(["HEAD~1", "HEAD"]);
        } catch {
          diff = "";
        }
      }
    }
  }

  const filesChanged = (diff.match(/^diff --git/gm) || []).length;

  return { diff, filesChanged };
}
