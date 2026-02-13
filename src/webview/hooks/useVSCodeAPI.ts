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
      callbackRef.current?.(event.data as ExtensionMessage);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const postMessage = useCallback((message: WebviewMessage) => {
    getVSCodeAPI().postMessage(message);
  }, []);

  return { postMessage };
}
