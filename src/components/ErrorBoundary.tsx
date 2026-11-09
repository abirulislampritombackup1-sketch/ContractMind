import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackPage?: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || "An unexpected rendering error occurred." };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ContractMind Error Boundary caught:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="panel p-6 space-y-4" style={{ maxWidth: 700, margin: "40px auto" }}>
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(255, 107, 107, 0.15)" }}
            >
              <AlertTriangle size={24} style={{ color: "var(--danger)" }} />
            </div>
            <div>
              <h2
                className="font-bold text-lg"
                style={{ color: "var(--text)", margin: 0 }}
              >
                Analysis Display Error
              </h2>
              <p className="text-xs" style={{ color: "var(--muted)", margin: "4px 0 0" }}>
                The AI returned data in an unexpected format. Your analysis data is preserved.
              </p>
            </div>
          </div>

          <div
            className="rounded-lg p-3 text-xs font-mono"
            style={{
              background: "rgba(255, 107, 107, 0.08)",
              border: "1px solid rgba(255, 107, 107, 0.2)",
              color: "var(--danger)",
            }}
          >
            {this.state.errorMessage}
          </div>

          <div className="flex items-center gap-3">
            <button className="primary" onClick={this.handleRetry}>
              <RotateCcw size={15} /> Retry Rendering
            </button>
            {this.props.fallbackPage && (
              <button
                className="secondary"
                onClick={() => {
                  this.setState({ hasError: false, errorMessage: "" });
                  this.props.fallbackPage?.();
                }}
              >
                Return to Dashboard
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
