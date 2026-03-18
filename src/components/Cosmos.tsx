"use client";

import { useEffect, useRef, useMemo } from "react";
import type { CosmosData } from "@/lib/types";
import CosmosNode from "./CosmosNode";

interface Props {
  data: CosmosData;
  focusedIndex: number | null;
  onCoreTap: () => void;
  onSatelliteTap: (index: number) => void;
}

// 궤도 링 설정 (FINAL_PLAN.md 기반)
const RINGS = [
  { count: 5,  radius: 110, speed: 0.00018 },  // Ring 1: 0~4
  { count: 8,  radius: 195, speed: 0.00010 },  // Ring 2: 5~12
  { count: 7,  radius: 275, speed: 0.00006 },  // Ring 3: 13~19
];

// 별 데이터 생성 (SSR-safe: 클라이언트에서만 실행)
function generateStars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (((i * 137.5) % 100)),   // 황금각 분포
    y: (((i * 97.3) % 100)),
    size: 1 + (i % 3) * 0.5,
    opacity: 0.2 + (i % 5) * 0.1,
    duration: 2 + (i % 4),
    delay: (i % 30) * 0.2,
  }));
}

// 궤도별 위성 인덱스 범위 계산
function getRingForIndex(index: number): { ringIdx: number; posInRing: number } {
  let acc = 0;
  for (let r = 0; r < RINGS.length; r++) {
    if (index < acc + RINGS[r].count) {
      return { ringIdx: r, posInRing: index - acc };
    }
    acc += RINGS[r].count;
  }
  return { ringIdx: RINGS.length - 1, posInRing: index - (acc - RINGS[RINGS.length - 1].count) };
}

export default function Cosmos({ data, focusedIndex, onCoreTap, onSatelliteTap }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const satelliteRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());

  const stars = useMemo(() => generateStars(40), []);

  // rAF 기반 공전 애니메이션 (15fps로 제한 — 배터리 절약)
  useEffect(() => {
    let lastFrame = 0;
    const FPS_LIMIT = 15;
    const INTERVAL = 1000 / FPS_LIMIT;

    function animate(now: number) {
      animFrameRef.current = requestAnimationFrame(animate);
      if (now - lastFrame < INTERVAL) return;
      lastFrame = now;

      const elapsed = now - startTimeRef.current;
      const container = containerRef.current;
      if (!container) return;

      const cw = container.clientWidth / 2;
      const ch = container.clientHeight / 2;

      data.satellites.forEach((_, i) => {
        const el = satelliteRefs.current[i];
        if (!el) return;

        const { ringIdx, posInRing } = getRingForIndex(i);
        const ring = RINGS[ringIdx];
        const baseAngle = (posInRing / ring.count) * 2 * Math.PI;
        const angle = baseAngle + elapsed * ring.speed;

        const x = Math.cos(angle) * ring.radius;
        const y = Math.sin(angle) * ring.radius * 0.55; // 원근감

        const isFocused = focusedIndex === i;
        const scale = isFocused ? 1.3 : 1;

        el.style.transform = `translate(calc(${cw + x}px - 50%), calc(${ch + y}px - 50%)) scale(${scale})`;
        el.style.zIndex = isFocused ? "10" : "5";
      });
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [data.satellites, focusedIndex]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
      {/* 성운 배경 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 45%, var(--bg-nebula) 0%, var(--bg-nebula-2) 40%, var(--bg-cosmos) 100%)`,
        }}
      />

      {/* 별 */}
      {stars.map((star) => (
        <div
          key={star.id}
          className="star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            "--opacity-min": star.opacity * 0.3,
            "--opacity-max": star.opacity,
            "--duration": `${star.duration}s`,
            "--delay": `${star.delay}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* 궤도 링 SVG */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        aria-hidden="true"
      >
        {RINGS.map((ring, i) => {
          const colors = ["var(--ring-1)", "var(--ring-2)", "var(--ring-3)"];
          return (
            <ellipse
              key={i}
              cx="50%"
              cy="50%"
              rx={ring.radius}
              ry={ring.radius * 0.55}
              fill="none"
              stroke={colors[i]}
              strokeWidth="1"
              strokeDasharray="4 8"
            />
          );
        })}
      </svg>

      {/* 코어 노드 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 20,
        }}
      >
        <CosmosNode
          artist={data.core}
          size={88}
          isCore
          isFocused={false}
          onClick={onCoreTap}
        />
      </div>

      {/* 위성 노드 (rAF로 위치 업데이트) */}
      {data.satellites.map((satellite, i) => (
        <div
          key={satellite.spotifyId}
          ref={(el) => { satelliteRefs.current[i] = el; }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            willChange: "transform",
            transition: "z-index 0s",
          }}
        >
          <CosmosNode
            artist={satellite}
            size={focusedIndex === i ? 56 : 44}
            isCore={false}
            isFocused={focusedIndex === i}
            onClick={() => onSatelliteTap(i)}
          />
        </div>
      ))}
    </div>
  );
}
