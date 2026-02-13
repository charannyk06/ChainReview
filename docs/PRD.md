# PRD v1.0 — ChainReview (Advanced Repo-Scale AI Code Reviewer)

---

## 0) Product Name and One-liner

**Name:** ChainReview

**Protocol:** CRP (ChainReview Protocol) — open, MCP-compatible review tool schema

**One-liner:**
ChainReview is an advanced, repo-scale AI code reviewer for TypeScript repositories, built with Claude Code + Opus 4.6, featuring multi-agent review, evidence-backed findings, validated patch proposals, and an auditable chain-of-review.

---

## 1) Hackathon Context and Hard Constraints

This project is built for the **Built with Opus 4.6: Claude Code Hackathon**.

### Hard rules we must satisfy

- **Open Source:** Everything shown in the demo is fully open source under an approved OSI license.
- **New work only:** Repo started from scratch during the hackathon window (no pre-existing project code).
- **Team size:** Max 2 members.
- **Submission:** 3-minute demo video + OSS repo link + 100-200 word write-up.

### Implementation decisions (confirmed)

| Decision | Choice |
|---|---|
| Demo surface | VS Code extension only (CLI later) |
| Language support | TypeScript/JavaScript only |
| MCP server stack | TypeScript |
| Scope | CRP-lite only (no duplication v1 in MVP) |
| Repo workflow | Local-first dev, publish to GitHub when stable |
| Scanning | Semgrep yes (plus optional standard tooling only if low friction) |
| License | Apache-2.0 |
| LLM provider | No Ollama — demo uses Opus 4.6 |

---

## 2) Problem Statement

Code review today is:

- **Diff-centric** — misses repo-level architectural issues
- **Inconsistent** — depends on reviewer experience
- **Hard to audit** — no structured evidence trail
- **Hard to improve** — no analytics about false positives, repeat issues

Most existing AI reviewers are:

- Single-agent
- Text-output-only
- Non-replayable and hard to trust

---

## 3) Vision

Build an advanced code reviewer (not an app builder) that:

- Uses **Opus 4.6** for repo-scale reasoning across a TS repository
- **Grounds reasoning** in deterministic tooling via CRP
- Provides **structured findings** with confidence + evidence
- Proposes **small, targeted patches** and validates them before user applies
- Records a **chain-of-review audit trail** (agent + human decisions)

**Positioning:** Review-first, fix-second.

---

## 4) Target Users and Use Cases

### Primary users (MVP)

- Individual developers and small teams working in TypeScript repos
- OSS maintainers (triaging PRs, consistency, security hotspots)

### MVP use cases

1. "Review this repo / PR diff and identify top architecture and security issues."
2. "Propose a safe patch for one high-confidence issue."
3. "Validate the patch and show me a clean preview inside VS Code."
4. "Track what the reviewer said + what I accepted/rejected."

---

## 5) Non-goals (explicit)

- Not a code/app writer or scaffolder
- No auto-merge, no destructive actions
- No complex auth/SSO/roles in MVP
- No full web dashboard (minimal local history view only)
- No multi-language support in MVP
- No duplication module in MVP (future)

---

## 6) Product Scope and Key Features (MVP)

### 6.1 VS Code "Review Cockpit" (Primary UX)

A side panel that supports:

- **Select mode:** Repo review or Diff review
- **Run review:** "Send to Agents"
- **Show findings** grouped by category:
  - Architecture
  - Security
  - Bugs/Logic
- **Show evidence** per finding:
  - File path + line range + snippet
  - Confidence score
- **Actions:**
  - Explain
  - Propose patch
  - Send to validator
  - Apply patch locally
  - Mark false positive

### 6.2 Multi-agent Review (MVP agents)

#### 1. Architecture Agent

- Finds coupling, cycles, boundary violations, "smells" that require repo context
- Evidence via import graph + targeted file reads

#### 2. Security Agent

- Uses Semgrep output as evidence and Opus to prioritize + explain impact/remediation

#### 3. Validator Agent

- Challenges top findings and validates proposed patch (apply clean + basic sanity)

### 6.3 Validated Patch Proposals (Opt-in)

For 1 selected finding:

1. Generate a unified diff patch proposal
2. Run validation checks
3. Present patch preview in VS Code
4. Apply only with explicit user click

### 6.4 Chain-of-Review (Audit Trail)

Record structured events:

| Event | Description |
|---|---|
| `agent_started` | Agent begins review phase |
| `evidence_collected` | Deterministic tool output gathered |
| `finding_emitted` | Agent produces a structured finding |
| `patch_proposed` | Patch diff generated for a finding |
| `patch_validated` | Validator confirms patch is clean |
| `human_accepted` | User accepts finding or patch |
| `human_rejected` | User rejects finding or patch |
| `false_positive_marked` | User flags finding as false positive |

This enables later analytics, even if analytics UI is minimal now.

---

## 7) CRP (ChainReview Protocol) Definition

### Purpose

CRP is an open, MCP-compatible tool schema that provides deterministic code context and review actions.

### CRP-lite Tool Set (MVP)

#### Repo context

| Tool | Description |
|---|---|
| `crp.repo.open` | Open/initialize a repository for review |
| `crp.repo.tree` | Get repository file tree |
| `crp.repo.file` | Read file contents |
| `crp.repo.search` | Search across repository |
| `crp.repo.diff` | Get diff (staged, unstaged, or between refs) |

#### Structure + scanning

