import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import type {
  Finding,
  Patch,
  AuditEvent,
  AgentName,
  EventType,
  Evidence,
} from "./types";

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
  close(): void;
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

export function createStore(dbPath: string): Store {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  // Prepared statements
  const stmts = {
    createRun: db.prepare(
      "INSERT INTO review_runs (id, repo_path, mode, status, started_at) VALUES (?, ?, ?, 'running', ?)"
    ),
    completeRun: db.prepare(
      "UPDATE review_runs SET status = ?, completed_at = ? WHERE id = ?"
    ),
    insertFinding: db.prepare(
      "INSERT INTO findings (id, run_id, agent, category, severity, title, description, confidence, evidence_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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

    close(): void {
      db.close();
    },
  };
}
