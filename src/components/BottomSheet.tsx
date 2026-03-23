"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";

// 3단계 상태
// collapsed : 바닥에 완전히 숨어있음
// peek      : 미니플레이어만 살짝 노출 (54px)
// expanded  : 연관 아티스트 카드 전체 표시 (~290px)
export type SheetState = "collapsed" | "peek" | "expanded";

interface Props {
  state: SheetState;
  onStateChange: (state: SheetState) => void;
  children: React.ReactNode;
}

const PEEK_HEIGHT     = 54;   // 미니플레이어 + 핸들 높이
const EXPANDED_HEIGHT = 290;  // 핸들(20) + 미니플레이어(54) + 카드영역(192) + 패딩(24)
const DRAG_THRESHOLD  = 44;   // 상태 전환 트리거 드래그 거리 (px)
const SHEET_TOTAL     = 400;  // 시트 컨테이너 전체 높이 (충분히 큰 고정값)

export default function BottomSheet({ state, onStateChange, children }: Props) {
  // V7.7: height 애니메이션 → transform: translateY 전환
  // 레이아웃 재계산(Layout Thrashing) 없이 GPU 컴포지팅으로 60fps 확보
  const dragStartY  = useRef<number>(0);
  const isDragging  = useRef(false);

  // iOS safe-area-inset-bottom을 JS로 계산 (env() CSS 변수는 JS에서 직접 읽기 불가)
  const [safeBottom, setSafeBottom] = useState(0);

  useEffect(() => {
    // CSS env(safe-area-inset-bottom) 값을 읽기 위해 숨은 div 활용
    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;bottom:0;left:0;width:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden";
    document.body.appendChild(el);
    const parsed = parseFloat(getComputedStyle(el).height) || 0;
    setSafeBottom(parsed);
    document.body.removeChild(el);
  }, []);

  // translateY 값 계산: SHEET_TOTAL에서 노출할 높이만큼 빼면 유저에게 보이는 부분
  // collapsed: 전부 화면 아래로 → y = SHEET_TOTAL + safeBottom
  // peek     : PEEK_HEIGHT만 보임 → y = SHEET_TOTAL - PEEK_HEIGHT - safeBottom
  // expanded: EXPANDED_HEIGHT만 보임 → y = SHEET_TOTAL - EXPANDED_HEIGHT - safeBottom
  const getY = useCallback(() => {
    const safe = safeBottom;
    if (state === "collapsed") return SHEET_TOTAL + safe;
    if (state === "peek")      return SHEET_TOTAL - PEEK_HEIGHT - safe;
    return Math.max(0, SHEET_TOTAL - EXPANDED_HEIGHT - safe);
  }, [state, safeBottom]);

  // ── 터치 드래그로 상태 전환 ────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest(".warp-list")) return;
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest(".warp-list")) return;
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = e.changedTouches[0].clientY - dragStartY.current;

    if (delta < -DRAG_THRESHOLD) {
      if (state === "collapsed") onStateChange("peek");
      else if (state === "peek") onStateChange("expanded");
    } else if (delta > DRAG_THRESHOLD) {
      if (state === "expanded") onStateChange("peek");
      else if (state === "peek") onStateChange("collapsed");
    }
  }, [state, onStateChange]);

  // ── 마우스 드래그도 지원 ───────────────────────────────────
  const mouseStartY = useRef<number>(0);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".warp-list")) return;
    mouseStartY.current = e.clientY;
    isDragging.current = true;
  }, []);
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".warp-list")) return;
    if (!isDragging.current) return;
    isDragging.current = false;
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
      // V7.7: height 대신 translateY 사용 → GPU 가속, Layout Thrashing 제거
      animate={{ y: getY() }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      style={{
        // 시트 컨테이너는 항상 SHEET_TOTAL 높이로 고정
        height: SHEET_TOTAL,
        // collapsed 상태에서도 아이템 클릭 차단
        pointerEvents: state === "collapsed" ? "none" : "auto",
        // overflow visible → 드래그 핸들 등의 클리핑 방지
        overflow: "hidden",
        touchAction: "pan-x",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* ── 드래그 핸들 ────────────────────────────────────── */}
      <div
        role="button"
        aria-label={state === "expanded" ? "시트 닫기" : "시트 열기"}
        onClick={() => {
          if (state === "peek")          onStateChange("expanded");
          else if (state === "expanded") onStateChange("peek");
        }}
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          zIndex: 10,
        }}
      >
        <div style={{
          width: 32, height: 4,
          borderRadius: 2,
          background: "rgba(255,255,255,0.18)",
        }} />
      </div>

      {/* ── 콘텐츠 영역 ─────────────────────────────────────── */}
      {/* collapsed 상태에서도 마운트 유지 (언마운트/재마운트 애니메이션 제거) */}
      <div
        style={{
          paddingTop: 8,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          // collapsed 시 투명도만 낮춤 (레이아웃 유지로 언마운트 jank 방지)
          opacity: state === "collapsed" ? 0 : 1,
          transition: "opacity 0.2s ease",
        }}
      >
        {children}
      </div>
    </motion.div>
  );
}
