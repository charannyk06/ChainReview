# Conversation Memory & Multi-Turn Context: Architecture Patterns from Open-Source AI Chat Applications

**Research Date:** 2026-02-15
**Scope:** 7 open-source projects analyzed, cross-referenced with industry best practices
**Purpose:** Inform ChainReview's conversation memory architecture for its VS Code extension + MCP server

---

## Executive Summary

After analyzing LibreChat, Open WebUI, LobeChat, Chatbot UI, Jan, Continue.dev, and Cline/Roo Code, a clear set of architectural patterns emerges. The most relevant pattern for ChainReview (VS Code extension calling Claude API via MCP server) is the **Cline/Roo Code dual-history model** combined with **LibreChat's reverse-iterate token budgeting**. The recommended approach is:

1. **Flat JSON file per session** for persistence (not SQLite for messages -- reserve SQLite for structured review data)
2. **Reverse-iterate message inclusion** with a token budget ceiling
3. **Auto-condensation** (LLM-generated summary) when context exceeds threshold
4. **Dual message arrays**: one for UI display (rich blocks), one for API submission (role/content only)

---

## 1. Project-by-Project Analysis

### 1.1 LibreChat

**Storage:** MongoDB (primary) + Redis (caching) + PostgreSQL/pgvector (RAG embeddings) + MeiliSearch (full-text search)

**Conversation History Model:**
- Messages stored in MongoDB with a **tree structure** supporting conversation forking (branching responses)
- Each message references a parent, enabling users to branch conversations at any point
- Conversations collection stores session metadata, model config, and archived state

**How History Is Sent to LLM:**
- `BaseClient.loadHistory()` retrieves messages by traversing the conversation tree
- `BaseClient.buildMessages()` applies token limits -- **each provider (OpenAI, Anthropic, Google) has its own implementation**
- `getMessagesWithinTokenLimit()` iterates **backwards** through messages, accumulating tokens until hitting the model's max. This is the core pattern -- reverse iteration with a running token count

**Token Budget Management:**
- Per-provider token counting (accurate for OpenAI, conservative estimate for others)
- Model-specific context windows loaded from config
- Balance system tracks token credit consumption with `balance.enabled`
- Transaction records stored in database for usage auditing

**Cross-Conversation Memory:**
- Separate "Memory System" extracts persistent user facts (preferences, context)
- Memory entries embedded via configurable models, stored with pgvector
- Memory context injected as: `sharedRunContext + baseInstructions + mcpInstructions`
- Agent-level memory accumulates domain knowledge across sessions

**Key Pattern:** Reverse-iterate token budgeting with provider-specific formatters.

---

### 1.2 Open WebUI

**Storage:** Relational database (Chats table) + vector database per user (for memory embeddings)

**Conversation History Model:**
- Hierarchical tree structure in Chats table supporting conversation branching
- Complete message history persisted -- no client-side truncation at storage level
- Dual-storage: structured data in relational DB, vector embeddings in dedicated collection

**How History Is Sent to LLM:**
- Sequential middleware pipeline enriches messages before sending:
  1. Memory retrieval (semantic search over user facts)
  2. Web search (optional dynamic context)
  3. RAG processing (document chunks as XML-tagged sources)
  4. Tool execution results
  5. Final augmented messages to model
- Memory context appended to system messages with `"User Context:"` prefix and numbered entries with timestamps

**Token Budget Management:**
- `process_chat_payload()` preprocesses requests
- Token limits and max turns configurable, with **system message excluded** from truncation
- Delegates context window management primarily to the LLM provider

**Key Pattern:** Middleware pipeline for context injection; tiered memory (T0 short-term, T1 medium, T2 long-term).

---

### 1.3 LobeChat

**Storage:** PostgreSQL + PGVector (via Drizzle ORM), with PGlite WASM for offline mode

**Conversation History Model:**
- `messages` table: individual messages with `id`, `parent_id`, `content`, `reasoning`
- `topics` table: logical conversation groupings
- `threads` table: conversation branching via `source_message_id` and `type`
- `thread_items` table: links threads to specific messages

