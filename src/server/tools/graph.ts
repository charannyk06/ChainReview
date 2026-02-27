// ── Call Graph, Symbol Lookup, and Impact Analysis ──
// FastCode-inspired code understanding engine using ts-morph AST analysis.
// Builds function-level call graphs, resolves symbol definitions/references,
// and computes change blast radius via reverse dependency traversal.
// Includes SQLite-backed incremental caching: only re-parses changed files.

import * as path from "path";
import { createHash } from "crypto";
import { Project, SyntaxKind, Node } from "ts-morph";
import type { SourceFile, FunctionDeclaration, MethodDeclaration } from "ts-morph";
import { getActiveRepoPath } from "./repo";
import type { Store, CodeIndexEntry } from "../store";
import type {
  CallGraphResult,
  CallGraphEdge,
  FileMetrics,
  SymbolLookupResult,
  SymbolLocation,
  ImpactResult,
  ImpactedFile,
  CriticalFile,
} from "../types";

// ── Store binding for caching ──
// The orchestrator sets the store reference before calling codeCallGraph.
// When set, the call graph engine uses SQLite cache for incremental indexing.
let activeStore: Store | null = null;

/** Bind a Store instance for call graph caching. Call this before reviews. */
export function setGraphStore(store: Store): void {
  activeStore = store;
}

/** Hash file content for change detection */
function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

// ── Cached ts-morph Project ──
// The Project is expensive to create (~1-3s for medium repos). Cache it and
// reuse across call graph, symbol lookup, and import graph calls.
let cachedProject: Project | null = null;
let cachedRepoPath: string | null = null;

function getOrCreateProject(repoPath: string): Project {
  if (cachedProject && cachedRepoPath === repoPath) {
    return cachedProject;
  }

  const tsconfigPath = path.join(repoPath, "tsconfig.json");
  let project: Project;

  try {
    project = new Project({
      tsConfigFilePath: tsconfigPath,
      skipAddingFilesFromTsConfig: false,
    });
  } catch {
    // No tsconfig — manually add source files
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
      path.join(repoPath, "**/*.ts"),
      path.join(repoPath, "**/*.tsx"),
      path.join(repoPath, "**/*.js"),
      path.join(repoPath, "**/*.jsx"),
    ]);
  }

  cachedProject = project;
  cachedRepoPath = repoPath;
  return project;
}

/** Invalidate the cached project (call when repo changes) */
export function invalidateProjectCache(): void {
  cachedProject = null;
  cachedRepoPath = null;
}

/** Filter source files: exclude node_modules, dist, .d.ts */
function getSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sf) => {
    const fp = sf.getFilePath();
    return (
      !fp.includes("node_modules") &&
      !fp.includes("/dist/") &&
      !fp.endsWith(".d.ts")
    );
  });
}

// ── crp.code.call_graph ──

/** Cache stats from the last call graph build — accessible for timeline events */
export let lastCacheStats: { total: number; cached: number; reparsed: number } | null = null;

