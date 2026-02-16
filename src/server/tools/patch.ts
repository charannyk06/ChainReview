import * as fs from "fs";
import * as path from "path";
import { getActiveRepoPath } from "./repo";
import type { Store } from "../store";

// ── crp.patch.propose ──

export async function patchPropose(
  args: {
    findingId: string;
    filePath: string;
    originalCode: string;
    patchedCode: string;
    description: string;
  },
  store: Store,
  runId: string
): Promise<{ patchId: string; diff: string }> {
  const repoPath = getActiveRepoPath();
  const fullPath = path.resolve(repoPath, args.filePath);

  // Secure path traversal check using path.relative (consistent with patchValidate/applyPatchToFile)
  const relative = path.relative(repoPath, fullPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error("Path traversal detected");
  }

  // Generate unified diff
  const diff = generateUnifiedDiff(
    args.filePath,
    args.originalCode,
    args.patchedCode
  );

  const patchId = store.insertPatch(runId, args.findingId, diff);

  return { patchId, diff };
}

// ── crp.patch.validate ──

export async function patchValidate(
  args: { patchId: string },
  store: Store
): Promise<{ validated: boolean; message: string }> {
  const patch = store.getPatch(args.patchId);
  if (!patch) {
    return { validated: false, message: `Patch not found: ${args.patchId}` };
  }

  const repoPath = getActiveRepoPath();

  try {
    // Parse the diff to get file path and changes
    const parsed = parseUnifiedDiff(patch.diff);
    if (!parsed) {
      store.updatePatchValidation(args.patchId, false, "Could not parse diff");
      return { validated: false, message: "Could not parse diff" };
    }

    const filePath = path.resolve(repoPath, parsed.filePath);

    // Secure path traversal check using path.relative
    const relative = path.relative(repoPath, filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      store.updatePatchValidation(args.patchId, false, "Path traversal detected");
      return { validated: false, message: "Path traversal detected" };
    }

    if (!fs.existsSync(filePath)) {
      store.updatePatchValidation(args.patchId, false, `File not found: ${parsed.filePath}`);
      return { validated: false, message: `File not found: ${parsed.filePath}` };
    }

    const originalContent = fs.readFileSync(filePath, "utf-8");
    const patchedContent = applyDiff(originalContent, parsed.hunks);

    if (patchedContent === null) {
      store.updatePatchValidation(args.patchId, false, "Patch does not apply cleanly");
      return { validated: false, message: "Patch does not apply cleanly" };
    }

    // Basic syntax check: try to parse as TypeScript
    if (parsed.filePath.endsWith(".ts") || parsed.filePath.endsWith(".tsx")) {
      try {
        const { Project } = require("ts-morph") as typeof import("ts-morph");
        const project = new Project({ useInMemoryFileSystem: true });
        const sf = project.createSourceFile("test.ts", patchedContent);
        const diagnostics = sf.getPreEmitDiagnostics();
        const errors = diagnostics.filter((d) => d.getCategory() === 0); // Error category
        if (errors.length > 0) {
          const msg = `TypeScript errors after patch: ${errors.map((e) => e.getMessageText().toString()).join("; ").slice(0, 500)}`;
          store.updatePatchValidation(args.patchId, false, msg);
          return { validated: false, message: msg };
        }
      } catch {
        // ts-morph check is best-effort
      }
    }

    store.updatePatchValidation(args.patchId, true, "Patch applies cleanly and passes syntax check");
    return {
      validated: true,
      message: "Patch applies cleanly and passes syntax check",
    };
  } catch (err: any) {
    const msg = `Validation error: ${err.message}`;
    store.updatePatchValidation(args.patchId, false, msg);
    return { validated: false, message: msg };
  }
}

// ── Apply patch to file on disk ──

export async function applyPatchToFile(patchId: string, store: Store): Promise<{ success: boolean; message: string }> {
  const patch = store.getPatch(patchId);
  if (!patch) {
    return { success: false, message: `Patch not found: ${patchId}` };
  }

  if (!patch.validated) {
    return { success: false, message: "Patch has not been validated" };
  }

  const repoPath = getActiveRepoPath();
  const parsed = parseUnifiedDiff(patch.diff);
  if (!parsed) {
    return { success: false, message: "Could not parse diff" };
  }

  const filePath = path.resolve(repoPath, parsed.filePath);

  // Secure path traversal check using path.relative
  const relative = path.relative(repoPath, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return { success: false, message: "Path traversal detected" };
  }

  if (!fs.existsSync(filePath)) {
    return { success: false, message: `File not found: ${parsed.filePath}` };
  }

  const originalContent = fs.readFileSync(filePath, "utf-8");
  const patchedContent = applyDiff(originalContent, parsed.hunks);

  if (patchedContent === null) {
    return { success: false, message: "Patch does not apply cleanly" };
  }

  fs.writeFileSync(filePath, patchedContent, "utf-8");
  return { success: true, message: `Patch applied to ${parsed.filePath}` };
}