**How History Is Sent to LLM:**
- `ChatStore` (zustand) manages active conversation state
- `@lobechat/context-engine` package handles prompt building
- `messagesToText` utilities convert message arrays to structured text for API submission
- Streaming via SSE for all models

**Token Budget Management:**
- Prompt caching supported natively (Claude 3.5, Gemini 1.5)
- Token usage statistics tracked per conversation
- Historical message count configurable in settings (though token counting reportedly calculates against all messages, not just the selected window)

**State Management:**
- Zustand stores for client-side state
- Dual persistence: LocalStorage for UI state, database for data
- Optimistic updates with eventual server reconciliation
- SWR integration for automatic caching and revalidation

**Key Pattern:** Zustand + database dual persistence; topic-based session organization.

---

### 1.4 Chatbot UI

**Storage:** Supabase (PostgreSQL) -- migrated from localStorage in v2.0

**Conversation History Model:**
- Migration file `supabase/migrations/20240108234540_setup.sql` defines schema
- Messages and chats stored in Postgres tables
- Chat history, custom prompts, and configurations persist across devices

**How History Is Sent to LLM:**
- Full conversation history sent (with model-specific token limits)
- Next.js frontend manages message state

**Token Budget Management:**
- Model-specific max token limits
- No sophisticated truncation documented -- relies on model's context window

**Key Pattern:** Simple Postgres persistence; full history approach relying on large context windows.

---

### 1.5 Jan

**Storage:** Local filesystem -- pure JSON files per thread

**Conversation History Model:**
- `~/jan/threads/[thread_id]/messages.jsonl` -- one JSON object per line
- `~/jan/threads/[thread_id]/thread.json` -- thread metadata
- Message schema:
  ```json
  {
    "id": "msg_xxx",
    "thread_id": "thread_xxx",
    "role": "user|assistant",
    "type": "text",
    "status": "ready",
    "content": [{ "type": "text", "text": { "value": "...", "annotations": [] } }],
    "created_at": 1700000000000,
    "completed_at": 1700000001000,
    "metadata": { "tokenSpeed": { "count": 150, "rate": 45.2 } }
  }
  ```

**How History Is Sent to LLM:**
- OpenAI-compatible API format
- Full thread history sent per request
- Thread settings (model, temperature, etc.) stored in thread.json

**Token Budget Management:**
- Token speed tracked per message (count + generation rate)
- No documented automatic truncation -- relies on model context window

**Key Pattern:** JSONL append-only files for local-first storage; OpenAI-compatible message format.

---

### 1.6 Continue.dev

**Storage:** `~/.continue/` directory with history.ts module; Redux state with localStorage persistence

**Conversation History Model:**
- Chat sessions persisted via Redux state hydration from localStorage
- `history.ts` module manages ordered, searchable session history
- Global context stored at `~/.continue/index/globalContext.json`
- Both JSON and SQLite logging implementations exist

**How History Is Sent to LLM:**
- `resolveInput.ts` converts input to string, concatenating prompts, text, and context items
- `IdeMessenger` handles communication between GUI and extension
- Core binary processes messages through LLM module with tokenization utilities
- Context providers (@search, @tree, @url, @issue) inject additional context

**Token Budget Management:**
- `LlmInfo` types store `contextLength` and `maxCompletionTokens` per model
- Token usage statistics displayed to users
- No documented automatic truncation -- context managed through manual session resets

**Key Pattern:** Context providers for selective injection; Redux + localStorage for persistence.

---

### 1.7 Cline / Roo Code (Most Relevant)

**Storage:** File system per task -- `tasks/[ulid]/api_conversation_history.json` + `tasks/[ulid]/ui_messages.json`

**Conversation History Model -- DUAL ARRAY ARCHITECTURE:**

```
UI Messages (ClineMessage[])          API Messages (ApiMessage[])
------------------------------        -----------------------------
- Rich formatting                     - Anthropic/OpenAI standard format
- Timestamps, message types           - role: user | assistant
- "say"/"ask" subtypes                - content arrays (text, images,
- Streaming indicators                  tool_use, tool_result)
- User-facing metadata                - Reasoning blocks
                                      - Cache breakpoints
```