export async function codeCallGraph(args: {
  path?: string;
}): Promise<CallGraphResult> {
  const repoPath = getActiveRepoPath();
  const project = getOrCreateProject(repoPath);
  const sourceFiles = getSourceFiles(project);

  const edges: CallGraphEdge[] = [];
  const fileSymbolCounts = new Map<string, { total: number; exported: number }>();
  const fanInMap = new Map<string, number>();
  const fanOutMap = new Map<string, number>();
  const allFiles = new Set<string>();

  // Optional path filter
  const targetDir = args.path ? path.resolve(repoPath, args.path) : null;

  // ── Cache-aware indexing ──
  // When a Store is available, check file hashes against cached entries.
  // Only re-parse files whose content has changed. Load unchanged from cache.
  const cachedEntries = activeStore
    ? new Map(activeStore.getCodeIndexForRepo(repoPath).map((e) => [e.filePath, e]))
    : new Map<string, CodeIndexEntry>();

  let cacheHits = 0;
  let cacheMisses = 0;
  const currentFiles = new Set<string>(); // Track current files for stale entry cleanup

  for (const sf of sourceFiles) {
    const absPath = sf.getFilePath();
    if (targetDir && !absPath.startsWith(targetDir)) continue;

    const relPath = path.relative(repoPath, absPath);
    allFiles.add(relPath);
    currentFiles.add(relPath);

    // Check cache: if file hash matches, use cached edges + symbols
    const fileContent = sf.getFullText();
    const currentHash = hashContent(fileContent);
    const cached = cachedEntries.get(relPath);

    if (cached && cached.fileHash === currentHash) {
      // Cache hit — load edges and symbols from cache
      cacheHits++;
      try {
        const cachedEdges: CallGraphEdge[] = JSON.parse(cached.callsJson);
        const cachedSymbols: { total: number; exported: number } = JSON.parse(cached.symbolsJson);
        edges.push(...cachedEdges);
        fileSymbolCounts.set(relPath, cachedSymbols);

        // Rebuild fan-in/fan-out from cached edges
        for (const edge of cachedEdges) {
          if (edge.sourceFile !== edge.targetFile) {
            fanOutMap.set(edge.sourceFile, (fanOutMap.get(edge.sourceFile) || 0) + 1);
            fanInMap.set(edge.targetFile, (fanInMap.get(edge.targetFile) || 0) + 1);
          }
        }
        continue;
      } catch {
        // Corrupted cache entry — fall through to full parse
      }
    }

    // Cache miss — full AST parse required
    cacheMisses++;

    const fileEdges: CallGraphEdge[] = [];

    // Count symbols in this file
    const functions = sf.getFunctions();
    const classes = sf.getClasses();
    const methods = classes.flatMap((c) => c.getMethods());
    const allDecls = [...functions, ...methods];
    const exportedCount = functions.filter((d) => d.isExported()).length +
      classes.filter((c) => c.isExported()).length;

    const symbolCounts = {
      total: allDecls.length + classes.length,
      exported: exportedCount,
    };
    fileSymbolCounts.set(relPath, symbolCounts);

    // Extract call edges from each function/method body
    for (const decl of allDecls) {
      const sourceSymbol = getDeclarationName(decl);
      if (!sourceSymbol) continue;

      const callExprs = decl.getDescendantsOfKind(SyntaxKind.CallExpression);

      for (const callExpr of callExprs) {
        try {
          const expr = callExpr.getExpression();
          const symbol = expr.getSymbol();
          if (!symbol) continue;

          const declarations = symbol.getDeclarations();
          if (declarations.length === 0) continue;

          const targetDecl = declarations[0];
          const targetFile = targetDecl.getSourceFile();
          const targetAbsPath = targetFile.getFilePath();

          // Skip external/node_modules references
          if (targetAbsPath.includes("node_modules")) continue;
          if (targetAbsPath.includes("/dist/")) continue;

          const targetRelPath = path.relative(repoPath, targetAbsPath);
          const targetSymbol = symbol.getName();
          const callLine = callExpr.getStartLineNumber();

          // Only record cross-symbol or cross-file edges (skip self-calls within same function)
          if (relPath !== targetRelPath || sourceSymbol !== targetSymbol) {
            const edge: CallGraphEdge = {
              sourceFile: relPath,
              sourceSymbol,
              targetFile: targetRelPath,
              targetSymbol,
              callLine,
            };
            fileEdges.push(edge);
            edges.push(edge);

            // Track fan-in/fan-out at file level
            if (relPath !== targetRelPath) {
              fanOutMap.set(relPath, (fanOutMap.get(relPath) || 0) + 1);
              fanInMap.set(targetRelPath, (fanInMap.get(targetRelPath) || 0) + 1);
            }
          }
        } catch {
          // Symbol resolution can fail on dynamic calls — skip gracefully
        }
      }
    }

    // Update cache for this file
    if (activeStore) {
      activeStore.upsertCodeIndex({
        repoPath,
        filePath: relPath,
        fileHash: currentHash,
        symbolsJson: JSON.stringify(symbolCounts),
        callsJson: JSON.stringify(fileEdges),
        fanIn: 0, // Will be updated after full graph is built
        fanOut: fileEdges.filter((e) => e.sourceFile !== e.targetFile).length,
        indexedAt: new Date().toISOString(),
      });
    }
  }

  // Clean up stale cache entries (files that were deleted/renamed)
  if (activeStore) {
    for (const [filePath] of cachedEntries) {
      if (!currentFiles.has(filePath)) {
        activeStore.deleteCodeIndex(repoPath, filePath);
      }
    }
  }

  // Record cache stats for timeline reporting
  lastCacheStats = {
    total: cacheHits + cacheMisses,
    cached: cacheHits,
    reparsed: cacheMisses,
  };

  // Build file metrics
  const fileMetrics: FileMetrics[] = [];
  for (const file of allFiles) {
    const counts = fileSymbolCounts.get(file) || { total: 0, exported: 0 };
    fileMetrics.push({
      file,
      fanIn: fanInMap.get(file) || 0,
      fanOut: fanOutMap.get(file) || 0,
      symbolCount: counts.total,
      exportedSymbolCount: counts.exported,
    });
  }

  // Sort by fan-in (most depended-upon first)
  fileMetrics.sort((a, b) => b.fanIn - a.fanIn);

  return {
    edges,
    fileMetrics,
    totalFunctions: [...fileSymbolCounts.values()].reduce((s, c) => s + c.total, 0),
    totalEdges: edges.length,
  };
}

