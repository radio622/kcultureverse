"use client";

import { useState, useEffect } from "react";

interface Props {
  isPlaying: boolean;
  trackName: string | null;
  progress: number;  // 0~1
  onStop: () => void;
  onTogglePause?: () => void;
  /** peek 상태에서 탭하면 expanded로 */
  onExpand?: () => void;
  sheetState?: "collapsed" | "peek" | "expanded";
  artistName?: string | null;
}

export default function MiniPlayer({
  isPlaying,
  trackName,
  progress,
  onStop,
  onTogglePause,
  onExpand,
  sheetState = "peek",
  artistName,
}: Props) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth <= 768);
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 아무것도 재생 안 하고 peek 상태면: 안내 문구
  if (!trackName && !isPlaying) {
    return (
      <div
        style={{
          padding: "0 20px",
          height: 44,
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "default",
          flexShrink: 0,    // ← 절대 찌그러지지 않음
        }}
      >
        {/* 별 아이콘 */}
        <span style={{ fontSize: 14, opacity: 0.5 }}>✦</span>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          별을 클릭해 음악을 들어보세요
        </p>
      </div>
    );
  }

  return (
    <div
      onClick={sheetState === "peek" ? onExpand : undefined}
      style={{
        padding: "0 20px",
        cursor: sheetState === "peek" ? "pointer" : "default",
        flexShrink: 0,    // ← 절대 찌그러지지 않음
        borderBottom: sheetState === "expanded" ? "1px solid rgba(167,139,250,0.12)" : "none",
        background: (isPlaying && sheetState === "expanded")
          ? "rgba(167,139,250,0.06)"
          : "transparent",
        transition: "background 0.3s ease",
        marginBottom: sheetState === "expanded" ? 4 : 0,
      }}
    >
      {/* ── 트랙 정보 + 컨트롤 ─────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 44,
          gap: 12,
        }}
      >
        {/* 파동 인디케이터 */}
        <div style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 3,
                borderRadius: 2,
                background: "var(--accent-core)",
                height: isPlaying ? `${6 + i * 3}px` : "4px",
                animation: isPlaying
                  ? `mwave ${0.5 + i * 0.1}s ease-in-out infinite alternate`
                  : "none",
                transition: "height 0.3s ease",
              }}
            />
          ))}
        </div>

        {/* 트랙명 (클릭하면 재생/정지 토글) */}
        <div
          onClick={(e) => { 
            if (trackName) { 
              e.stopPropagation(); 
              onTogglePause?.(); 
            } 
          }}
          style={{ flex: 1, minWidth: 0, cursor: trackName ? "pointer" : "default" }}
        >
          <span
            style={{
              fontSize: 12,
              color: isPlaying ? "var(--text-primary)" : "var(--text-secondary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
              fontWeight: isPlaying ? 500 : 400,
              transition: "color 0.3s ease",
            }}
          >
            {isPlaying ? "⏸ " : trackName ? "▶ " : ""}
            {isMobile 
              ? <>{trackName ?? "재생 준비 중..."} {artistName ? ` - ${artistName}` : ""}</>
              : <>{artistName ? `${artistName} - ` : ""}{trackName ?? "재생 준비 중..."}</>
            }
          </span>
          {/* peek 상태에서 "위로 스와이프" 힌트 */}
          {sheetState === "peek" && (
            <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginTop: 1 }}>
              {isPlaying ? "탭하면 일시정지" : trackName ? "탭하면 계속 재생" : "탭하면 관련 아티스트 보기"}
            </span>
          )}
        </div>

        {/* 정지 버튼 */}
        {isPlaying && (
          <button
            onClick={(e) => { e.stopPropagation(); onStop(); }}
            aria-label="정지"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: 16,
              padding: "4px 8px",
              minWidth: 44,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              transition: "background 0.2s ease",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
          >
            ◼
          </button>
        )}
      </div>

      {/* ── 진행률 바 ────────────────────────────────── */}
      <div
        style={{
          height: 2,
          borderRadius: 1,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
          marginTop: 0,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.round(progress * 100)}%`,
            background: `linear-gradient(90deg, var(--accent-core) 0%, rgba(167,139,250,0.6) 100%)`,
            borderRadius: 1,
            transition: "width 0.5s linear",
          }}
        />
      </div>

      <style>{`
        @keyframes mwave {
          from { height: 4px; }
          to   { height: 16px; }
        }
      `}</style>
    </div>
  );
}
