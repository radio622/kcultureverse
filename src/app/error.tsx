"use client";

/**
 * app/error.tsx — 앱 수준 에러 페이지 (Next.js App Router 전용)
 * ErrorBoundary와 달리 서버 컴포넌트 오류도 여기서 처리됨
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{
        margin: 0,
        background: "#060a14",
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: "#e8eaed",
      }}>
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            padding: 32,
            textAlign: "center",
          }}
        >
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(167,139,250,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{ fontSize: 48, opacity: 0.5 }}>⚡</div>

          <div>
            <p style={{
              fontSize: 11,
              letterSpacing: "0.25em",
              color: "rgba(251,146,60,0.8)",
              textTransform: "uppercase",
              marginBottom: 12,
            }}>
              오류 발생
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
              우주 항법 시스템 오류
            </h1>
            <p style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.4)",
              maxWidth: 300,
              lineHeight: 1.7,
            }}>
              예상치 못한 오류가 발생했습니다.
              <br />
              {error.digest && (
                <code style={{ fontSize: 10, opacity: 0.5 }}>ref: {error.digest}</code>
              )}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={reset}
              style={{
                padding: "11px 22px",
                borderRadius: 10,
                background: "rgba(167,139,250,0.15)",
                border: "1px solid rgba(167,139,250,0.35)",
                color: "#a78bfa",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              다시 시도
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              style={{
                padding: "11px 22px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              홈으로
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