This is the most important pattern: **two separate arrays serving different purposes**.

**How History Is Sent to LLM:**
- `ContextManager` builds optimized prompts integrating:
  - System prompts + custom `.clinerules`
  - Workspace context (relevant files, structure)
  - Full API conversation history
  - Task-specific settings
- `MessageStateHandler` maintains mutex-protected conversation state
- Recursive API requests: tool response -> append to history -> next API call

**Token Budget Management -- THE MOST SOPHISTICATED:**

1. **Context Window Calculation:**
   ```typescript
   maxAllowedSize = Math.max(contextWindow - 40_000, contextWindow * 0.8)
   ```
   Guarantees either a fixed 40K-token reserve for larger windows or 20% buffer for smaller ones.

2. **Model-Specific Budgets:**
   - Claude (200K tokens): 160K usable, 40K buffer
   - DeepSeek (64K tokens): 37K usable, 27K buffer
   - Standard (128K tokens): 98K usable, 30K buffer

3. **Smart Truncation:**
   - Always preserves the initial task message (first user message)
   - Removes messages in **pairs** (user+assistant) to maintain alternating pattern
   - Standard truncation: removes 50% of history
   - Downgrade to smaller model: removes 75% of history
   - Upscale to larger model: removes 50%

4. **Deduplication:**
   - Replaces redundant file reads with `[DUPLICATE FILE READ]` notice
   - Tracks `contextHistoryUpdates` map for message modifications over time

5. **Auto-Condensation (v2):**
   - When `useAutoCondense` is enabled, generates LLM summary of truncated history instead of discarding
   - Smart code folding maintains ~50K character budget of function signatures and type definitions
   - `willManageContext()` predicts when condensation needed
   - AI-powered conversation summarization preserves critical context

6. **Message Validation:**
   - `tool_result` blocks validated against corresponding `tool_use` blocks
   - Orphaned results removed, duplicates deduplicated
   - Consecutive same-role messages merged for API compliance

7. **Intelligent File Truncation:**
   ```
   [read_file for 'large-file.ts']
   IMPORTANT: File content truncated.
   Status: Showing lines 1-1000 of 5000 total lines.
   To read more: Use the read_file tool with offset=1001
   ```

**Key Pattern:** Dual arrays + adaptive context window formula + pair-wise truncation + auto-condensation.

---

## 2. Cross-Project Pattern Synthesis

### 2.1 Storage Patterns

| Pattern | Used By | Pros | Cons |
|---------|---------|------|------|
| **MongoDB** | LibreChat | Flexible schema, tree structures | Heavy dependency |
| **PostgreSQL** | LobeChat, Chatbot UI | ACID, pgvector support | Requires DB server |
| **SQLite** | Continue.dev (partial) | Embedded, zero-config | Limited concurrent writes |
| **JSON files** | Jan, Cline | Zero dependencies, inspectable | No query capability |
| **JSONL** | Jan | Append-only, streaming-friendly | Harder to update in-place |
| **localStorage/workspaceState** | Continue.dev, ChainReview (current) | Native to VS Code | Size limits, no structure |

### 2.2 History-to-LLM Patterns

| Pattern | Used By | Description |
|---------|---------|-------------|
| **Full history** | Jan, Chatbot UI | Send everything; rely on large context window |
| **Last-N turns** | ChainReview (current: last 20) | Simple cap on message count |
| **Reverse-iterate with token budget** | LibreChat | Walk backwards, accumulate until budget hit |
| **Pair-wise truncation** | Cline/Roo Code | Remove user+assistant pairs together |
| **Auto-condensation** | Cline/Roo Code | LLM summarizes old history before discarding |
| **Middleware injection** | Open WebUI | Pipeline adds memory/RAG before sending |
| **Tiered memory** | Open WebUI, LobeChat | Short/medium/long-term with different treatment |

### 2.3 Token Budget Formulas

