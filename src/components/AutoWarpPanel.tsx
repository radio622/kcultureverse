"use client";

/**
 * 🚀 AutoWarpPanel — 자율주행 UI
 * 우하단에 떠 있는 플로팅 패널
 * - 시작/정지 버튼
 * - 실시간 Flight Log (방문 경로 표시)
 * - 로그인 유저 전용 게이트 (로그인 요구 메시지)
 */
import { useMemo } from "react";

interface WarpStep {
  nodeId: string;
  name: string;
  timestamp: number;
}

interface Props {
  isWarping: boolean;
  flightLog: WarpStep[];
  currentStep: number;
  focusedId: string | null;
  focusedName: string;
  isLoggedIn: boolean;
  onStart: (nodeId: string) => void;
  onStop: () => void;
}

export default function AutoWarpPanel({
  isWarping,
  flightLog,
  currentStep,
  focusedId,
  focusedName,
  isLoggedIn,
  onStart,
  onStop,
}: Props) {
  // 비행 시간 계산
  const flightTime = useMemo(() => {
    if (flightLog.length < 2) return 0;
    return Math.round((flightLog[flightLog.length - 1].timestamp - flightLog[0].timestamp) / 1000);
  }, [flightLog]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 100,
      right: 16,
      zIndex: 95,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 8,
    }}>
      {/* Flight Log (자율주행 중일 때만) */}
      {isWarping && flightLog.length > 0 && (
        <div style={{
          background: "rgba(7,9,20,0.92)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(167,139,250,0.2)",
          borderRadius: 14,
          padding: "10px 14px",
          maxWidth: 220,
          maxHeight: 180,
          overflowY: "auto",
          scrollbarWidth: "none",
        }}>
          {/* 헤더 */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 8, paddingBottom: 6,
            borderBottom: "1px solid rgba(167,139,250,0.1)",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#c084fc" }}>
              🚀 비행 경로
            </span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
              {currentStep}정거장 · {formatTime(flightTime)}
            </span>
          </div>

          {/* 경로 목록 */}
          {flightLog.slice(-8).map((step, i, arr) => (
            <div key={`${step.nodeId}-${step.timestamp}`} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "3px 0",
              opacity: i === arr.length - 1 ? 1 : 0.5,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                background: i === arr.length - 1 ? "#c084fc" : "rgba(167,139,250,0.3)",
                boxShadow: i === arr.length - 1 ? "0 0 6px rgba(167,139,250,0.5)" : "none",
              }} />
              <span style={{
                fontSize: 11, color: "#e2e8f0",
                fontWeight: i === arr.length - 1 ? 600 : 400,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {step.name}
              </span>
              {i < arr.length - 1 && (
                <span style={{
                  fontSize: 8, color: "rgba(167,139,250,0.3)",
                  position: "absolute", left: 16, marginTop: 16,
                }}>│</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 자율주행 버튼 */}
      {isWarping ? (
        <button
          id="autowarp-stop-btn"
          onClick={onStop}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5", fontSize: 14,
            cursor: "pointer", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
            animation: "wpulse 2s ease infinite",
          }}
          title="자율주행 정지"
        >
          ■
        </button>
      ) : (
        <button
          id="autowarp-start-btn"
          onClick={() => {
            if (!isLoggedIn) {
              alert("자율주행은 로그인 유저만 사용할 수 있습니다.\n우측 상단에서 구글 로그인을 해주세요. 🚀");
              return;
            }
            if (!focusedId) {
              alert("아티스트를 먼저 선택한 후 자율주행을 시작하세요. ✦");
              return;
            }
            onStart(focusedId);
          }}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: "rgba(10,14,26,0.85)",
            border: "1px solid rgba(167,139,250,0.25)",
            color: "rgba(200,180,255,0.8)", fontSize: 16,
            cursor: "pointer", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.15)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(10,14,26,0.85)")}
          title={focusedId
            ? `🚀 ${focusedName}에서 자율주행 시작`
            : "아티스트 선택 후 자율주행"}
        >
          🚀
        </button>
      )}
    </div>
  );
}