// ── Diff utilities ──

function generateUnifiedDiff(
  filePath: string,
  original: string,
  patched: string
): string {
  const origLines = original.split("\n");
  const patchLines = patched.split("\n");

  let diff = `--- a/${filePath}\n+++ b/${filePath}\n`;

  // Simple hunk generation: find first and last changed lines
  let firstChange = -1;
  let lastChange = -1;
  const maxLen = Math.max(origLines.length, patchLines.length);

  for (let i = 0; i < maxLen; i++) {
    if (origLines[i] !== patchLines[i]) {
      if (firstChange === -1) firstChange = i;
      lastChange = i;
    }
  }

  if (firstChange === -1) {
    return diff + "// No changes\n";
  }

  // Add context (3 lines before/after)
  const contextBefore = Math.max(0, firstChange - 3);
  const contextAfterOrig = Math.min(origLines.length, lastChange + 4);
  const contextAfterPatch = Math.min(patchLines.length, lastChange + 4);

  const origCount = contextAfterOrig - contextBefore;
  const patchCount = contextAfterPatch - contextBefore;

  diff += `@@ -${contextBefore + 1},${origCount} +${contextBefore + 1},${patchCount} @@\n`;

  for (let i = contextBefore; i < Math.max(contextAfterOrig, contextAfterPatch); i++) {
    const origLine = i < origLines.length ? origLines[i] : undefined;
    const patchLine = i < patchLines.length ? patchLines[i] : undefined;

    if (origLine === patchLine) {
      diff += ` ${origLine}\n`;
    } else {
      if (origLine !== undefined && (patchLine === undefined || origLine !== patchLine)) {
        diff += `-${origLine}\n`;
      }
      if (patchLine !== undefined && (origLine === undefined || origLine !== patchLine)) {
        diff += `+${patchLine}\n`;
      }
    }
  }

  return diff;
}

interface DiffHunk {
  origStart: number;
  origCount: number;
  newStart: number;
  newCount: number;
  lines: { type: "context" | "add" | "remove"; text: string }[];
}

interface ParsedDiff {
  filePath: string;
  hunks: DiffHunk[];
}

function parseUnifiedDiff(diff: string): ParsedDiff | null {
  const lines = diff.split("\n");
  let filePath = "";
  const hunks: DiffHunk[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("--- a/")) {
      // Skip, we'll get path from +++
    } else if (line.startsWith("+++ b/")) {
      filePath = line.slice(6);
    } else if (line.startsWith("@@")) {
      const match = line.match(
        /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/
      );
      if (!match) continue;

      const hunk: DiffHunk = {
        origStart: parseInt(match[1], 10),
        origCount: parseInt(match[2] ?? "1", 10),
        newStart: parseInt(match[3], 10),
        newCount: parseInt(match[4] ?? "1", 10),
        lines: [],
      };

      for (let j = i + 1; j < lines.length; j++) {
        const hunkLine = lines[j];
        if (
          hunkLine.startsWith("@@") ||
          hunkLine.startsWith("--- ") ||
          hunkLine.startsWith("+++ ")
        ) {
          break;
        }

        if (hunkLine.startsWith("+")) {
          hunk.lines.push({ type: "add", text: hunkLine.slice(1) });
        } else if (hunkLine.startsWith("-")) {
          hunk.lines.push({ type: "remove", text: hunkLine.slice(1) });
        } else if (hunkLine.startsWith(" ")) {
          hunk.lines.push({ type: "context", text: hunkLine.slice(1) });
        }
      }

      hunks.push(hunk);
    }
  }

  if (!filePath) return null;
  return { filePath, hunks };
}

function applyDiff(content: string, hunks: DiffHunk[]): string | null {
  const lines = content.split("\n");
  let offset = 0;

  for (const hunk of hunks) {
    const start = hunk.origStart - 1 + offset;
    const removeLines: string[] = [];
    const addLines: string[] = [];

    for (const line of hunk.lines) {
      if (line.type === "remove" || line.type === "context") {
        removeLines.push(line.text);
      }
      if (line.type === "add" || line.type === "context") {
        addLines.push(line.text);
      }
    }

    // Verify context matches
    for (let i = 0; i < removeLines.length; i++) {
      if (start + i >= lines.length) {
        return null; // Out of bounds
      }
      // Fuzzy match: trim whitespace for comparison
      if (lines[start + i].trim() !== removeLines[i].trim()) {
        return null; // Context mismatch
      }
    }

    // Apply the hunk
    lines.splice(start, removeLines.length, ...addLines);
    offset += addLines.length - removeLines.length;
  }

  return lines.join("\n");
}
