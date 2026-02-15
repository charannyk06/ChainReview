<p align="center">
  <img src="media/icon.png" width="80" height="80" alt="ChainReview" />
</p>

<h1 align="center">ChainReview</h1>

<p align="center">
  Multi-agent AI code reviewer for TypeScript repositories.<br />
  Evidence-backed findings. Validated patches. Auditable chain-of-review.
</p>

<p align="center">
  <a href="https://github.com/charannyk06/ChainReview/stargazers"><img src="https://img.shields.io/github/stars/charannyk06/ChainReview?style=flat&color=6366f1&labelColor=0f0f0f" alt="Stars" /></a>
  <a href="https://github.com/charannyk06/ChainReview/blob/main/LICENSE"><img src="https://img.shields.io/github/license/charannyk06/ChainReview?style=flat&color=6366f1&labelColor=0f0f0f" alt="License" /></a>
  <a href="https://github.com/charannyk06/ChainReview/issues"><img src="https://img.shields.io/github/issues/charannyk06/ChainReview?style=flat&color=6366f1&labelColor=0f0f0f" alt="Issues" /></a>
</p>

---

## Why ChainReview

Code review today is diff-centric, inconsistent, and hard to audit. Most AI reviewers are single-agent, text-output-only, and non-replayable.

ChainReview is different:

- **Multi-agent architecture** -- five specialized agents (Architecture, Security, Bugs, Validator, Explainer) review your code, each grounding their analysis in deterministic tooling.
- **Evidence-backed findings** -- every finding includes file paths, line ranges, code snippets, and a 0-1 confidence score.
- **Validated patches** -- patches are syntax-checked against the TypeScript compiler and verified to apply cleanly.
- **Auditable chain-of-review** -- every agent action, tool call, finding, and human decision is recorded in a local SQLite database.
- **Coding agent handoff** -- send findings directly to Claude Code, Cursor, Windsurf, or GitHub Copilot for remediation.

Built on CRP (ChainReview Protocol), an open MCP-compatible tool schema.

---

## Features

### Multi-Agent Review Pipeline

Five specialized agents run during a review:

| Agent | Role |
|---|---|
| **Architecture** | Detects coupling, circular dependencies, boundary violations, and structural issues |
| **Security** | Surfaces injection risks, auth gaps, crypto issues, and data exposure |
| **Bugs** | Finds logic errors, null reference issues, race conditions, and edge cases |
| **Validator** | Independently challenges findings from other agents, reducing false positives |
| **Explainer** | Provides deep-dive explanations of findings on demand |

Agents run in parallel using `Promise.allSettled`, then the Validator challenges the combined results.

### Review Modes

- **Full Repository** -- analyzes the entire codebase with file tree, import graph, and Semgrep evidence
- **Diff Review** -- focuses on staged and unstaged Git changes for targeted PR-style feedback
- **Chat** -- ask questions about the codebase using the same CRP tools available to agents

### Real-Time Streaming UI

The Review Cockpit VS Code side panel streams agent reasoning, tool calls, thinking steps, and findings in real time. Agent messages auto-collapse when complete, showing a summary with tool icons and output preview. Expand to see full detail.

### Finding Management

Each finding card shows:
- Severity (critical/high/medium/low/info) with color-coded indicators
- Category and confidence score
- Source agent attribution
- File evidence with clickable line references
- Expandable code snippets

Actions per finding:
- **Explain** -- get a detailed breakdown from the Explainer agent
- **Generate Fix** -- produce a unified diff patch via LLM reasoning
- **Verify Fix** -- run the Validator to check if a fix resolved the issue
- **Handoff To** -- send to Claude Code, Cursor, Windsurf, GitHub Copilot, or Codex CLI
- **False Positive** -- mark and dismiss

### Patch Preview and Apply

Review proposed patches in a diff viewer inside the VS Code sidebar. Patches are validated with TypeScript syntax checking (in-memory compilation via ts-morph) and clean-apply verification before being presented.

### @Mention Agent Selection

Type `@` in the chat input to mention specific agents (`@security`, `@architecture`, `@bugs`, or `@all`). Only mentioned agents will run during a review, giving you targeted analysis.

### MCP Server Manager

Add, configure, and manage external MCP servers from the UI. Extend ChainReview with additional tool capabilities beyond the built-in CRP tools.

### Chain-of-Review Audit Trail

Eight structured event types recorded in local SQLite:

`agent_started` | `evidence_collected` | `finding_emitted` | `patch_proposed` | `patch_validated` | `human_accepted` | `human_rejected` | `false_positive_marked`

Browse the full timeline in the Audit Trail tab.

---

## Architecture

