import { useState, useCallback, useMemo } from "react";
import { useVSCodeAPI } from "./hooks/useVSCodeAPI";
import { useReviewState } from "./hooks/useReviewState";
import { OpenFileProvider } from "./contexts/OpenFileContext";
import { EmptyState } from "./components/layout/EmptyState";
import { Header } from "./components/layout/Header";
import { TabNav, type TabId } from "./components/layout/TabNav";
import { ChatContainer } from "./components/chat/ChatContainer";
import { FindingsGrid } from "./components/review/FindingsGrid";
import { PatchPreview } from "./components/review/PatchPreview";
import { AuditTimeline } from "./components/timeline/AuditTimeline";
import { MCPManagerPanel } from "./components/mcp/MCPManagerPanel";
import { TaskHistory } from "./components/history/TaskHistory";
import type { FindingActions } from "./components/chat/ChatMessage";
import type { Patch, ExtensionMessage, MCPServerConfig } from "./lib/types";

export default function App() {
  const {
    state,
    handleExtensionMessage,
    addUserMessage,
    startReview,
    reset,
    markFindingValidating,
    openMCPManager,
    closeMCPManager,
    openHistory,
    closeHistory,
    deleteHistoryRun,
  } = useReviewState();
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [activePatch, setActivePatch] = useState<Patch | null>(null);

  // Handle patchReady messages to open the patch preview + tab switching
  const handleMessage = useCallback(
    (msg: ExtensionMessage) => {
      handleExtensionMessage(msg);
      if (msg.type === "patchReady") {
        setActivePatch(msg.patch);
      }
      // Server can request tab switch (e.g., when validator starts)
      if (msg.type === "switchTab") {
        setActiveTab(msg.tab);
      }
    },
    [handleExtensionMessage]
  );

  const { postMessage } = useVSCodeAPI(handleMessage);

  const handleStartReview = (mode: "repo" | "diff") => {
    startReview(mode);
    postMessage({ type: "startReview", mode });
    setActiveTab("chat");
  };

  const handleSendQuery = useCallback(
    (query: string) => {
      addUserMessage(query);
      postMessage({ type: "chatQuery", query });
    },
    [addUserMessage, postMessage]
  );

  const handleNewThread = useCallback(() => {
    reset();
    setActiveTab("chat");
    setActivePatch(null);
  }, [reset]);

  const handleOpenMCPManager = useCallback(() => {
    openMCPManager();
    postMessage({ type: "openMCPManager" });
  }, [openMCPManager, postMessage]);

  const handleCloseMCPManager = useCallback(() => {
    closeMCPManager();
  }, [closeMCPManager]);

  // ── History handlers ──
  const handleOpenHistory = useCallback(() => {
    openHistory();
    postMessage({ type: "getReviewHistory" });
  }, [openHistory, postMessage]);

  const handleCloseHistory = useCallback(() => {
    closeHistory();
  }, [closeHistory]);

  const handleDeleteHistoryRun = useCallback(
    (runId: string) => {
      deleteHistoryRun(runId);
      postMessage({ type: "deleteReviewRun", runId });
    },
    [deleteHistoryRun, postMessage]
  );

  const handleLoadHistoryRun = useCallback(
    (runId: string) => {
      closeHistory();
      postMessage({ type: "loadReviewRun", runId });
    },
    [closeHistory, postMessage]
  );

  // ── MCP Manager actions ──
  const handleMCPAddServer = useCallback(
    (config: MCPServerConfig) => {
      postMessage({ type: "mcpAddServer", config });
    },
    [postMessage]
  );

  const handleMCPUpdateServer = useCallback(
    (config: MCPServerConfig) => {
      postMessage({ type: "mcpUpdateServer", config });
    },
    [postMessage]
  );

  const handleMCPRemoveServer = useCallback(
    (serverId: string) => {
      postMessage({ type: "mcpRemoveServer", serverId });
    },
    [postMessage]
  );

  const handleMCPToggleServer = useCallback(
    (serverId: string, enabled: boolean) => {
      postMessage({ type: "mcpToggleServer", serverId, enabled });
    },
    [postMessage]
  );

  const handleMCPRefreshServer = useCallback(
    (serverId: string) => {
      postMessage({ type: "mcpRefreshServer", serverId });
    },
    [postMessage]
  );

  const handleProposePatch = (findingId: string) => {
    postMessage({ type: "requestPatch", findingId });
  };

  const handleApplyPatch = (patchId: string) => {
    postMessage({ type: "applyPatch", patchId });
    setActivePatch(null);
  };

  const handleMarkFalsePositive = (findingId: string) => {
    postMessage({ type: "markFalsePositive", findingId });
  };

  const handleSendToValidator = (findingId: string) => {
    markFindingValidating(findingId);
    postMessage({ type: "sendToValidator", findingId });
  };

  const handleExplain = (findingId: string) => {
    postMessage({ type: "explainFinding", findingId });
    setActiveTab("chat");
  };

  const handleSendToCodingAgent = (findingId: string, agentId?: string) => {
    postMessage({ type: "sendToCodingAgent", findingId, agentId: agentId || "clipboard" });
  };

  const handleReReview = () => {
    handleStartReview("repo");
  };

  const handleCancelReview = useCallback(() => {
    postMessage({ type: "cancelReview" });
  }, [postMessage]);

  const handleDismissPatch = () => {
    if (activePatch) {
      postMessage({ type: "dismissPatch", patchId: activePatch.id });
    }
    setActivePatch(null);
  };

  // Memoized finding actions for inline finding cards in chat
  const findingActions: FindingActions = useMemo(
    () => ({
      onProposePatch: handleProposePatch,
      onMarkFalsePositive: handleMarkFalsePositive,
      onSendToValidator: handleSendToValidator,
      onExplain: handleExplain,
      onSendToCodingAgent: handleSendToCodingAgent,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [postMessage]
  );

  // ── Task History Panel (full-screen overlay) ──
  if (state.historyOpen) {
    return (
      <OpenFileProvider postMessage={postMessage}>
        <TaskHistory
          runs={state.reviewHistory || []}
          onClose={handleCloseHistory}
          onLoadRun={handleLoadHistoryRun}
          onDeleteRun={handleDeleteHistoryRun}
          className="h-screen"
        />
      </OpenFileProvider>
    );
  }

  // ── MCP Manager Panel (full-screen overlay) ──
  if (state.mcpManagerOpen) {
    return (
      <OpenFileProvider postMessage={postMessage}>
        <MCPManagerPanel
          servers={state.mcpServers || []}
          onClose={handleCloseMCPManager}
          onAddServer={handleMCPAddServer}
          onUpdateServer={handleMCPUpdateServer}
          onRemoveServer={handleMCPRemoveServer}
          onToggleServer={handleMCPToggleServer}
          onRefreshServer={handleMCPRefreshServer}
          className="h-screen"
        />
      </OpenFileProvider>
    );
  }

  if (state.status === "idle") {
    return (
      <OpenFileProvider postMessage={postMessage}>
        <EmptyState
          onStartRepoReview={() => handleStartReview("repo")}
          onStartDiffReview={() => handleStartReview("diff")}
          onOpenHistory={handleOpenHistory}
        />
      </OpenFileProvider>
    );
  }

  return (
    <OpenFileProvider postMessage={postMessage}>
      <div className="flex flex-col h-screen bg-[var(--cr-bg-root)]">
        <Header
          onNewThread={handleNewThread}
          onOpenMCPManager={handleOpenMCPManager}
          onOpenHistory={handleOpenHistory}
        />
        <TabNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          findingsCount={state.findings.length}
          eventsCount={state.events.length}
        />

        <div className="flex-1 overflow-hidden">
          {activeTab === "chat" && (
            <ChatContainer
              messages={state.messages}
              onSendQuery={handleSendQuery}
              onStartRepoReview={() => handleStartReview("repo")}
              onStartDiffReview={() => handleStartReview("diff")}
              onCancelReview={handleCancelReview}
              isReviewing={state.status === "running"}
              findingActions={findingActions}
              className="h-full"
            />
          )}
          {activeTab === "findings" && (
            <FindingsGrid
              findings={state.findings}
              validationVerdicts={state.validationVerdicts}
              validatingFindings={state.validatingFindings}
              onProposePatch={handleProposePatch}
              onMarkFalsePositive={handleMarkFalsePositive}
              onSendToValidator={handleSendToValidator}
              onExplain={handleExplain}
              onSendToCodingAgent={handleSendToCodingAgent}
              onReReview={handleReReview}
              className="h-full"
            />
          )}
          {activeTab === "timeline" && (
            <AuditTimeline events={state.events} className="h-full" />
          )}
        </div>

        {/* Error banner */}
        {state.error && (
          <div className="px-3 py-2 bg-red-500/10 border-t border-red-500/30 text-xs text-red-300">
            {state.error}
          </div>
        )}

        {/* Patch preview modal */}
        <PatchPreview
          patch={activePatch}
          onApply={handleApplyPatch}
          onDismiss={handleDismissPatch}
        />
      </div>
    </OpenFileProvider>
  );
}
