import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles/globals.css";

// ── Diagnostic helpers ──
function showError(title: string, message: string, detail?: string) {
  const el = document.getElementById("root") || document.body;
  el.textContent = "";

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "padding:24px;font-family:monospace;font-size:12px;color:#fca5a5;background:#1a0000;min-height:100vh;overflow:auto";

  const h2 = document.createElement("h2");
  h2.style.cssText = "color:#ef4444;margin-bottom:12px";
  h2.textContent = title;
  wrapper.appendChild(h2);

  const pre = document.createElement("pre");
  pre.style.cssText = "white-space:pre-wrap;word-break:break-word";
  pre.textContent = message;
  wrapper.appendChild(pre);

  if (detail) {
    const detailPre = document.createElement("pre");
    detailPre.style.cssText = "font-size:10px;color:#737373;margin-top:8px;white-space:pre-wrap";
    detailPre.textContent = detail;
    wrapper.appendChild(detailPre);
  }

  el.appendChild(wrapper);
}

// Global error handler — catches ANY unhandled error (before or after React)
window.onerror = (message, source, lineno, colno, error) => {
  showError(
    "ChainReview — Runtime Error",
    String(message),
    `${source}:${lineno}:${colno}\n${error?.stack || ""}`
  );
};

window.addEventListener("unhandledrejection", (event) => {
  console.error("ChainReview unhandled rejection:", event.reason);
});

try {
  const root = document.getElementById("root");
  if (!root) {
    showError("ChainReview — Mount Error", "Could not find #root element in DOM");
  } else {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  }
} catch (err: any) {
  showError(
    "ChainReview — Mount Error",
    err.message || String(err),
    err.stack
  );
}
