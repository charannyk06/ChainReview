import { useReducer, useCallback } from "react";
import type {
  ReviewState,
  ReviewStatus,
  ReviewMode,
  ExtensionMessage,
  ConversationMessage,
  ContentBlock,
  Finding,
  AuditEvent,
  Patch,
  MCPServerInfo,
  ValidatorVerdict,
  ValidationResult,
  ReviewRunSummary,
  AgentName,
  AuthStatePayload,
} from "../lib/types";

const initialState: ReviewState = {
  status: "idle",
  messages: [],
  findings: [],
  patches: [],
  events: [],
  mcpManagerOpen: false,
  mcpServers: [],
  validationVerdicts: {},
  validatingFindings: new Set(),
  dismissedFindingIds: new Set(),
  fixedFindingIds: new Set(),
  // Default auth: managed mode, not authenticated yet
  // The extension will send the real state via authStateChanged on load
  auth: {
    mode: "managed",
    user: null,
    authenticated: false,
  },
};

type Action =
  | { type: "REVIEW_STARTED"; mode: "repo" | "diff" }
  | { type: "ADD_BLOCK"; block: ContentBlock; agent?: string }
  | { type: "UPDATE_BLOCK"; blockId: string; updates: Partial<ContentBlock> }
  | { type: "ADD_USER_MESSAGE"; query: string }
  | { type: "CHAT_RESPONSE_START"; messageId: string }
  | { type: "CHAT_RESPONSE_BLOCK"; messageId: string; block: ContentBlock }
  | { type: "CHAT_RESPONSE_END"; messageId: string }
  | { type: "ADD_FINDING"; finding: Finding }
  | { type: "ADD_EVENT"; event: AuditEvent }
  | { type: "ADD_PATCH"; patch: Patch }
  | { type: "REVIEW_COMPLETE"; findings: Finding[]; events: AuditEvent[] }
  | { type: "REVIEW_ERROR"; error: string }
  | { type: "START_CHAT" }
  | { type: "RESET" }
  | { type: "FINDING_VALIDATING"; findingId: string }
  | { type: "FINDING_VALIDATED"; findingId: string; verdict: ValidatorVerdict; reasoning: string }
  | { type: "FINDING_VALIDATION_ERROR"; findingId: string; error: string }
  | { type: "MCP_MANAGER_OPEN" }
  | { type: "MCP_MANAGER_CLOSE" }
  | { type: "MCP_SERVERS_SET"; servers: MCPServerInfo[] }
  | { type: "MCP_SERVER_UPDATED"; server: MCPServerInfo }
  | { type: "MCP_SERVER_REMOVED"; serverId: string }
  | { type: "HISTORY_OPEN" }
  | { type: "HISTORY_CLOSE" }
  | { type: "HISTORY_SET"; runs: ReviewRunSummary[] }
  | { type: "HISTORY_DELETE_RUN"; runId: string }
  | { type: "RESTORE_MESSAGES"; messages: ConversationMessage[] }
  | { type: "RESTORE_REVIEW_STATE"; findings: Finding[]; events: AuditEvent[]; status: ReviewStatus; mode?: ReviewMode; validationVerdicts?: Record<string, ValidationResult> }
  | { type: "MARK_FALSE_POSITIVE"; findingId: string }
  | { type: "MARK_FIXED"; findingId: string }
  | { type: "CLEAR_CHAT" }
  | { type: "AUTH_STATE_CHANGED"; auth: AuthStatePayload };

