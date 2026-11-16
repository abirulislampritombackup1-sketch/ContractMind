import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

const isBn = () => {
  try { return localStorage.getItem("cm-lang") === "bn"; } catch { return false; }
};
const T = (en: string, bn: string) => (isBn() ? bn : en);

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
    return { hasError: true, errorMessage: error.message || T("An unexpected rendering error occurred.", "অপ্রত্যাশিত একটি সমস্যা হয়েছে।") };
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
                {T("Analysis Display Error", "ফলাফল দেখাতে সমস্যা")}
              </h2>
              <p className="text-xs" style={{ color: "var(--muted)", margin: "4px 0 0" }}>
                {T("The AI returned data in an unexpected format. Your analysis data is preserved.", "এআই অপ্রত্যাশিত আকারে তথ্য দিয়েছে। আপনার বিশ্লেষণের তথ্য সংরক্ষিত আছে।")}
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
              <RotateCcw size={15} /> {T("Retry Rendering", "আবার দেখান")}
            </button>
            {this.props.fallbackPage && (
              <button
                className="secondary"
                onClick={() => {
                  this.setState({ hasError: false, errorMessage: "" });
                  this.props.fallbackPage?.();
                }}
              >
                {T("Return to Dashboard", "সারসংক্ষেপে ফিরুন")}
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
