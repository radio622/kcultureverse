/**
 * 404 Not Found — 아티스트를 찾을 수 없을 때
 */
export default function NotFound() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#060a14",
        gap: 20,
        padding: 32,
        textAlign: "center",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* 성운 배경 */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(167,139,250,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ fontSize: 52, opacity: 0.5 }}>✦</div>

      <div>
        <p style={{
          fontSize: 11,
          letterSpacing: "0.25em",
          color: "rgba(167,139,250,0.7)",
          textTransform: "uppercase",
          marginBottom: 12,
        }}>
          404
        </p>
        <h1 style={{
          fontSize: "clamp(20px, 5vw, 32px)",
          fontWeight: 700,
          color: "#e8eaed",
          marginBottom: 10,
        }}>
          아티스트를 찾을 수 없습니다
        </h1>
        <p style={{
          fontSize: 14,
          color: "rgba(255,255,255,0.4)",
          maxWidth: 300,
          lineHeight: 1.7,
        }}>
          이 아티스트의 우주는 아직 탐험되지 않았거나
          <br />
          데이터가 존재하지 않습니다.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <a
          href="/"
          style={{
            padding: "11px 24px",
            borderRadius: 10,
            background: "rgba(167,139,250,0.15)",
            border: "1px solid rgba(167,139,250,0.35)",
            color: "#a78bfa",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            transition: "background 0.2s ease",
          }}
        >
          우주로 돌아가기
        </a>
      </div>
    </div>
  );
}