function reducer(state: ReviewState, action: Action): ReviewState {
  switch (action.type) {
    case "REVIEW_STARTED":
      return { ...initialState, status: "running", mode: action.mode, mcpServers: state.mcpServers, fixedFindingIds: new Set() };

    case "START_CHAT":
      return { ...initialState, status: "chatting", mcpServers: state.mcpServers, validatingFindings: new Set(), dismissedFindingIds: new Set(), fixedFindingIds: new Set() };

    case "ADD_BLOCK": {
      const block = action.block;
      const targetAgent = action.agent || "system"; // Agent routing info from extension; default to "system" if unset
      const msgs = [...state.messages];

      // SubAgentEvent "started" creates a new assistant message for that agent
      if (block.kind === "sub_agent_event" && block.event === "started") {
        msgs.push({
          id: crypto.randomUUID(),
          role: "assistant",
          agent: block.agent,
          blocks: [block],
          status: "streaming",
          timestamp: block.timestamp,
        });
        return { ...state, messages: msgs };
      }

      // Find the correct message to append to:
      // 1. If we have agent routing info, find the STREAMING message for that agent
      // 2. Fall back to the last streaming assistant message
      // 3. Fall back to the last assistant message
      let targetIdx = -1;

      if (targetAgent) {
        // Find the streaming message for this specific agent (search backwards)
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (
            msgs[i].role === "assistant" &&
            msgs[i].agent === targetAgent &&
            msgs[i].status === "streaming"
          ) {
            targetIdx = i;
            break;
          }
        }
      }

      // Fallback: find last streaming assistant message
      if (targetIdx < 0) {
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "assistant" && msgs[i].status === "streaming") {
            targetIdx = i;
            break;
          }
        }
      }

      // Fallback: last assistant message of any status
      if (targetIdx < 0) {
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "assistant") {
            targetIdx = i;
            break;
          }
        }
      }

      if (targetIdx >= 0) {
        const targetMsg = { ...msgs[targetIdx] };
        targetMsg.blocks = [...targetMsg.blocks, block];

        // If it's a sub_agent_event "completed" or "error", mark the message complete
        if (block.kind === "sub_agent_event" && (block.event === "completed" || block.event === "error")) {
          targetMsg.status = "complete";
        }

        msgs[targetIdx] = targetMsg;
      } else {
        // No assistant message yet — create one
        msgs.push({
          id: crypto.randomUUID(),
          role: "assistant",
          agent: targetAgent as AgentName,
          blocks: [block],
          status: "streaming",
          timestamp: block.timestamp,
        });
      }

      return { ...state, messages: msgs };
    }

    case "UPDATE_BLOCK": {
      // Find the block by ID across all messages and update it in-place
      const msgs = state.messages.map((msg) => {
        const blockIdx = msg.blocks.findIndex((b) => b.id === action.blockId);
        if (blockIdx < 0) return msg;

        const updatedBlocks = [...msg.blocks];
        updatedBlocks[blockIdx] = { ...updatedBlocks[blockIdx], ...action.updates } as ContentBlock;
        return { ...msg, blocks: updatedBlocks };
      });
      return { ...state, messages: msgs };
    }

    case "ADD_USER_MESSAGE": {
      const userMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: "user",
        blocks: [
          {
            kind: "text",
            id: crypto.randomUUID(),
            text: action.query,
            format: "plain",
            timestamp: new Date().toISOString(),
          },
        ],
        status: "complete",
        timestamp: new Date().toISOString(),
      };
      return { ...state, messages: [...state.messages, userMsg] };
    }

    case "CHAT_RESPONSE_START": {
      const chatMsg: ConversationMessage = {
        id: action.messageId,
        role: "assistant",
        agent: "system",
        blocks: [],
        status: "streaming",
        timestamp: new Date().toISOString(),
      };
      return { ...state, messages: [...state.messages, chatMsg] };
    }

    case "CHAT_RESPONSE_BLOCK": {
      const msgs = [...state.messages];
      const idx = msgs.findIndex((m) => m.id === action.messageId);
      if (idx < 0) {
        console.warn(`[useReviewState] CHAT_RESPONSE_BLOCK: no message found for id=${action.messageId}`);
        return state;
      }
      const msg = { ...msgs[idx] };
      msg.blocks = [...msg.blocks, action.block];
      msgs[idx] = msg;
      return { ...state, messages: msgs };
    }

    case "CHAT_RESPONSE_END": {
      const msgs = [...state.messages];
      const idx = msgs.findIndex((m) => m.id === action.messageId);
      if (idx < 0) {
        console.warn(`[useReviewState] CHAT_RESPONSE_END: no message found for id=${action.messageId}`);
        return state;
      }
      msgs[idx] = { ...msgs[idx], status: "complete" };
      return { ...state, messages: msgs };
    }

    case "ADD_FINDING":
      return { ...state, findings: [...state.findings, action.finding] };

    case "ADD_EVENT":
      return { ...state, events: [...state.events, action.event] };

    case "ADD_PATCH":
      return { ...state, patches: [...state.patches, action.patch] };

    case "REVIEW_COMPLETE": {
      // Keep findings streamed in real-time; only use batch if no streamed findings exist
      const completedFindings = state.findings.length > 0 ? state.findings :
                action.findings.length > 0 ? action.findings : state.findings;
      return {
        ...state,
        status: "complete",
        // Filter out any findings previously dismissed as false positive
        findings: completedFindings.filter((f) => !state.dismissedFindingIds.has(f.id)),
        // Keep events streamed in real-time; only use batch if no streamed events exist
        events: state.events.length > 0 ? state.events :
                action.events.length > 0 ? action.events : state.events,
      };
    }

    case "REVIEW_ERROR":
      return { ...state, status: "error", error: action.error };

    case "RESET":
      return { ...initialState, mcpServers: state.mcpServers, validationVerdicts: state.validationVerdicts, validatingFindings: new Set(), dismissedFindingIds: new Set() };

    // ── Finding Validation ──
    case "FINDING_VALIDATING": {
      const next = new Set(state.validatingFindings);
      next.add(action.findingId);
      return { ...state, validatingFindings: next };
    }

    case "FINDING_VALIDATED": {
      const next = new Set(state.validatingFindings);
      next.delete(action.findingId);
      return {
        ...state,
        validatingFindings: next,
        validationVerdicts: {
          ...state.validationVerdicts,
          [action.findingId]: { verdict: action.verdict, reasoning: action.reasoning },
        },
      };
    }

    case "FINDING_VALIDATION_ERROR": {
      // Clear validating state without setting a fake verdict
      const next = new Set(state.validatingFindings);
      next.delete(action.findingId);
      return { ...state, validatingFindings: next };
    }

    // ── MCP Manager ──
    case "MCP_MANAGER_OPEN":
      return { ...state, mcpManagerOpen: true };

    case "MCP_MANAGER_CLOSE":
      return { ...state, mcpManagerOpen: false };

    case "MCP_SERVERS_SET":
      return { ...state, mcpServers: action.servers };

    case "MCP_SERVER_UPDATED": {
      const servers = [...(state.mcpServers || [])];
      const idx = servers.findIndex((s) => s.id === action.server.id);
      if (idx >= 0) {
        servers[idx] = action.server;
      } else {
        servers.push(action.server);
      }
      return { ...state, mcpServers: servers };
    }

    case "MCP_SERVER_REMOVED":
      return {
        ...state,
        mcpServers: (state.mcpServers || []).filter((s) => s.id !== action.serverId),
      };

    // ── Task History ──
    case "HISTORY_OPEN":
      return { ...state, historyOpen: true };

    case "HISTORY_CLOSE":
      return { ...state, historyOpen: false };

    case "HISTORY_SET":
      return { ...state, reviewHistory: action.runs };

    case "HISTORY_DELETE_RUN":
      return {
        ...state,
        reviewHistory: (state.reviewHistory || []).filter((r) => r.id !== action.runId),
      };

    // ── State Restoration ──
    case "RESTORE_MESSAGES":
      // Always restore messages — merge if active session has none yet,
      // skip only if current session already has messages (to avoid duplication)
      if (state.messages.length > 0) return state;
      return {
        ...state,
        status: state.status === "idle" ? "chatting" : state.status,
        messages: action.messages,
      };

    case "RESTORE_REVIEW_STATE": {
      // Allow restore unless a review is actively running right now
      if (state.status === "running") return state;
      const restoredStatus: ReviewStatus = action.status === "running" ? "complete" : (action.status as ReviewStatus);
      // Don't downgrade status: if we're already chatting, don't go back to idle
      const effectiveStatus = (restoredStatus === "idle" && state.status !== "idle") ? state.status : restoredStatus;
      // Filter out any findings that were dismissed as false positive in this session
      const restoredFindings = action.findings.length > 0
        ? action.findings.filter((f) => !state.dismissedFindingIds.has(f.id))
        : state.findings;
      return {
        ...state,
        status: effectiveStatus,
        mode: action.mode || state.mode,
        findings: restoredFindings,
        events: action.events.length > 0 ? action.events : state.events,
        validationVerdicts: {
          ...state.validationVerdicts,
          ...(action.validationVerdicts || {}),
        },
      };
    }

    // ── False Positive ──
    case "MARK_FALSE_POSITIVE": {
      const nextDismissed = new Set(state.dismissedFindingIds);
      nextDismissed.add(action.findingId);
      return {
        ...state,
        findings: state.findings.filter((f) => f.id !== action.findingId),
        dismissedFindingIds: nextDismissed,
      };
    }

    // ── Mark Fixed — hide from active list, track for re-review ──
    case "MARK_FIXED": {
      const nextFixed = new Set(state.fixedFindingIds);
      nextFixed.add(action.findingId);
      return {
        ...state,
        findings: state.findings.filter((f) => f.id !== action.findingId),
        fixedFindingIds: nextFixed,
      };
    }

    case "CLEAR_CHAT":
      return { ...initialState, mcpServers: state.mcpServers, validatingFindings: new Set(), dismissedFindingIds: new Set(), fixedFindingIds: new Set(), auth: state.auth };

    case "AUTH_STATE_CHANGED":
      return { ...state, auth: action.auth };

    default:
      return state;
  }
}

