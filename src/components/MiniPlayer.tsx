"use client";

interface Props {
  isPlaying: boolean;
  trackName: string | null;
  progress: number;  // 0~1
  onStop: () => void;
}

export default function MiniPlayer({ isPlaying, trackName, progress, onStop }: Props) {
  if (!trackName && !isPlaying) {
    return (
      <div
        style={{
          padding: "0 20px",
          height: 36,
          display: "flex",
          alignItems: "center",
        }}
      >
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          위성을 탭해서 음악을 들어보세요
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 20px" }}>
      {/* 트랙 정보 + 컨트롤 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 36,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          {/* 재생 인디케이터 (파동) */}
          <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: isPlaying ? `${8 + i * 4}px` : "4px",
                  borderRadius: 2,
                  background: "var(--accent-core)",
                  animation: isPlaying ? `wave ${0.6 + i * 0.2}s ease-in-out infinite alternate` : "none",
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {trackName ?? "재생 중..."}
          </span>
        </div>

        {/* 정지 버튼 */}
        {isPlaying && (
          <button
            onClick={onStop}
            aria-label="정지"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: 18,
              padding: "4px 8px",
              minWidth: "var(--touch-target)",
              minHeight: "var(--touch-target)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ◼
          </button>
        )}
      </div>

      {/* 진행률 바 */}
      <div
        style={{
          height: 2,
          borderRadius: 1,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
          marginTop: 4,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: "var(--accent-core)",
            borderRadius: 1,
            transition: "width 0.5s linear",
          }}
        />
      </div>

      <style>{`
        @keyframes wave {
          from { height: 4px; }
          to { height: 14px; }
        }
      `}</style>
    </div>
  );
}
