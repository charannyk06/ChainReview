import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("ChainReview ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "24px",
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#fca5a5",
          background: "#1a0000",
          minHeight: "100vh",
          overflow: "auto",
        }}>
          <h2 style={{ fontSize: "14px", marginBottom: "12px", color: "#ef4444" }}>
            ChainReview — Render Error
          </h2>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#fca5a5" }}>
            {this.state.error?.message}
          </pre>
          <details style={{ marginTop: "16px" }}>
            <summary style={{ cursor: "pointer", color: "#a3a3a3" }}>Stack Trace</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "10px", color: "#737373", marginTop: "8px" }}>
              {this.state.error?.stack}
            </pre>
          </details>
          {this.state.errorInfo?.componentStack && (
            <details style={{ marginTop: "8px" }}>
              <summary style={{ cursor: "pointer", color: "#a3a3a3" }}>Component Stack</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: "10px", color: "#737373", marginTop: "8px" }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            style={{
              marginTop: "20px",
              padding: "8px 16px",
              background: "#333",
              color: "#e5e5e5",
              border: "1px solid #555",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
