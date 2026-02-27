import { useCallback, useEffect, useRef } from "react";
import type { WebviewMessage, ExtensionMessage } from "../lib/types";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;

function getVSCodeAPI() {
  if (!vscodeApi) {
    try {
      vscodeApi = acquireVsCodeApi();
    } catch {
      // Running outside VS Code (dev mode)
      vscodeApi = {
        postMessage: (msg: unknown) => console.log("[vscode mock] postMessage:", msg),
        getState: () => null,
        setState: () => {},
      };
    }
  }
  return vscodeApi;
}

export function useVSCodeAPI(onMessage?: (message: ExtensionMessage) => void) {
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Validate message shape before processing — prevent untrusted messages
      const data = event.data;
      if (data && typeof data === "object" && typeof data.type === "string") {
        callbackRef.current?.(data as ExtensionMessage);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Notify extension that the webview has mounted and is ready to receive messages
  useEffect(() => {
    getVSCodeAPI().postMessage({ type: "webviewReady" });
  }, []);

  const postMessage = useCallback((message: WebviewMessage) => {
    getVSCodeAPI().postMessage(message);
  }, []);

  return { postMessage };
}