**Cline's Adaptive Formula (recommended):**
```typescript
maxAllowedSize = Math.max(contextWindow - 40_000, contextWindow * 0.8)
```

**LibreChat's Reverse Iteration:**
```typescript
function getMessagesWithinTokenLimit(messages, maxTokens) {
  let total = baseTokenCount; // response format overhead
  const included = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = getTokenCountForMessage(messages[i]);
    if (total + msgTokens > maxTokens) break;
    total += msgTokens;
    included.unshift(messages[i]);
  }
  return included;
}
```

---

## 3. Best Practices Synthesis

### 3.1 Sliding Window vs Full History vs Summarization

| Strategy | When to Use | Token Savings | Context Loss Risk |
|----------|-------------|---------------|-------------------|
| **Full history** | Short conversations (<20 turns), large context models | None | None |
| **Sliding window (last N)** | Medium conversations, predictable workloads | Moderate (20-40%) | High for early context |
| **Reverse-iterate budget** | Any conversation length | Adaptive | Low (keeps most recent) |
| **Summarization** | Long-running sessions, agent loops with many tool calls | 60-80% | Moderate (summary quality dependent) |
| **Hybrid (budget + summarization)** | Production systems, extended agent sessions | 80-90% | Low (preserves key facts) |

**Verdict:** For ChainReview's use case (code review chat with tool calls), the **hybrid approach** is best. Tool-call-heavy conversations can burn context fast (each file read, search result, etc. adds thousands of tokens). The recommended sequence:

1. Keep full history until 60% of context budget consumed
2. At 60%, apply reverse-iterate truncation (keep system prompt + last 70% of messages)
3. At 80%, trigger auto-condensation (summarize old messages, keep recent 5 turns verbatim)
4. At 90%, warn user and suggest starting a new session

### 3.2 Token Counting Before Sending

**Critical finding:** All production-grade systems count tokens BEFORE sending to avoid API errors.

