"use client";

import { useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Props {
  state: "collapsed" | "expanded";
  onStateChange: (state: "collapsed" | "expanded") => void;
  children: React.ReactNode;
  miniPlayerProps?: {
    isPlaying: boolean;
    trackName: string | null;
    progress: number;
    onStop: () => void;
  };
}

const COLLAPSED_HEIGHT = 72;
const EXPANDED_HEIGHT_VH = 60;

export default function BottomSheet({ state, onStateChange, children }: Props) {
  const dragStartY = useRef<number>(0);
  const isDragging = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const delta = e.changedTouches[0].clientY - dragStartY.current;

      // 50px 이상 드래그 시 상태 전환
      if (delta < -50 && state === "collapsed") {
        onStateChange("expanded");
      } else if (delta > 50 && state === "expanded") {
        onStateChange("collapsed");
      }
    },
    [state, onStateChange]
  );

  const expanded = state === "expanded";

  return (
    <motion.div
      ref={sheetRef}
      className="bottom-sheet"
      animate={{
        height: expanded ? `${EXPANDED_HEIGHT_VH}vh` : COLLAPSED_HEIGHT,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{ touchAction: "none" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 드래그 핸들 */}
      <div
        className="bottom-sheet__handle"
        onClick={() => onStateChange(expanded ? "collapsed" : "expanded")}
        role="button"
        aria-label={expanded ? "시트 닫기" : "시트 열기"}
      />

      {/* 콘텐츠 */}
      <div style={{ overflow: "hidden", height: "calc(100% - 36px)" }}>
        {children}
      </div>
    </motion.div>
  );
}