```
+------------------------------------------------------------+
|                    VS Code Extension                        |
|          (Review Cockpit Webview + Command Palette)         |
+----------------------------+-------------------------------+
                             | MCP Protocol (stdio)
+----------------------------v-------------------------------+
|                   CRP MCP Server (TypeScript)               |
|  +------------------------------------------------------+  |
|  |               Orchestrator (in-server)                |  |
|  |  +--------+ +--------+ +------+ +--------+ +-------+ |  |
|  |  | Arch.  | |Security| | Bugs | |Validator| |Explain| |  |
|  |  | Agent  | | Agent  | |Agent | | Agent  | | Agent | |  |
|  |  +--------+ +--------+ +------+ +--------+ +-------+ |  |
|  +------------------------------------------------------+  |
|  +------------------------------------------------------+  |
|  |                    Tool Backends                      |  |
|  |  +----------+ +--------+ +----------+ +-----------+  |  |
|  |  | Git/Diff | | Search | |  Import  | |  Semgrep  |  |  |
|  |  | Access   | |(ripgrep)| |  Graph   | |  Runner   |  |  |
|  |  +----------+ +--------+ +----------+ +-----------+  |  |
|  +------------------------------------------------------+  |
|  +------------------------------------------------------+  |
|  |               Local Store (SQLite)                    |  |
|  +------------------------------------------------------+  |
+------------------------------------------------------------+
```

**Data flow:**

1. User triggers review from VS Code (repository or diff mode)
2. Extension launches CRP server as a child process over stdio
3. Server collects evidence: file tree, import graph, Semgrep results, diff
4. Architecture, Security, and Bugs agents run in parallel
5. Each agent makes tool calls (file reads, searches, pattern scans) and emits structured findings
6. Validator agent challenges the combined findings, adjusting confidence scores
7. Findings, patches, and events stream to the UI via stderr JSON lines
8. All data persists to local SQLite (`~/.chainreview/chainreview.db`)

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- **VS Code** 1.90+
- **Anthropic API key** (Claude access required)
- **Semgrep** (optional, recommended) -- `pip install semgrep` or `brew install semgrep`

### Installation

```bash
git clone https://github.com/charannyk06/ChainReview.git
cd ChainReview
npm install
npm run build
```

### Configuration

Set your Anthropic API key in VS Code Settings > ChainReview, or as an environment variable:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Optionally add a Brave Search API key for web search capabilities:

```bash
export BRAVE_SEARCH_API_KEY="BSA..."
```

### Running

Press `F5` in VS Code to launch the Extension Development Host. Open any TypeScript repository, click the ChainReview icon (`</>`) in the activity bar, then click **Review Repository** or **Review Diff**.

---

## CRP Tool Reference

CRP (ChainReview Protocol) is an open, MCP-compatible tool schema. All tools are available to agents during review and to the chat interface.

### Repo Context

| Tool | Description |
|---|---|
| `crp.repo.open` | Initialize a repository for review |
| `crp.repo.tree` | Get file tree with depth and pattern filtering |
| `crp.repo.file` | Read file contents with optional line range |
| `crp.repo.search` | Ripgrep search with regex, glob, and result limits |
| `crp.repo.diff` | Git diff (staged, unstaged, or between refs) |

### Code Analysis

| Tool | Description |
|---|---|
| `crp.code.import_graph` | TypeScript import graph with cycle detection (ts-morph) |
| `crp.code.pattern_scan` | Semgrep static analysis with configurable rules |

### Patch Operations

| Tool | Description |
|---|---|
| `crp.patch.propose` | Generate a unified diff patch for a finding |
| `crp.patch.validate` | Validate patch (clean apply + TypeScript syntax check) |
| `crp.patch.apply` | Apply a validated patch to disk |
| `crp.patch.generate` | Generate fixed code using LLM reasoning |

### Review Orchestration

| Tool | Description |
|---|---|
| `crp.review.run` | Run full review pipeline (evidence + agents + validator) |
| `crp.review.cancel` | Cancel an active review |
| `crp.review.get_findings` | Query findings by run ID |
| `crp.review.get_events` | Query audit events by run ID |
| `crp.review.validate_finding` | Run validator on a single finding |
| `crp.review.record_event` | Record a chain-of-review event |

### Utilities

| Tool | Description |
|---|---|
| `crp.chat.query` | Ask a question about the repository |
| `crp.exec.command` | Run allowlisted shell commands (wc, find, ls, grep, git, tsc, npm) |
| `crp.web.search` | Web search via Brave Search API |

---

## VS Code Settings

| Setting | Type | Description |
|---|---|---|
| `chainreview.anthropicApiKey` | String | Anthropic API key for Claude access |
| `chainreview.braveSearchApiKey` | String | Brave Search API key (optional, enables web search) |
| `chainreview.mcpServers` | Array | External MCP server configurations |

### MCP Server Configuration

Add external MCP servers through the MCP Manager tab or directly in settings:

