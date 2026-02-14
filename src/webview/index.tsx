// Phase 1: Early DOM marker — proves script loaded and executed
(function earlyBoot() {
  const marker = document.createElement("div");
  marker.id = "cr-boot-marker";
  marker.style.cssText = "position:fixed;bottom:4px;right:4px;z-index:99999;background:#22c55e;color:#000;padding:2px 6px;border-radius:4px;font:10px monospace;pointer-events:none;";
  marker.textContent = "JS loaded";
  document.body?.appendChild(marker);
})();

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// Phase 2: Update marker — proves imports resolved
{
  const marker = document.getElementById("cr-boot-marker");
  if (marker) marker.textContent = "imports OK";
}

// Error boundary to catch render crashes and display them visually
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ChainReview] React render crash:", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: "#f87171", fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
          <h2 style={{ marginBottom: 8, fontSize: 15 }}>ChainReview UI crashed</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#fca5a5", fontSize: 11, lineHeight: 1.5 }}>
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById("root");
if (root) {
  try {
    // Phase 3: Update marker — React mounting
    const marker = document.getElementById("cr-boot-marker");
    if (marker) marker.textContent = "mounting...";

    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );

    // Phase 4: React.createRoot succeeded (render is async though)
    if (marker) {
      marker.textContent = "render called";
      // Remove marker after 5 seconds if app rendered successfully
      setTimeout(() => {
        if (root.children.length > 0) {
          marker.remove();
        } else {
          marker.textContent = "root empty!";
          marker.style.background = "#ef4444";
          marker.style.color = "#fff";
        }
      }, 5000);
    }
  } catch (err) {
    // Catch synchronous mount errors
    const marker = document.getElementById("cr-boot-marker");
    if (marker) {
      marker.textContent = "MOUNT ERROR";
      marker.style.background = "#ef4444";
      marker.style.color = "#fff";
    }
    root.innerHTML = `<div style="padding:24px;color:#f87171;font-family:system-ui;font-size:13px">
      <h2 style="margin-bottom:8px">ChainReview failed to mount</h2>
      <pre style="white-space:pre-wrap;color:#fca5a5;font-size:11px">${err}</pre>
    </div>`;
  }
} else {
  document.body.innerHTML = '<div style="padding:24px;color:#f87171;font-size:13px">root element not found</div>';
}
