import { createContext, useContext, useCallback } from "react";
import type { WebviewMessage } from "../lib/types";

type PostMessageFn = (message: WebviewMessage) => void;
type OpenFileFn = (filePath: string, line?: number) => void;

const OpenFileContext = createContext<OpenFileFn>(() => {});

export function OpenFileProvider({
  postMessage,
  children,
}: {
  postMessage: PostMessageFn;
  children: React.ReactNode;
}) {
  const openFile = useCallback(
    (filePath: string, line?: number) => {
      postMessage({ type: "openFile", filePath, line });
    },
    [postMessage]
  );

  return (
    <OpenFileContext.Provider value={openFile}>
      {children}
    </OpenFileContext.Provider>
  );
}

/** Hook to get the openFile function from context */
export function useOpenFile(): OpenFileFn {
  return useContext(OpenFileContext);
}
