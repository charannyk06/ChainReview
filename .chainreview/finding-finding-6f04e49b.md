I have the following finding after thorough review of the codebase.
Implement the fix by following the instructions verbatim.

---

## Finding: Unhandled Promise Rejections in webview-provider's Stream Event Handler

**Severity:** HIGH | **Confidence:** 78%
**Category:** architecture | **Agent:** architecture

The webview-provider.ts file contains several async operations with incomplete error handling. Specifically, methods like `_requestPatch()`, `_sendToValidator()`, and `_explainFinding()` are async functions called without proper try-catch blocks in multiple places. In _handleMessage(), the catch block at line 149 is a generic catch-all that only logs to console, but stream event handlers and callbacks may throw errors that go completely unhandled. Additionally, _crpClient method calls in various handlers (e.g., lines 1402, 1426, 1517) use .catch(() => {}) with empty handlers, potentially suppressing critical errors that should be surfaced to the user or logged. This can lead to silent failures and inconsistent state where the UI thinks an operation succeeded when the server-side operation failed.

### Evidence

**src/extension/webview-provider.ts** (lines 149-151):
```
webviewView.webview.onDidReceiveMessage((message) => {
      this._handleMessage(message).catch((err) => {
        console.error("ChainReview: message handler error:", err);
      });
```

**src/extension/webview-provider.ts** (lines 1402-1404):
```
try {
      await this._crpClient.recordEvent(this._currentRunId, "human_rejected", undefined, { patchId });
    } catch { /* Non-critical */ }
```

**src/extension/webview-provider.ts** (lines 1517-1520):
```
if (this._currentRunId && this._crpClient?.isConnected()) {
          await this._crpClient.recordEvent(this._currentRunId, "evidence_collected", undefined, {
            action: "sent_to_coding_agent", agent: agentId, findingId, findingTitle: finding.title,
          }).catch(() => {});
```

### Relevant Files
- src/extension/webview-provider.ts

---

Please fix this issue. The fix should address the root cause described above while maintaining existing functionality.
After completing the fix, verify that the code compiles and passes any existing tests.