Approaches in order of accuracy:
1. **Provider SDK tokenizer** (tiktoken for OpenAI, Anthropic's count_tokens) -- most accurate
2. **Approximate formula** (1 token ~ 4 characters, 1 token ~ 0.75 words) -- fast but imprecise
3. **Anthropic-specific:** Use `client.messages.countTokens()` or `client.beta.messages.countTokens()` for exact counts

For ChainReview using Claude, the Anthropic SDK provides `countTokens()` which should be used for precise budgeting.

### 3.3 Message Pruning Strategies

From most aggressive to least:

1. **Duplicate content removal** (Cline): Replace repeated file reads with `[DUPLICATE FILE READ]` -- high impact, zero information loss
2. **Tool result truncation**: Cap tool results at N characters (ChainReview already does this with `.slice(0, 1000)` for stored results)
3. **Pair-wise message removal**: Remove oldest user+assistant pairs together
4. **Thinking block removal**: Strip `<thinking>` blocks from history (they were for internal reasoning, not needed for context)
5. **Tool call compression**: Replace verbose tool call details with summaries

### 3.4 System Message vs Conversation History Separation

Universal pattern across all projects:
- **System message is NEVER truncated** -- it defines agent behavior
- System prompt is separate from conversation messages in API calls
- Some projects (Open WebUI) inject memory context INTO the system message
- Others (LibreChat, Cline) keep system message static and inject context as the first user message

Recommendation: Keep ChainReview's system prompt separate. Inject review context (findings summary) as part of the system prompt, not as a user message.

---

## 4. Recommendation for ChainReview

### 4.1 Current State Analysis

ChainReview currently has:
- **Storage:** `workspaceState` (VS Code API) for conversation history, limited to last 40 turns
- **LLM History:** Last 20 turns sent as flat `{role, content}` array via MCP `crp.chat.query`
- **No token counting:** Sends last 20 regardless of actual token consumption
- **No summarization:** Old messages simply dropped
- **Single array:** Same array serves both UI display and API submission
- **SQLite store:** Used for review data (findings, events, patches) but NOT for conversation messages

### 4.2 Recommended Architecture

```
Extension (webview-provider.ts)
|
|-- _uiMessages: ConversationMessage[]     <-- Rich blocks for display
|-- _apiHistory: ApiMessage[]              <-- Clean role/content for LLM
|-- _sessionId: string                     <-- Links to persistence
|
|-- persistSession()
|     |-- workspaceState (fast, for reload)
|     |-- JSON file (durable, for history)
|
|-- buildApiPayload()
      |-- System prompt (never truncated)
      |-- Review context injection
      |-- Reverse-iterate messages within token budget
      |-- Auto-condense if over threshold
```

### 4.3 Specific Implementation Plan

**Phase 1: Dual Array (minimal change)**
```typescript
// In webview-provider.ts
private _apiHistory: Array<{
  role: "user" | "assistant";
  content: string | ContentBlock[];
}> = [];

// When user sends message:
this._apiHistory.push({ role: "user", content: query });

// When assistant responds:
this._apiHistory.push({ role: "assistant", content: result.answer });

// Strip thinking blocks and tool internals from API history
// Keep tool_use/tool_result in API history (Claude needs them)
// But strip verbose tool results down to summaries
```

**Phase 2: Token Budget Management**
```typescript
const CLAUDE_CONTEXT_WINDOW = 200_000; // claude-haiku-4-5
const MAX_OUTPUT_TOKENS = 16_000;
const BUFFER = 40_000;
const MAX_ALLOWED = Math.max(
  CLAUDE_CONTEXT_WINDOW - BUFFER,
  CLAUDE_CONTEXT_WINDOW * 0.8
);
// = max(160000, 160000) = 160,000 tokens for input

function buildMessagesWithinBudget(
  systemPrompt: string,
  history: ApiMessage[],
  currentQuery: string,
): ApiMessage[] {
  const systemTokens = estimateTokens(systemPrompt);
  const queryTokens = estimateTokens(currentQuery);
  let budget = MAX_ALLOWED - systemTokens - queryTokens - MAX_OUTPUT_TOKENS;

  const included: ApiMessage[] = [];
  // Always include system prompt (separate) and current query (last)

  // Reverse iterate through history
  for (let i = history.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(history[i].content);
    if (budget - msgTokens < 0) break;
    budget -= msgTokens;
    included.unshift(history[i]);
  }

  included.push({ role: "user", content: currentQuery });
  return included;
}

function estimateTokens(content: string | object): number {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return Math.ceil(text.length / 4); // Conservative estimate
  // TODO: Use Anthropic SDK countTokens() for production accuracy
}
```

**Phase 3: Auto-Condensation**
```typescript
async function condenseHistory(
  client: Anthropic,
  oldMessages: ApiMessage[],
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: "Summarize this conversation history concisely. Preserve: key questions asked, important findings, files discussed, decisions made. Drop: verbose tool outputs, repeated file reads, intermediate reasoning.",
    messages: [{
      role: "user",
      content: `Summarize this conversation:\n\n${oldMessages.map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : '[tool interaction]'}`).join('\n\n')}`
    }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

// When context exceeds 70% of budget:
// 1. Take the oldest 60% of messages
// 2. Summarize them into a single "context summary" message
// 3. Prepend summary as first user message
// 4. Keep the newest 40% of messages verbatim
```

**Phase 4: Session Persistence (JSON files)**
```typescript
// Store in workspace .chainreview/ directory
const SESSION_DIR = path.join(workspaceRoot, '.chainreview', 'sessions');

interface SessionFile {
  id: string;
  createdAt: string;
  updatedAt: string;
  repoPath: string;
  reviewRunId?: string;
  apiHistory: ApiMessage[];
  condensedSummary?: string;
  tokenCount: number;
}

