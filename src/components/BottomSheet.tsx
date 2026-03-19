"use client";

import { useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// 3단계 상태
// collapsed : 바닥에 숨어있음 (보이지 않음)
// peek      : 미니플레이어만 살짝 노출 (72px)
// expanded  : 연관 아티스트 카드 전체 표시 (55vh)
export type SheetState = "collapsed" | "peek" | "expanded";

interface Props {
  state: SheetState;
  onStateChange: (state: SheetState) => void;
  children: React.ReactNode;
}

const PEEK_HEIGHT    = 72;         // 미니플레이어 높이
const EXPANDED_VH   = 38;         // 확장 시 뷰포트 비율 (55 -> 38로 축소해 배경 가림 최소화)
const DRAG_THRESHOLD = 44;         // 상태 전환 트리거 드래그 거리 (px)

export default function BottomSheet({ state, onStateChange, children }: Props) {
  const dragStartY   = useRef<number>(0);
  const isDragging   = useRef(false);

  // ── 높이 계산 ──────────────────────────────────────────────
  const getHeight = () => {
    if (state === "collapsed") return 0;
    if (state === "peek")      return PEEK_HEIGHT;
    return `${EXPANDED_VH}vh`;
  };

  // ── 터치 드래그로 상태 전환 ────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = e.changedTouches[0].clientY - dragStartY.current;

    // 위로 스와이프 → 다음 단계
    if (delta < -DRAG_THRESHOLD) {
      if (state === "collapsed") onStateChange("peek");
      else if (state === "peek") onStateChange("expanded");
    }
    // 아래로 스와이프 → 이전 단계
    else if (delta > DRAG_THRESHOLD) {
      if (state === "expanded") onStateChange("peek");
      else if (state === "peek") onStateChange("collapsed");
    }
  }, [state, onStateChange]);

  // 마우스 드래그도 지원
  const mouseStartY = useRef<number>(0);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseStartY.current = e.clientY;
  }, []);
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const delta = e.clientY - mouseStartY.current;
    if (delta < -DRAG_THRESHOLD) {
      if (state === "collapsed") onStateChange("peek");
      else if (state === "peek") onStateChange("expanded");
    } else if (delta > DRAG_THRESHOLD) {
      if (state === "expanded") onStateChange("peek");
      else if (state === "peek") onStateChange("collapsed");
    }
  }, [state, onStateChange]);

  return (
    <motion.div
      className="bottom-sheet"
      animate={{ height: getHeight() }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      style={{
        touchAction: "none",
        // collapsed일 때는 보이지 않게
        pointerEvents: state === "collapsed" ? "none" : "auto",
        overflow: "hidden",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* ── 드래그 핸들 ─────────────────────────────── */}
      <div
        role="button"
        aria-label={state === "expanded" ? "시트 닫기" : "시트 열기"}
        onClick={() => {
          if (state === "peek")     onStateChange("expanded");
          else if (state === "expanded") onStateChange("peek");
        }}
        style={{
          width: "100%",
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: "rgba(255,255,255,0.18)",
          transition: "background 0.2s ease",
        }} />
      </div>

      {/* ── 콘텐츠 (핸들 아래 영역) ─────────────────── */}
      <div style={{ overflow: "hidden", height: "calc(100% - 28px)", display: "flex", flexDirection: "column" }}>
        {/* expanded일 때만 리스트 보임 — AnimatePresence로 부드럽게 */}
        <AnimatePresence>
          {state !== "collapsed" && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ height: "100%", overflow: "hidden" }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
