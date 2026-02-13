<p align="center">
  <img src="media/icon.png" width="64" height="64" alt="ChainReview" />
</p>

<h1 align="center">ChainReview</h1>

<p align="center">
  Advanced repo-scale AI code reviewer for TypeScript repositories.
  <br />
  Multi-agent review. Evidence-backed findings. Validated patches. Auditable chain-of-review.
</p>

<p align="center">
  <a href="https://github.com/charannyk06/ChainReview/stargazers"><img src="https://img.shields.io/github/stars/charannyk06/ChainReview?style=flat&color=6366f1&labelColor=0f0f0f" alt="GitHub Stars" /></a>
  <a href="https://github.com/charannyk06/ChainReview/blob/main/LICENSE"><img src="https://img.shields.io/github/license/charannyk06/ChainReview?style=flat&color=6366f1&labelColor=0f0f0f" alt="License" /></a>
  <a href="https://github.com/charannyk06/ChainReview/issues"><img src="https://img.shields.io/github/issues/charannyk06/ChainReview?style=flat&color=6366f1&labelColor=0f0f0f" alt="Issues" /></a>
  <a href="https://github.com/charannyk06/ChainReview/pulls"><img src="https://img.shields.io/github/issues-pr/charannyk06/ChainReview?style=flat&color=6366f1&labelColor=0f0f0f" alt="Pull Requests" /></a>
  <a href="https://github.com/charannyk06/ChainReview/actions"><img src="https://img.shields.io/github/actions/workflow/status/charannyk06/ChainReview/pr-title-check.yml?style=flat&color=6366f1&labelColor=0f0f0f&label=CI" alt="CI Status" /></a>
</p>

---

## Table of Contents