// Save after each exchange
function persistSession(session: SessionFile): void {
  const filePath = path.join(SESSION_DIR, `${session.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
}
```

### 4.4 Priority Order for Implementation

1. **P0 (Now):** Add token estimation before sending -- prevent context overflow errors
2. **P0 (Now):** Strip thinking blocks from conversation history before re-sending
3. **P1 (Soon):** Implement reverse-iterate budget instead of fixed last-20 cap
4. **P1 (Soon):** Deduplicate repeated file reads in history
5. **P2 (Later):** Auto-condensation with LLM summarization
6. **P2 (Later):** JSON file persistence for session durability
7. **P3 (Future):** Cross-session memory (findings context carried forward)

### 4.5 Why NOT the Other Patterns

| Pattern | Why Skip It |
|---------|-------------|
| MongoDB/PostgreSQL | Overkill for a VS Code extension; ChainReview already has SQLite for review data |
| Vector database memory | Unnecessary complexity; code review context is session-scoped |
| Conversation branching/forking | LibreChat/LobeChat feature for end-user experimentation; not needed for a review tool |
| Middleware pipeline (Open WebUI) | ChainReview's MCP server is the pipeline; no need for another layer |
| Redux/zustand | ChainReview's useReducer pattern is sufficient for VS Code webview state |

---

## 5. Key Metrics to Track

Based on patterns across all analyzed projects:

| Metric | How to Track | Target |
|--------|-------------|--------|
| Context utilization % | tokens_used / max_allowed per request | 40-70% typical |
| Messages included | Count of history messages sent per API call | Varies, log it |
| Truncation events | Count of times budget exceeded | Monitor for increases |
| Condensation quality | User satisfaction after condensation | Qualitative |
| API cost per session | Sum of input + output tokens | Track trend |

---

## Sources

### Project Documentation
- [LibreChat Features - Memory](https://www.librechat.ai/docs/features/memory)
- [LibreChat Token Management (DeepWiki)](https://deepwiki.com/danny-avila/LibreChat/3.4-token-management)
- [LibreChat Memory System (DeepWiki)](https://deepwiki.com/danny-avila/LibreChat/5.6-memory-system)
- [LibreChat Architecture (GitHub Gist)](https://gist.github.com/ChakshuGautam/fca45e48a362b6057b5e67145b82a994)
- [LibreChat MongoDB Rationale](https://www.librechat.ai/docs/user_guides/mongodb)
- [Open WebUI Memory & Context Management (DeepWiki)](https://deepwiki.com/open-webui/open-webui/6.4-memory-and-context-management)
- [Open WebUI Context Discussion](https://github.com/open-webui/open-webui/discussions/3576)
- [LobeChat Architecture (GitHub Wiki)](https://github.com/lobehub/lobe-chat/wiki/Architecture)
- [LobeChat DeepWiki Overview](https://deepwiki.com/lobehub/lobe-chat)
- [Chatbot UI GitHub](https://github.com/mckaywrigley/chatbot-ui)
- [Jan Data Folder](https://www.jan.ai/docs/desktop/data-folder)
- [Jan Threads Documentation](https://jan.ai/docs/threads)
- [Continue.dev Context Providers](https://docs.continue.dev/customization/context-providers)
- [Continue.dev Code Architecture Analysis](https://gist.github.com/RomneyDa/3907e04e577ac560dedf34278fc2f23d)
- [Cline Context Management Docs](https://docs.cline.bot/prompting/understanding-context-management)
- [Cline Context Window Progress Bar](https://cline.bot/blog/understanding-the-new-context-window-progress-bar-in-cline)
- [Cline DeepWiki](https://deepwiki.com/cline/cline)
- [Roo Code Context & Message Management (DeepWiki)](https://deepwiki.com/RooCodeInc/Roo-Code/7-context-and-message-management)

### Best Practices & Industry Analysis
- [Context Window Management Strategies (Maxim AI)](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/)
- [Smart Context-Aware Message Truncation Discussion](https://github.com/cline/cline/discussions/1608)
- [Configurable Context Window Size Discussion](https://github.com/cline/cline/discussions/1563)
- [Cline Token Efficiency Discussion](https://github.com/cline/cline/discussions/3078)
- [Chatbot UI Supabase Refactor Discussion](https://github.com/mckaywrigley/chatbot-ui/discussions/1466)