function getDeclarationName(decl: FunctionDeclaration | MethodDeclaration): string | null {
  try {
    return decl.getName() || null;
  } catch {
    return null;
  }
}

// ── crp.code.symbol_lookup ──

export async function codeSymbolLookup(args: {
  symbol: string;
  file?: string;
}): Promise<SymbolLookupResult> {
  const repoPath = getActiveRepoPath();
  const project = getOrCreateProject(repoPath);
  const sourceFiles = getSourceFiles(project);

  let definition: SymbolLocation | null = null;
  const references: SymbolLocation[] = [];
  let exported = false;

  // If a file is specified, search there first for the definition
  const targetFile = args.file
    ? sourceFiles.find((sf) =>
        path.relative(repoPath, sf.getFilePath()) === args.file
      )
    : undefined;

  // Search all files for references to this symbol
  const filesToSearch = targetFile ? [targetFile, ...sourceFiles.filter((sf) => sf !== targetFile)] : sourceFiles;

  for (const sf of filesToSearch) {
    const relPath = path.relative(repoPath, sf.getFilePath());

    // Search for identifiers matching the symbol name
    const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier);

    for (const id of identifiers) {
      if (id.getText() !== args.symbol) continue;

      try {
        const sym = id.getSymbol();
        if (!sym) continue;

        const decls = sym.getDeclarations();
        const line = id.getStartLineNumber();
        const col = id.getStart() - (id.getStartLineNumber() > 1 ? sf.getFullText().split("\n").slice(0, id.getStartLineNumber() - 1).join("\n").length + 1 : 0);

        // Check if this is a definition (declaration) site
        const parent = id.getParent();
        const isDefinition = parent && decls.some((d) => {
          try {
            return d.getStartLineNumber() === line && d.getSourceFile() === sf;
          } catch { return false; }
        });

        if (isDefinition && !definition) {
          const kind = getNodeKind(parent!);
          definition = { file: relPath, line, column: Math.max(0, col), kind };

          // Check if exported
          try {
            exported = (parent as any)?.isExported?.() || false;
          } catch {
            exported = false;
          }
        } else {
          references.push({
            file: relPath,
            line,
            column: Math.max(0, col),
            kind: "reference",
          });
        }
      } catch {
        // Skip unresolvable symbols
      }
    }
  }

  // Cap references to avoid huge output
  const cappedRefs = references.slice(0, 50);

  return {
    name: args.symbol,
    definition,
    references: cappedRefs,
    totalReferences: references.length,
    exported,
  };
}

function getNodeKind(node: Node): string {
  const kind = node.getKindName();
  const kindMap: Record<string, string> = {
    FunctionDeclaration: "function",
    MethodDeclaration: "method",
    ClassDeclaration: "class",
    InterfaceDeclaration: "interface",
    TypeAliasDeclaration: "type",
    VariableDeclaration: "variable",
    EnumDeclaration: "enum",
    PropertyDeclaration: "property",
    ArrowFunction: "function",
    FunctionExpression: "function",
    Parameter: "parameter",
  };
  return kindMap[kind] || "unknown";
}

// ── crp.code.impact_analysis ──