export function useReviewState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleExtensionMessage = useCallback((msg: ExtensionMessage) => {
    switch (msg.type) {
      case "reviewStarted":
        dispatch({ type: "REVIEW_STARTED", mode: msg.mode });
        break;
      case "addBlock":
        dispatch({ type: "ADD_BLOCK", block: msg.block, agent: msg.agent });
        break;
      case "updateBlock":
        dispatch({ type: "UPDATE_BLOCK", blockId: msg.blockId, updates: msg.updates });
        break;
      case "chatResponseStart":
        dispatch({ type: "CHAT_RESPONSE_START", messageId: msg.messageId });
        break;
      case "chatResponseBlock":
        dispatch({
          type: "CHAT_RESPONSE_BLOCK",
          messageId: msg.messageId,
          block: msg.block,
        });
        break;
      case "chatResponseEnd":
        dispatch({ type: "CHAT_RESPONSE_END", messageId: msg.messageId });
        break;
      case "finding":
        dispatch({ type: "ADD_FINDING", finding: msg.finding });
        break;
      case "addEvent":
        dispatch({ type: "ADD_EVENT", event: msg.event });
        break;
      case "patchReady":
        dispatch({ type: "ADD_PATCH", patch: msg.patch });
        break;
      case "reviewComplete":
        dispatch({
          type: "REVIEW_COMPLETE",
          findings: msg.findings,
          events: msg.events,
        });
        break;
      case "reviewError":
        dispatch({ type: "REVIEW_ERROR", error: msg.error });
        break;
      case "reviewCancelled":
        dispatch({ type: "REVIEW_COMPLETE", findings: [], events: [] });
        break;
      // Validation messages
      case "findingValidated":
        dispatch({ type: "FINDING_VALIDATED", findingId: msg.findingId, verdict: msg.verdict, reasoning: msg.reasoning });
        break;
      case "findingValidationError":
        dispatch({ type: "FINDING_VALIDATION_ERROR", findingId: msg.findingId, error: msg.error });
        break;
      case "falsePositiveMarked":
        dispatch({ type: "MARK_FALSE_POSITIVE", findingId: msg.findingId });
        break;
      case "fixedMarked":
        dispatch({ type: "MARK_FIXED", findingId: msg.findingId });
        break;

      // MCP Manager messages
      case "mcpManagerOpen":
        dispatch({ type: "MCP_MANAGER_OPEN" });
        break;
      case "mcpServers":
        dispatch({ type: "MCP_SERVERS_SET", servers: msg.servers });
        break;
      case "mcpServerUpdated":
        dispatch({ type: "MCP_SERVER_UPDATED", server: msg.server });
        break;
      case "mcpServerRemoved":
        dispatch({ type: "MCP_SERVER_REMOVED", serverId: msg.serverId });
        break;

      // Task History
      case "reviewHistory":
        dispatch({ type: "HISTORY_SET", runs: msg.runs });
        break;

      // Injected user message (e.g. from Verify button)
      case "injectUserMessage":
        dispatch({ type: "ADD_USER_MESSAGE", query: msg.text });
        break;

      // State restoration
      case "restoreMessages":
        dispatch({ type: "RESTORE_MESSAGES", messages: msg.messages });
        break;
      case "restoreReviewState":
        dispatch({
          type: "RESTORE_REVIEW_STATE",
          findings: msg.findings,
          events: msg.events,
          status: msg.status as ReviewStatus,
          mode: msg.mode as ReviewMode | undefined,
          validationVerdicts: (msg as any).validationVerdicts,
        });
        break;

      // Persistence request — webview sends messages back to extension for storage
      case "requestPersistMessages":
        // handled in App.tsx via postMessage
        break;

      // Auth state
      case "authStateChanged":
        dispatch({ type: "AUTH_STATE_CHANGED", auth: msg.auth });
        break;
    }
  }, []);

  const addUserMessage = useCallback((query: string) => {
    dispatch({ type: "ADD_USER_MESSAGE", query });
  }, []);

  const startReview = useCallback((mode: "repo" | "diff") => {
    dispatch({ type: "REVIEW_STARTED", mode });
  }, []);

  const startChat = useCallback(() => {
    dispatch({ type: "START_CHAT" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const markFindingValidating = useCallback((findingId: string) => {
    dispatch({ type: "FINDING_VALIDATING", findingId });
  }, []);

  const openMCPManager = useCallback(() => {
    dispatch({ type: "MCP_MANAGER_OPEN" });
  }, []);

  const closeMCPManager = useCallback(() => {
    dispatch({ type: "MCP_MANAGER_CLOSE" });
  }, []);

  const openHistory = useCallback(() => {
    dispatch({ type: "HISTORY_OPEN" });
  }, []);

  const closeHistory = useCallback(() => {
    dispatch({ type: "HISTORY_CLOSE" });
  }, []);

  const deleteHistoryRun = useCallback((runId: string) => {
    dispatch({ type: "HISTORY_DELETE_RUN", runId });
  }, []);

  const clearChat = useCallback(() => {
    dispatch({ type: "CLEAR_CHAT" });
  }, []);

  return {
    state,
    handleExtensionMessage,
    addUserMessage,
    startReview,
    startChat,
    reset,
    markFindingValidating,
    openMCPManager,
    closeMCPManager,
    openHistory,
    closeHistory,
    deleteHistoryRun,
    clearChat,
  };
}
