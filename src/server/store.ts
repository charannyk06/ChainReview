import Database from "better-sqlite3";
import { randomUUID, createHash } from "crypto";
import type {
  Finding,
  Patch,
  AuditEvent,
  AgentName,
  EventType,
  Evidence,
  FindingStatus,
} from "./types";

export interface ReviewRunSummary {
  id: string;
  repoPath: string;
  repoName: string;
  mode: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
}

export interface Store {
  createRun(repoPath: string, mode: string): string;
  completeRun(runId: string, status: "complete" | "error"): void;
  insertFinding(runId: string, finding: Omit<Finding, "id" | "patchId">): string;
  insertEvent(runId: string, type: EventType, agent: AgentName | undefined, data: Record<string, unknown>): string;
  insertPatch(runId: string, findingId: string, diff: string): string;
  updatePatchValidation(patchId: string, validated: boolean, message: string): void;
  insertUserAction(runId: string, findingId: string | null, patchId: string | null, action: string): string;
  getFindings(runId: string): Finding[];
  getEvents(runId: string): AuditEvent[];
  getPatch(patchId: string): Patch | undefined;
  getFindingById(findingId: string): Finding | undefined;
  getRunRepoPath(runId: string): string | undefined;
  getReviewRuns(limit?: number): ReviewRunSummary[];
  deleteRun(runId: string): void;
  /** Check if a finding with this fingerprint already exists (active status) */
  findingExists(fingerprint: string): boolean;
  /** Get all active findings for a repo path (across all runs) */
  getRepoFindings(repoPath: string): Finding[];
  /** Update finding status (active/dismissed/resolved) */
  updateFindingStatus(findingId: string, status: FindingStatus): void;
  close(): void;
}

