import { execSync } from "child_process";
import * as path from "path";

// Global repo path set by repoOpen
let currentRepoPath: string | null = null;

export function setExecRepoPath(repoPath: string) {
  currentRepoPath = repoPath;
}

// Allowlisted read-only commands
const ALLOWED_COMMANDS = new Set([
  "wc",
  "find",
  "ls",
  "cat",
  "head",
  "tail",
  "grep",
  "git",
  "npm",
  "tsc",
  "node",
  "du",
  "file",
  "stat",
  "sort",
  "uniq",
  "tr",
  "cut",
  "awk",
  "sed",
]);

// Dangerous git subcommands that modify state
const BLOCKED_GIT_SUBCOMMANDS = new Set([
  "push",
  "commit",
  "merge",
  "rebase",
  "reset",
  "checkout",
  "branch",
  "tag",
  "stash",
  "cherry-pick",
  "revert",
  "clean",
  "gc",
  "prune",
  "rm",
  "mv",
]);

function validateCommand(command: string): { valid: boolean; reason?: string } {
  const trimmed = command.trim();
  if (!trimmed) return { valid: false, reason: "Empty command" };

  // Extract the base command (first word)
  const parts = trimmed.split(/\s+/);
  const baseCmd = path.basename(parts[0]);

  if (!ALLOWED_COMMANDS.has(baseCmd)) {
    return {
      valid: false,
      reason: `Command '${baseCmd}' is not in the allowlist. Allowed: ${Array.from(ALLOWED_COMMANDS).join(", ")}`,
    };
  }

  // Check git subcommands
  if (baseCmd === "git" && parts.length > 1) {
    const subCmd = parts[1];
    if (BLOCKED_GIT_SUBCOMMANDS.has(subCmd)) {
      return {
        valid: false,
        reason: `git ${subCmd} is not allowed (write operation). Use read-only git commands like: log, show, blame, diff, status, branch --list`,
      };
    }
  }

  // Block npm write operations
  if (baseCmd === "npm" && parts.length > 1) {
    const subCmd = parts[1];
    const blockedNpm = ["install", "uninstall", "update", "publish", "run", "start", "init"];
    if (blockedNpm.includes(subCmd)) {
      return {
        valid: false,
        reason: `npm ${subCmd} is not allowed. Use read-only npm commands like: ls, list, outdated, view`,
      };
    }
  }

  // Block pipe to write commands
  if (/\|\s*(rm|mv|cp|tee|dd|chmod|chown)\b/.test(trimmed)) {
    return { valid: false, reason: "Piping to write commands is not allowed" };
  }

  // Block redirects
  if (/[>]/.test(trimmed)) {
    return { valid: false, reason: "Output redirection is not allowed" };
  }

  return { valid: true };
}

export async function execCommand(args: {
  command: string;
  timeout?: number;
}): Promise<{ output: string; exitCode: number; command: string }> {
  const { command, timeout = 10000 } = args;

  const validation = validateCommand(command);
  if (!validation.valid) {
    return {
      output: `Rejected: ${validation.reason}`,
      exitCode: 1,
      command,
    };
  }

  const cwd = currentRepoPath || process.cwd();

  try {
    const output = execSync(command, {
      cwd,
      timeout,
      maxBuffer: 1024 * 1024, // 1MB
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Truncate large outputs
    const truncated = output.length > 10000
      ? output.slice(0, 10000) + `\n... (truncated, ${output.length} total chars)`
      : output;

    return { output: truncated, exitCode: 0, command };
  } catch (err: any) {
    const output = err.stdout || err.stderr || err.message;
    const truncated = output.length > 5000
      ? output.slice(0, 5000) + "\n... (truncated)"
      : output;

    return {
      output: truncated,
      exitCode: err.status || 1,
      command,
    };
  }
}
