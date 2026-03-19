"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** 에러 발생 시 호출되는 콜백 (로깅 용도) */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] 렌더링 오류:", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-cosmos, #060a14)",
            gap: 20,
            padding: 24,
            textAlign: "center",
          }}
        >
          {/* 별 아이콘 */}
          <div style={{ fontSize: 48, opacity: 0.6 }}>✦</div>

          <div>
            <h2 style={{
              fontSize: 20,
              fontWeight: 600,
              color: "var(--text-primary, #e8eaed)",
              marginBottom: 8,
            }}>
              우주가 잠시 길을 잃었습니다
            </h2>
            <p style={{
              fontSize: 13,
              color: "var(--text-muted, rgba(255,255,255,0.35))",
              maxWidth: 320,
              lineHeight: 1.6,
            }}>
              예상치 못한 오류가 발생했습니다.
              <br />
              {this.state.error?.message && (
                <code style={{ fontSize: 11, opacity: 0.7 }}>
                  {this.state.error.message.slice(0, 80)}
                </code>
              )}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                background: "rgba(167,139,250,0.18)",
                border: "1px solid rgba(167,139,250,0.35)",
                color: "#a78bfa",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "background 0.2s ease",
              }}
            >
              다시 시도
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "var(--text-secondary, rgba(255,255,255,0.6))",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              홈으로
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
