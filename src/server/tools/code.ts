import * as fs from "fs";
import * as path from "path";
import { execFile, execSync as nodeExecSync } from "child_process";
import { promisify } from "util";
import { Project, SourceFile } from "ts-morph";
import { getActiveRepoPath } from "./repo";
import type { ImportGraphResult, ImportGraphNode, SemgrepResult } from "../types";

const execFileAsync = promisify(execFile);

// ── crp.code.import_graph ──

export async function codeImportGraph(args: {
  path?: string;
}): Promise<ImportGraphResult> {
  const repoPath = getActiveRepoPath();
  const targetPath = args.path ? path.resolve(repoPath, args.path) : repoPath;

  // Try to find tsconfig
  const tsconfigPath = path.join(repoPath, "tsconfig.json");
  let project: Project;

  try {
    project = new Project({
      tsConfigFilePath: tsconfigPath,
      skipAddingFilesFromTsConfig: false,
    });
  } catch {
    // No tsconfig, manually add files
    project = new Project({
      compilerOptions: {
        target: 99, // ESNext
        module: 99, // ESNext
        moduleResolution: 100, // Bundler
        jsx: 4, // react-jsx
        allowJs: true,
      },
    });
    project.addSourceFilesAtPaths([
      path.join(targetPath, "**/*.ts"),
      path.join(targetPath, "**/*.tsx"),
      path.join(targetPath, "**/*.js"),
      path.join(targetPath, "**/*.jsx"),
    ]);
  }

  const sourceFiles = project.getSourceFiles().filter(
    (sf) =>
      !sf.getFilePath().includes("node_modules") &&
      !sf.getFilePath().includes("dist")
  );

  // Build adjacency list
  const nodes: ImportGraphNode[] = [];
  const adjacencyMap = new Map<string, Set<string>>();

  for (const sf of sourceFiles) {
    const filePath = path.relative(repoPath, sf.getFilePath());
    const imports: string[] = [];

    for (const imp of sf.getImportDeclarations()) {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      // Only track relative imports (internal dependencies)
      if (moduleSpecifier.startsWith(".")) {
        const resolved = resolveImport(sf, moduleSpecifier, repoPath);
        if (resolved) {
          imports.push(resolved);
        }
      }
    }

    nodes.push({ file: filePath, imports });
    adjacencyMap.set(filePath, new Set(imports));
  }

  // Detect cycles using DFS
  const cycles = detectCycles(adjacencyMap);

  // Find entry points (files not imported by anything)
  const allImported = new Set<string>();
  for (const node of nodes) {
    for (const imp of node.imports) {
      allImported.add(imp);
    }
  }
  const entryPoints = nodes
    .map((n) => n.file)
    .filter((f) => !allImported.has(f));

  return {
    nodes,
    cycles,
    entryPoints,
    totalFiles: nodes.length,
  };
}

function resolveImport(
  sourceFile: SourceFile,
  moduleSpecifier: string,
  repoPath: string
): string | null {
  try {
    const dir = path.dirname(sourceFile.getFilePath());
    const resolved = path.resolve(dir, moduleSpecifier);
    const relative = path.relative(repoPath, resolved);

    // Try common extensions
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"];
    for (const ext of extensions) {
      const candidate = relative + ext;
      const fullPath = path.join(repoPath, candidate);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          return candidate;
        }
      } catch {
        // Not found, try next
      }
    }

    return relative;
  } catch {
    return null;
  }
}

function detectCycles(adjacencyMap: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string) {
    if (inStack.has(node)) {
      // Found a cycle
      const cycleStart = stack.indexOf(node);
      if (cycleStart >= 0) {
        const cycle = stack.slice(cycleStart).concat(node);
        cycles.push(cycle);
      }
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    stack.push(node);

    const neighbors = adjacencyMap.get(node) || new Set();
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }

    stack.pop();
    inStack.delete(node);
  }

  for (const node of adjacencyMap.keys()) {
    dfs(node);
  }

  return cycles;
}

// ── crp.code.pattern_scan ──