```json
{
  "chainreview.mcpServers": [
    {
      "id": "my-server",
      "name": "My MCP Server",
      "command": "node",
      "args": ["path/to/server.js"],
      "env": { "API_KEY": "..." },
      "enabled": true
    }
  ]
}
```

---

## Privacy and Security

ChainReview is local-first by design.

- **Semgrep runs locally.** No code is sent to external scanning services.
- **Code snippets are sent to the Anthropic API** for agent reasoning. Only targeted snippets and metadata are sent, not entire files.
- **Secrets redaction** strips common patterns (API keys, tokens, passwords) from snippets before they reach the model.
- **All review data is stored locally** in SQLite at `~/.chainreview/chainreview.db`. No telemetry, no analytics.
- **No destructive actions** without explicit user approval. Patches require manual "Apply" confirmation.
- **Path traversal protection** prevents patch operations from writing outside the repository boundary.

---

## Project Structure

```
src/
  extension/                VS Code extension host
    extension.ts            Entry point, command registration, server lifecycle
    webview-provider.ts     Review Cockpit webview provider, coding agent handoff
    mcp-client.ts           MCP client (stdio transport, event streaming)

  server/                   CRP MCP Server
    server.ts               MCP server with 20+ tool registrations
    orchestrator.ts         Review pipeline (evidence, parallel agents, validator)
    store.ts                SQLite store (better-sqlite3, WAL mode, 5 tables)
    chat.ts                 Chat query handler with patch generation
    agents/
      base-agent.ts         Agent loop framework (tool calling, thinking, abort)
      architecture.ts       Architecture Agent
      security.ts           Security Agent
      bugs.ts               Bugs Agent
      validator.ts          Validator Agent (challenge mode)
      explainer.ts          Explainer Agent (on-demand deep-dive)
    tools/
      repo.ts               Git, file tree, search, diff
      code.ts               Import graph (ts-morph), Semgrep runner
      patch.ts              Patch propose, validate, apply, generate
      audit.ts              Event recording
      exec.ts               Allowlisted shell commands
      web.ts                Web search (Brave Search API)
      redact.ts             Secrets redaction

  webview/                  React UI (Review Cockpit)
    App.tsx                 Main app with tab navigation
    components/
      layout/               Header, TabNav, EmptyState
      chat/                 Chat interface, messages, tool calls, @mention input
      review/               Findings grid, finding cards, patch preview, diff viewer
      timeline/             Audit trail timeline
      mcp/                  MCP server manager (add/edit/toggle servers)
      history/              Task history
      shared/               File references, handoff menu, buttons
    hooks/                  useVSCodeAPI, useReviewState
    lib/                    Types, constants, utilities
    contexts/               OpenFileContext

media/
  icon.svg                  Activity bar icon (monochrome)
  icon.png                  Extension marketplace icon (128x128)
```

---

## Development

### Build

```bash
npm install
npm run build
```

Three build targets:
- `npm run build:webview` -- Vite (React)
- `npm run build:extension` -- esbuild (VS Code extension)
- `npm run build:server` -- esbuild (CRP MCP server)

### Watch Mode

```bash
npm run dev    # concurrent watch for extension + webview
```

### Test

```bash
npm run test              # run all tests
npm run test:security     # security-specific tests
```

### Tech Stack

| Layer | Technology |
|---|---|
| Extension | VS Code Extension API, esbuild |
| Server | Node.js, MCP SDK, better-sqlite3, ts-morph, simple-git |
| UI | React 18, Motion (Framer Motion), Lucide Icons, inline CSS |
| Build | Vite 6, esbuild, TypeScript 5.7 |
| LLM | Anthropic Claude API (Claude Opus 4.6 for agents) |
| Static Analysis | Semgrep (local) |

### Database

SQLite at `~/.chainreview/chainreview.db` with five tables:

| Table | Purpose |
|---|---|
| `review_runs` | Track each review session (path, mode, status, timestamps) |
| `findings` | Agent findings with evidence, severity, confidence |
| `events` | Chain-of-review audit trail |
| `patches` | Proposed and validated patches |
| `user_actions` | Human accept/reject/false-positive decisions |

---

## Roadmap

- CLI tool for CI/CD integration
- GitHub PR commenting and draft PR creation
- Duplication detection via AST fingerprints
- Multi-language support beyond TypeScript
- Custom agent creation

---

## License

[Apache License 2.0](LICENSE)

---

## Acknowledgments

Built for the **Built with Claude: Claude Code Hackathon** by Anthropic.

Powered by [Claude](https://anthropic.com) for agent reasoning. Uses the [Model Context Protocol](https://modelcontextprotocol.io) for tool integration, [Semgrep](https://semgrep.dev) for static analysis, and [ts-morph](https://github.com/dsherret/ts-morph) for TypeScript AST analysis.
