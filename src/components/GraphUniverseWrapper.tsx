"use client";

/**
 * GraphUniverseWrapper — SSR/SSG 환경에서 react-force-graph-3d 를 안전하게 로드하는 래퍼
 * next/dynamic 의 ssr:false 로 클라이언트에서만 렌더링합니다.
 */
import dynamic from "next/dynamic";

const GraphUniverse3D = dynamic(
  () => import("./GraphUniverse3D"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 520,
          background: "radial-gradient(ellipse at center, #0f1835 0%, #0a0e1a 70%)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <div style={{ fontSize: "2.5rem", animation: "spin 3s linear infinite" }}>🌌</div>
        <p style={{ color: "rgba(148,163,184,0.7)", fontSize: "0.9rem" }}>3D 우주 로딩 중...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    ),
  }
);

export default GraphUniverse3D;