/** Compute a stable fingerprint for deduplication across runs */
export function computeFindingFingerprint(
  agent: string,
  category: string,
  title: string,
  evidence: Evidence[]
): string {
  const normalizedTitle = title.toLowerCase().trim();
  const primaryFile = evidence[0]?.filePath || "";
  const primaryLine = evidence[0]?.startLine ?? 0;
  const raw = `${agent}:${category}:${normalizedTitle}:${primaryFile}:${primaryLine}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS review_runs (
  id TEXT PRIMARY KEY,
  repo_path TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES review_runs(id),
  agent TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence REAL NOT NULL,
  evidence_json TEXT NOT NULL,
  fingerprint TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES review_runs(id),
  type TEXT NOT NULL,
  agent TEXT,
  data_json TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patches (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES review_runs(id),
  finding_id TEXT NOT NULL REFERENCES findings(id),
  diff TEXT NOT NULL,
  validated INTEGER NOT NULL DEFAULT 0,
  validation_message TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_actions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES review_runs(id),
  finding_id TEXT,
  patch_id TEXT,
  action TEXT NOT NULL,
  timestamp TEXT NOT NULL
);
`;

/** Migrate existing databases to add fingerprint + status columns */
function migrateSchema(db: Database.Database): void {
  // Check if fingerprint column exists
  const cols = db.pragma("table_info(findings)") as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));

  if (!colNames.has("fingerprint")) {
    db.exec("ALTER TABLE findings ADD COLUMN fingerprint TEXT");
  }
  if (!colNames.has("status")) {
    db.exec("ALTER TABLE findings ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  }
}

export function createStore(dbPath: string): Store {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrateSchema(db);

  // Prepared statements
  const stmts = {
    createRun: db.prepare(
      "INSERT INTO review_runs (id, repo_path, mode, status, started_at) VALUES (?, ?, ?, 'running', ?)"
    ),
    completeRun: db.prepare(
      "UPDATE review_runs SET status = ?, completed_at = ? WHERE id = ?"
    ),
    insertFinding: db.prepare(
      "INSERT INTO findings (id, run_id, agent, category, severity, title, description, confidence, evidence_json, fingerprint, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)"
    ),
    insertEvent: db.prepare(
      "INSERT INTO events (id, run_id, type, agent, data_json, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
    ),
    insertPatch: db.prepare(
      "INSERT INTO patches (id, run_id, finding_id, diff, validated, created_at) VALUES (?, ?, ?, ?, 0, ?)"
    ),
    updatePatchValidation: db.prepare(
      "UPDATE patches SET validated = ?, validation_message = ? WHERE id = ?"
    ),
    insertUserAction: db.prepare(
      "INSERT INTO user_actions (id, run_id, finding_id, patch_id, action, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
    ),
    getFindings: db.prepare(
      "SELECT * FROM findings WHERE run_id = ? ORDER BY created_at ASC"
    ),
    getEvents: db.prepare(
      "SELECT * FROM events WHERE run_id = ? ORDER BY timestamp ASC"
    ),
    getPatch: db.prepare("SELECT * FROM patches WHERE id = ?"),
    getFindingById: db.prepare("SELECT * FROM findings WHERE id = ?"),
    getRunRepoPath: db.prepare("SELECT repo_path FROM review_runs WHERE id = ?"),
    getReviewRuns: db.prepare(`
      SELECT
        r.id, r.repo_path, r.mode, r.status, r.started_at, r.completed_at,
        COUNT(f.id) as findings_count,
        SUM(CASE WHEN f.severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN f.severity = 'high' THEN 1 ELSE 0 END) as high_count
      FROM review_runs r
      LEFT JOIN findings f ON f.run_id = r.id
      GROUP BY r.id
      ORDER BY r.started_at DESC
      LIMIT ?
    `),
    deleteRunEvents: db.prepare("DELETE FROM events WHERE run_id = ?"),
    deleteRunUserActions: db.prepare("DELETE FROM user_actions WHERE run_id = ?"),
    deleteRunPatches: db.prepare("DELETE FROM patches WHERE run_id = ?"),
    deleteRunFindings: db.prepare("DELETE FROM findings WHERE run_id = ?"),
    deleteRunRow: db.prepare("DELETE FROM review_runs WHERE id = ?"),
    // Dedup + status queries
    findingExists: db.prepare(
      "SELECT 1 FROM findings WHERE fingerprint = ? AND status = 'active' LIMIT 1"
    ),
    getRepoFindings: db.prepare(`
      SELECT f.* FROM findings f
      JOIN review_runs r ON r.id = f.run_id
      WHERE r.repo_path = ? AND f.status = 'active'
      ORDER BY f.created_at DESC
    `),
    updateFindingStatus: db.prepare(
      "UPDATE findings SET status = ? WHERE id = ?"
    ),
  };

  function now(): string {
    return new Date().toISOString();
  }

  function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
    if (json == null) return fallback;
    try {
      const parsed = JSON.parse(json);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function rowToFinding(row: any): Finding {
    return {
      id: row.id,
      category: row.category,
      severity: row.severity,
      title: row.title,
      description: row.description,
      agent: row.agent,
      confidence: row.confidence,
      evidence: safeJsonParse<Evidence[]>(row.evidence_json, []),
      fingerprint: row.fingerprint || undefined,
      status: row.status || "active",
    };
  }

  function rowToEvent(row: any): AuditEvent {
    return {
      id: row.id,
      type: row.type as EventType,
      agent: row.agent || undefined,
      timestamp: row.timestamp,
      data: safeJsonParse<Record<string, unknown>>(row.data_json, {}),
    };
  }

  function rowToPatch(row: any): Patch {
    return {
      id: row.id,
      findingId: row.finding_id,
      diff: row.diff,
      validated: Boolean(row.validated),
      validationMessage: row.validation_message || undefined,
    };
  }

  return {
    createRun(repoPath: string, mode: string): string {
      const id = randomUUID();
      stmts.createRun.run(id, repoPath, mode, now());
      return id;
    },

    completeRun(runId: string, status: "complete" | "error"): void {
      stmts.completeRun.run(status, now(), runId);
    },

    insertFinding(runId: string, finding: Omit<Finding, "id" | "patchId">): string {
      const id = `finding-${randomUUID().slice(0, 8)}`;
      const fingerprint = computeFindingFingerprint(
        finding.agent,
        finding.category,
        finding.title,
        finding.evidence
      );
      stmts.insertFinding.run(
        id,
        runId,
        finding.agent,
        finding.category,
        finding.severity,
        finding.title,
        finding.description,
        finding.confidence,
        JSON.stringify(finding.evidence),
        fingerprint,
        now()
      );
      return id;
    },

    insertEvent(
      runId: string,
      type: EventType,
      agent: AgentName | undefined,
      data: Record<string, unknown>
    ): string {
      const id = `evt-${randomUUID().slice(0, 8)}`;
      stmts.insertEvent.run(id, runId, type, agent || null, JSON.stringify(data), now());
      return id;
    },

    insertPatch(runId: string, findingId: string, diff: string): string {
      const id = `patch-${randomUUID().slice(0, 8)}`;
      stmts.insertPatch.run(id, runId, findingId, diff, now());
      return id;
    },

    updatePatchValidation(patchId: string, validated: boolean, message: string): void {
      stmts.updatePatchValidation.run(validated ? 1 : 0, message, patchId);
    },

    insertUserAction(
      runId: string,
      findingId: string | null,
      patchId: string | null,
      action: string
    ): string {
      const id = `ua-${randomUUID().slice(0, 8)}`;
      stmts.insertUserAction.run(id, runId, findingId, patchId, action, now());
      return id;
    },

    getFindings(runId: string): Finding[] {
      return (stmts.getFindings.all(runId) as any[]).map(rowToFinding);
    },

    getEvents(runId: string): AuditEvent[] {
      return (stmts.getEvents.all(runId) as any[]).map(rowToEvent);
    },

    getPatch(patchId: string): Patch | undefined {
      const row = stmts.getPatch.get(patchId) as any;
      return row ? rowToPatch(row) : undefined;
    },

    getFindingById(findingId: string): Finding | undefined {
      const row = stmts.getFindingById.get(findingId) as any;
      return row ? rowToFinding(row) : undefined;
    },

    getRunRepoPath(runId: string): string | undefined {
      const row = stmts.getRunRepoPath.get(runId) as any;
      return row?.repo_path || undefined;
    },

    getReviewRuns(limit = 50): ReviewRunSummary[] {
      const rows = stmts.getReviewRuns.all(limit) as any[];
      return rows.map((row) => ({
        id: row.id,
        repoPath: row.repo_path,
        repoName: row.repo_path.split("/").pop() || row.repo_path,
        mode: row.mode,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at || null,
        findingsCount: row.findings_count || 0,
        criticalCount: row.critical_count || 0,
        highCount: row.high_count || 0,
      }));
    },

    deleteRun(runId: string): void {
      const deleteAll = db.transaction(() => {
        stmts.deleteRunEvents.run(runId);
        stmts.deleteRunUserActions.run(runId);
        stmts.deleteRunPatches.run(runId);
        stmts.deleteRunFindings.run(runId);
        stmts.deleteRunRow.run(runId);
      });
      deleteAll();
    },

    findingExists(fingerprint: string): boolean {
      return stmts.findingExists.get(fingerprint) !== undefined;
    },

    getRepoFindings(repoPath: string): Finding[] {
      return (stmts.getRepoFindings.all(repoPath) as any[]).map(rowToFinding);
    },

    updateFindingStatus(findingId: string, status: FindingStatus): void {
      stmts.updateFindingStatus.run(status, findingId);
    },

    close(): void {
      db.close();
    },
  };
}