- [Why ChainReview](#why-chainreview)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [CRP Tool Reference](#crp-tool-reference)
- [Configuration](#configuration)
- [Privacy and Security](#privacy-and-security)
- [Project Structure](#project-structure)
- [Development](#development)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Why ChainReview

Code review today is diff-centric, inconsistent, and hard to audit. Most existing AI reviewers are single-agent, text-output-only, and non-replayable.

ChainReview takes a different approach:

- **Multi-agent architecture** -- three specialized agents (Architecture, Security, Validator) review your code in parallel, each grounding their analysis in deterministic tooling rather than guesswork.
- **Evidence-backed findings** -- every finding includes file paths, line ranges, code snippets, and a 0-1 confidence score. No vague suggestions.
- **Validated patch proposals** -- patches are syntax-checked against the TypeScript compiler and verified to apply cleanly before you see them.
- **Auditable chain-of-review** -- every agent action, tool call, finding, and human decision is recorded as a structured event in a local SQLite database. Reviews are replayable and analyzable.

ChainReview is built on CRP (ChainReview Protocol), an open, MCP-compatible tool schema that separates deterministic code context from LLM reasoning.

---

## Features

**Multi-Agent Review** -- Architecture Agent detects coupling, circular dependencies, and boundary violations. Security Agent surfaces injection risks, auth gaps, and crypto issues. Validator Agent independently challenges findings and reduces false positives.

**Two Review Modes** -- Full repository review analyzes the entire codebase. Diff review focuses on staged and unstaged changes for targeted PR-style feedback.

**Evidence Collection Pipeline** -- File tree extraction, TypeScript import graph analysis via ts-morph, Semgrep static analysis, and Git diff parsing all run before agents begin. Agents work from structured evidence, not raw file dumps.

**Patch Generation and Validation** -- Generate unified diff patches for any finding. Patches are validated with TypeScript syntax checking (in-memory compilation via ts-morph) and clean-apply verification before being presented to you.

**Patch Preview and Apply** -- Review proposed patches in a dedicated diff viewer inside the VS Code sidebar. Apply validated patches to disk with a single click.

**Chain-of-Review Audit Trail** -- Eight structured event types (`agent_started`, `evidence_collected`, `finding_emitted`, `patch_proposed`, `patch_validated`, `human_accepted`, `human_rejected`, `false_positive_marked`) recorded in local SQLite for every review run.

**Real-Time Streaming** -- Agent reasoning, tool calls, thinking steps, and findings stream to the UI in real time. No waiting for the full review to complete before seeing results.

**Chat Interface** -- Ask questions about the codebase directly in the Review Cockpit. The same CRP tools available to agents are available to the chat handler.

**MCP Server Manager** -- Add, configure, and manage external MCP servers from the UI. Extend ChainReview with additional tool capabilities.

**Coding Agent Handoff** -- Send findings directly to Cursor, Windsurf, GitHub Copilot, or Claude Code with pre-formatted context for immediate remediation.

---

## Architecture

```
+------------------------------------------------------------+
|                    VS Code Extension                        |
|               (UI + Triggers + Review Cockpit)              |
+----------------------------+-------------------------------+
                             | MCP Protocol (stdio)
+----------------------------v-------------------------------+
|                   CRP MCP Server (TypeScript)               |
|  +------------------------------------------------------+  |
|  |               Orchestrator (in-server)                |  |
|  |  +--------------+ +-------------+ +----------------+ |  |
|  |  | Architecture | |  Security   | |   Validator    | |  |
|  |  |    Agent     | |    Agent    | |     Agent      | |  |
|  |  +--------------+ +-------------+ +----------------+ |  |
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
4. Architecture and Security agents run in parallel using `Promise.allSettled`
5. Each agent makes tool calls (file reads, searches, pattern scans) and emits structured findings
6. Validator agent challenges the combined findings, adjusting confidence scores
7. Findings, patches, and events stream to the UI via stderr JSON lines
8. All data persists to local SQLite (`~/.chainreview/chainreview.db`)

---

## Quick Start

### Prerequisites

- **Node.js** 18 or later
- **VS Code** 1.90 or later
- **Anthropic API key** (Claude access required)
- **Semgrep** (optional, recommended) -- `pip install semgrep` or `brew install semgrep`

### Installation

1. Clone and build:

```bash
git clone https://github.com/charannyk06/ChainReview.git
cd ChainReview
npm install
npm run build
```

2. Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

3. Open the project in VS Code and press `F5` to launch the Extension Development Host.

4. In the new VS Code window, open any TypeScript repository and click the ChainReview icon in the activity bar.

5. Click **Review Repo** or **Review Diff** to start a review.

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
| `crp.code.import_graph` | TypeScript import graph with cycle detection (via ts-morph) |
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

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude access |
| `BRAVE_SEARCH_API_KEY` | No | Brave Search API key (enables `crp.web.search`) |

### VS Code Settings

| Setting | Type | Description |
|---|---|---|
| `chainreview.mcpServers` | Array | External MCP server configurations |

### MCP Server Configuration

Add external MCP servers through the MCP Manager tab in the Review Cockpit, or directly in VS Code settings:

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

ChainReview is designed with a local-first architecture.

- **Semgrep runs locally.** No code is sent to external scanning services.
- **Code snippets are sent to the Anthropic API** for agent reasoning. Only targeted snippets and metadata are sent, not entire files or repositories.
- **Secrets redaction** strips common patterns (API keys, tokens, passwords) from snippets before they reach the model.
- **All review data is stored locally** in SQLite at `~/.chainreview/chainreview.db`. No external storage, no telemetry, no analytics collection.
- **No destructive actions** without explicit user approval. Patches require manual "Apply" confirmation.
- **Path traversal protection** prevents patch operations from writing outside the repository boundary.

---

## Project Structure

```
src/
  extension/                VS Code extension host
    extension.ts            Entry point, command registration, server lifecycle
    webview-provider.ts     Review Cockpit webview provider
    mcp-client.ts           MCP client (stdio transport, event streaming)

  server/                   CRP MCP Server
    server.ts               MCP server with 20+ tool registrations
    orchestrator.ts         Review pipeline (evidence collection, parallel agents, validator)
    store.ts                SQLite store (better-sqlite3, WAL mode, 5 tables)
    chat.ts                 Chat query handler
    types.ts                Server-side type definitions
    agents/
      base-agent.ts         Agent loop framework (tool calling, thinking, abort support)
      architecture.ts       Architecture Agent
      security.ts           Security Agent
      validator.ts          Validator Agent (challenge mode)
    tools/
      repo.ts               Git, file tree, search, diff
      code.ts               Import graph (ts-morph), Semgrep runner
      patch.ts              Patch propose, validate, apply
      audit.ts              Event recording
      exec.ts               Allowlisted shell commands
      web.ts                Web search
      redact.ts             Secrets redaction

  webview/                  React UI (Review Cockpit)
    App.tsx                 Main app with tab navigation
    components/
      layout/               Header, TabNav, EmptyState
      chat/                 Chat interface, messages, tool call rendering
      review/               Findings grid, finding cards, patch preview, diff viewer
      timeline/             Audit trail timeline
      mcp/                  MCP server manager
    hooks/                  useVSCodeAPI, useReviewState
    lib/                    Types, constants, utilities

docs/
  PRD.md                    Product Requirements Document (v1.0)

media/
  icon.svg                  Extension icon
```

---

## Development

### Build

```bash
# Install dependencies
npm install

# Build all targets (webview, extension, server)
npm run build

# Or build individually
npm run build:webview     # Vite build (React + Tailwind)
npm run build:extension   # esbuild (VS Code extension)
npm run build:server      # esbuild (CRP MCP server)
```

### Watch Mode

```bash
# Concurrent watch for extension + webview
npm run dev
```

### Run

Press `F5` in VS Code to launch the Extension Development Host with the extension loaded.

### Tech Stack

| Layer | Technology |
|---|---|
| Extension | VS Code Extension API, esbuild |
| Server | Node.js, MCP SDK, better-sqlite3, ts-morph, simple-git |
| UI | React 18, Tailwind CSS 4, Motion (Framer Motion), Lucide Icons |
| Build | Vite 6, esbuild, TypeScript 5.7 |
| LLM | Anthropic Claude API (claude-haiku-4-5 for agents, claude-opus-4-6 for validation) |
| Static Analysis | Semgrep (local) |

### Database

SQLite database at `~/.chainreview/chainreview.db` with five tables:

| Table | Purpose |
|---|---|
| `review_runs` | Track each review session (path, mode, status, timestamps) |
| `findings` | Agent findings with evidence, severity, confidence |
| `events` | Chain-of-review audit trail |
| `patches` | Proposed and validated patches |
| `user_actions` | Human accept/reject/false-positive decisions |

---

## Contributing

Contributions are welcome. Please open an issue to discuss significant changes before submitting a pull request.

```bash
# Clone the repository
git clone https://github.com/charannyk06/ChainReview.git
cd ChainReview

# Install dependencies
npm install

# Start development
npm run dev

# Build and test
npm run build
```

If you find a bug or have a feature request, please [open an issue](https://github.com/charannyk06/ChainReview/issues).

---

## Roadmap

The following items are planned for post-MVP development:

- CLI tool for CI/CD integration
- GitHub PR commenting and draft PR creation
- Duplication detection via AST fingerprints
- Analytics dashboard for review insights
- Multi-language support beyond TypeScript
- Multi-repository review support

---

## License

ChainReview is licensed under the [Apache License 2.0](LICENSE).

---

## Acknowledgments

ChainReview was built for the **Built with Opus 4.6: Claude Code Hackathon** by Anthropic.

Built with [Claude Code](https://claude.ai) and powered by [Claude](https://anthropic.com) for agent reasoning. Uses the [Model Context Protocol](https://modelcontextprotocol.io) for tool integration, [Semgrep](https://semgrep.dev) for static analysis, and [ts-morph](https://github.com/dsherret/ts-morph) for TypeScript AST analysis.