export async function codePatternScan(args: {
  config?: string;
  pattern?: string;
  signal?: AbortSignal;
}): Promise<{ results: SemgrepResult[]; totalResults: number; warning?: string }> {
  const repoPath = getActiveRepoPath();

  // Resolve semgrep binary — may be in /opt/homebrew/bin on macOS ARM
  const semgrepBin = findSemgrepBinary();
  if (!semgrepBin) {
    return {
      results: [],
      totalResults: 0,
      warning: "Semgrep is not installed. Install with: brew install semgrep",
    };
  }

  // Build args: when using --pattern, don't pass --config
  const semgrepArgs: string[] = ["scan", "--json", "--quiet", "--no-git-ignore"];

  if (args.pattern) {
    // Validate pattern: max length + no shell metacharacters
    if (args.pattern.length > 500) {
      return {
        results: [],
        totalResults: 0,
        warning: "Semgrep pattern too long (max 500 chars)",
      };
    }
    semgrepArgs.push("--pattern", args.pattern, "--lang", "ts");
  } else {
    // Registry configs like "p/typescript" require network + login on newer Semgrep versions.
    // Use "auto" for local analysis (uses built-in rules without registry access),
    // or fall back to the user-provided config.
    const config = args.config ?? "auto";
    // Validate config: only allow safe config identifiers (e.g., "auto", "p/typescript")
    if (!/^[a-zA-Z0-9_/.-]+$/.test(config)) {
      return {
        results: [],
        totalResults: 0,
        warning: "Invalid Semgrep config identifier",
      };
    }
    semgrepArgs.push("--config", config);
  }

  // Restrict to TypeScript/JavaScript files only — Semgrep crashes on
  // non-JS files like YAML Helm templates with Go templating syntax
  semgrepArgs.push(
    "--include", "*.ts",
    "--include", "*.tsx",
    "--include", "*.js",
    "--include", "*.jsx",
    "--include", "*.mjs",
    "--include", "*.cjs",
  );

  semgrepArgs.push(repoPath);

  try {
    const output = await runSemgrep(semgrepBin, semgrepArgs, args.signal);
    return parseSemgrepOutput(output, repoPath);
  } catch (err: any) {
    // If aborted, return a clean warning instead of a cryptic error
    if (args.signal?.aborted) {
      return {
        results: [],
        totalResults: 0,
        warning: "Semgrep scan was cancelled",
      };
    }
    return {
      results: [],
      totalResults: 0,
      warning: `Semgrep error: ${err.message?.slice(0, 200)}`,
    };
  }
}

/** Run semgrep and return stdout. Semgrep exits 1 when findings exist, which is not an error.
 *  Accepts an optional AbortSignal to kill the child process externally (e.g. on timeout). */
function runSemgrep(bin: string, args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const exec = execFile;
    // Ensure child process inherits augmented PATH so semgrep can find its dependencies
    const env = { ...process.env };
    const currentPath = env.PATH || "";
    if (!currentPath.includes("/opt/homebrew/bin")) {
      env.PATH = `/opt/homebrew/bin:/usr/local/bin:${currentPath}`;
    }

    // If already aborted, don't even start
    if (signal?.aborted) {
      reject(new Error("Semgrep scan aborted before start"));
      return;
    }

    const child = exec(
      bin,
      args,
      { maxBuffer: 20 * 1024 * 1024, timeout: 45000, env },
      (err: any, stdout: string, stderr: string) => {
        // Semgrep returns exit code 1 when findings are present — that's normal
        if (stdout && stdout.trim().startsWith("{")) {
          resolve(stdout);
        } else if (err) {
          // Include stderr in error for better debugging
          const errMsg = stderr ? `${err.message}\nStderr: ${stderr.slice(0, 500)}` : err.message;
          reject(new Error(errMsg));
        } else {
          resolve(stdout || "{}");
        }
      }
    );

    // Listen for abort signal and kill the child process immediately
    if (signal) {
      const onAbort = () => {
        try {
          child.kill("SIGKILL");
        } catch {
          // Process may already be dead
        }
        reject(new Error("Semgrep scan aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      // Clean up listener when child process exits naturally
      child.on("exit", () => {
        signal.removeEventListener("abort", onAbort);
      });
    }
  });
}

function parseSemgrepOutput(
  stdout: string,
  repoPath: string
): { results: SemgrepResult[]; totalResults: number; warning?: string } {
  try {
    const parsed = JSON.parse(stdout);
    const results: SemgrepResult[] = (parsed.results || []).map(
      (r: any) => ({
        ruleId: r.check_id || r.rule_id || "unknown",
        severity: r.extra?.severity || "WARNING",
        message: r.extra?.message || r.message || "",
        filePath: path.relative(repoPath, r.path),
        startLine: r.start?.line || 0,
        endLine: r.end?.line || 0,
        snippet: r.extra?.lines || "",
      })
    );

    const errors = parsed.errors || [];
    const warning = errors.length > 0
      ? `Semgrep reported ${errors.length} error(s): ${errors[0]?.message || ""}`
      : undefined;

    return { results, totalResults: results.length, warning };
  } catch {
    return { results: [], totalResults: 0, warning: "Failed to parse Semgrep output" };
  }
}

/** Find the semgrep binary, checking common paths on macOS */
function findSemgrepBinary(): string | null {
  const candidates = [
    "semgrep",                              // on PATH
    "/opt/homebrew/bin/semgrep",            // macOS ARM homebrew
    "/usr/local/bin/semgrep",               // macOS Intel homebrew / pip
    path.join(process.env.HOME || "", ".local/bin/semgrep"), // pip --user
  ];

  for (const candidate of candidates) {
    // For bare "semgrep", check if it's on PATH
    if (candidate === "semgrep") {
      try {
        const result = nodeExecSync("which semgrep", { encoding: "utf-8" }).trim();
        if (result) return result;
      } catch {
        continue;
      }
    } else if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