export async function codeImpactAnalysis(args: {
  file: string;
  depth?: number;
}): Promise<ImpactResult> {
  const repoPath = getActiveRepoPath();

  // Build the call graph first (uses cache if available)
  const graph = await codeCallGraph({});

  const maxDepth = args.depth ?? 3;
  const targetFile = args.file;

  // Build reverse adjacency: file → files that depend on it (callers)
  const reverseAdj = new Map<string, Set<string>>();
  const fileCallSymbols = new Map<string, Set<string>>(); // file → symbols called into it

  for (const edge of graph.edges) {
    if (edge.sourceFile !== edge.targetFile) {
      if (!reverseAdj.has(edge.targetFile)) {
        reverseAdj.set(edge.targetFile, new Set());
      }
      reverseAdj.get(edge.targetFile)!.add(edge.sourceFile);

      // Track which symbols are called from each file
      const key = `${edge.sourceFile}→${edge.targetFile}`;
      if (!fileCallSymbols.has(key)) {
        fileCallSymbols.set(key, new Set());
      }
      fileCallSymbols.get(key)!.add(edge.targetSymbol);
    }
  }

  // BFS from target file through reverse edges
  const visited = new Set<string>();
  const impactedFiles: ImpactedFile[] = [];
  const queue: Array<{ file: string; distance: number }> = [{ file: targetFile, distance: 0 }];
  visited.add(targetFile);

  // Build fan-in lookup from graph metrics
  const fanInLookup = new Map<string, number>();
  for (const fm of graph.fileMetrics) {
    fanInLookup.set(fm.file, fm.fanIn);
  }

  while (queue.length > 0) {
    const { file, distance } = queue.shift()!;

    if (distance > 0) {
      // Collect affected symbols for this file→target relationship
      const symbolKey = `${file}→${targetFile}`;
      const symbols = fileCallSymbols.get(symbolKey);
      impactedFiles.push({
        file,
        distance,
        fanIn: fanInLookup.get(file) || 0,
        affectedSymbols: symbols ? [...symbols] : [],
      });
    }

    if (distance < maxDepth) {
      const dependents = reverseAdj.get(file);
      if (dependents) {
        for (const dep of dependents) {
          if (!visited.has(dep)) {
            visited.add(dep);
            queue.push({ file: dep, distance: distance + 1 });
          }
        }
      }
    }
  }

  // Sort by distance, then by fan-in (most critical first)
  impactedFiles.sort((a, b) => a.distance - b.distance || b.fanIn - a.fanIn);

  return {
    sourceFile: targetFile,
    impactedFiles,
    totalImpacted: impactedFiles.length,
    maxDepth,
  };
}

// ── Module Criticality Scoring ──
// Adapts FastCode's module importance ranking.
// Score = normalize(0.6 * fanIn + 0.4 * fanOut)

export function computeCriticalityScores(graph: CallGraphResult): CriticalFile[] {
  if (graph.fileMetrics.length === 0) return [];

  const maxFanIn = Math.max(...graph.fileMetrics.map((f) => f.fanIn), 1);
  const maxFanOut = Math.max(...graph.fileMetrics.map((f) => f.fanOut), 1);

  const scored: CriticalFile[] = graph.fileMetrics
    .filter((f) => f.fanIn > 0 || f.fanOut > 0) // Only rank files with connections
    .map((f) => {
      const normalizedFanIn = f.fanIn / maxFanIn;
      const normalizedFanOut = f.fanOut / maxFanOut;
      const score = 0.6 * normalizedFanIn + 0.4 * normalizedFanOut;

      let reason: string;
      if (normalizedFanIn > 0.7 && normalizedFanOut > 0.5) {
        reason = "Central hub (high fan-in + fan-out)";
      } else if (normalizedFanIn > 0.7) {
        reason = "High fan-in hub (many dependents)";
      } else if (normalizedFanOut > 0.7) {
        reason = "High fan-out (depends on many modules)";
      } else if (normalizedFanIn > 0.4) {
        reason = "Moderate dependency target";
      } else {
        reason = "Active module";
      }

      return {
        file: f.file,
        score: Math.round(score * 100) / 100,
        fanIn: f.fanIn,
        fanOut: f.fanOut,
        reason,
      };
    });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored;
}