| Tool | Description |
|---|---|
| `crp.code.import_graph` | TS-focused import graph (via TS compiler API or tree-sitter) |
| `crp.code.pattern_scan` | Run Semgrep pattern scan |

#### Patch + validation

| Tool | Description |
|---|---|
| `crp.patch.propose` | Generate a unified diff patch |
| `crp.patch.validate` | Validate patch (apply clean + sanity checks) |

#### Audit

| Tool | Description |
|---|---|
| `crp.review.record_event` | Record a chain-of-review event |

### CRP Design Principles

- **Evidence-first outputs** — file, range, snippet
- **Small, structured responses** — no full AST dumps
- **Replayable tool calls** — logged
- **Model-agnostic by design** — even if demo uses Opus

---

## 8) Technical Architecture

### Components

```
┌──────────────────────────────────────────────────────────┐
│                   VS Code Extension                       │
│              (UI + triggers + Review Cockpit)              │
└─────────────────────┬────────────────────────────────────┘
                      │ MCP protocol
┌─────────────────────▼────────────────────────────────────┐
│                  CRP MCP Server (TypeScript)               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Orchestrator (MVP: in-server)            │  │
│  │  ┌───────────┐ ┌──────────┐ ┌───────────────┐       │  │
│  │  │ Arch Agent│ │ Sec Agent│ │Validator Agent │       │  │
│  │  └───────────┘ └──────────┘ └───────────────┘       │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                  Tool Backends                        │  │
│  │  ┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │ Git/Diff │ │ Search │ │ Import   │ │ Semgrep  │  │  │
│  │  │ Access   │ │(ripgrep)│ │ Graph    │ │ Runner   │  │  │
│  │  └──────────┘ └────────┘ └──────────┘ └──────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Local Store (SQLite)                      │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

1. **VS Code extension** — UI + triggers
2. **CRP MCP server** — TypeScript
3. **Orchestrator** — inside MCP server for MVP
4. **Tool backends:**
   - Git/diff access
   - Search (ripgrep wrapper)
   - Import graph extractor (TS compiler API / ts-morph / tree-sitter)
   - Semgrep runner
5. **Local store** — SQLite

### Data flow

1. VS Code → MCP server: start review (repo/diff)
2. Server collects evidence once (graph + scan + diff)
3. Agents run (Opus 4.6) using evidence + targeted snippets
4. Findings + patch proposal returned to UI
5. Validator runs checks, returns go/no-go
6. Events stored locally

---

## 9) Data Storage (MVP)

### SQLite tables

| Table | Purpose |
|---|---|
| `review_runs` | Track each review session |
| `findings` | Store agent findings with evidence |
| `events` | Chain-of-review audit events |
| `patches` | Proposed and validated patches |
| `user_actions` | Human accept/reject/false-positive actions |

### Privacy default

- Store minimal snippets + metadata
- Do not store whole repo contents by default

---

## 10) Security and Safety

- No destructive actions without user approval
- Patch apply is explicit
- Secrets redaction before sending snippets to model (basic patterns)
- Semgrep runs locally

---

## 11) Licensing and OSS Compliance

- **License:** Apache-2.0
- **All demo components open source in repo:**
  - VS Code extension code
  - MCP/CRP server code
  - Orchestrator logic
  - Schemas/specs
  - Any local UI assets

### Model usage

- Demo uses Opus 4.6 via API (documented as an external dependency)

---

## 12) Demo Plan (3-minute, judge-optimized)

| Scene | Duration | Content |
|---|---|---|
| Scene 1 | 20s | Show VS Code panel + "Review repo" |
| Scene 2 | 40s | Architecture agent surfaces repo-level issue (with evidence + import graph) |
| Scene 3 | 40s | Security agent surfaces Semgrep-backed issue + Opus reasoning |
| Scene 4 | 50s | Select one finding → propose patch → validator confirms → preview diff |
| Scene 5 | 30s | Apply patch locally + chain-of-review timeline entry |
| Close | 10s | "All open-source, built during hackathon, CRP is MCP-compatible." |

**Total: ~3 minutes**

---

## 13) Milestones (3-day plan)

### Day 1

- New repo, Apache-2.0
- MCP server skeleton + CRP endpoints for repo tree/file/search/diff
- VS Code extension skeleton panel

### Day 2

- TS import graph extraction
- Semgrep runner integration + structured finding format
- Agents producing JSON findings + event logging

### Day 3

- Patch propose + validate loop
- Validator agent + UI actions
- Polish demo repo + record demo video + write-up

---

## 14) Success Metrics (MVP)

- Finds at least:
  - **1 architecture risk** (coupling/cycle/boundary)
  - **1 security issue** (Semgrep evidence + Opus explanation)
  - **1 logic/bug-risk item**
- Generates and validates **one patch end-to-end**
- Review run is **repeatable** and produces **consistent structured output**

---

## 15) Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Rule ambiguity on "models open source" | Everything we ship is OSS; model is external dependency; avoid any proprietary wrappers; keep provider interface clean |
| Latency | Evidence computed once; send targeted snippets; cap outputs |
| False positives | Validator agent + confidence thresholds |
| Scope creep | No CLI, no GitHub comments, no dashboard, no duplication |

---

## 16) Out of Scope (Post-hackathon)

- CLI tool
- GitHub PR commenting and draft PR creation
- Duplication v1 (AST fingerprints)
- Analytics dashboard
- Multi-repo support

---

*PRD v1.0 — Locked. All implementation decisions confirmed.*
