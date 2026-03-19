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

// 궤도 링 설정
const RINGS = [
  { count: 5,  radius: 120, speed: 0.00018 },  // Ring 1: 가까운 궤도
  { count: 8,  radius: 210, speed: 0.00010 },  // Ring 2: 중간 궤도
  { count: 7,  radius: 300, speed: 0.00006 },  // Ring 3: 먼 궤도
];

// ── 시드 기반 결정적 랜덤 (같은 이름 → 항상 같은 위치) ──────────
function seededRng(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  h = Math.abs(h);
  // 두 개의 독립 난수 반환
  const r1 = ((h * 1664525 + 1013904223) >>> 0) / 0xffffffff;
  const r2 = ((h * 22695477 + 1)         >>> 0) / 0xffffffff;
  return { r1, r2 };
}

// ── 별 데이터 생성 (SSR-safe) ────────────────────────────────────
function generateStars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: ((i * 137.5) % 100),
    y: ((i * 97.3)  % 100),
    size: 1 + (i % 3) * 0.5,
    opacity: 0.18 + (i % 5) * 0.08,
    duration: 2 + (i % 4),
    delay: (i % 30) * 0.2,
    // 패럴랙스 레이어 (0=near, 1=mid, 2=far)
    layer: i % 3,
  }));
}

// ── 위성 인덱스 → 링 정보 ────────────────────────────────────────
function getRingForIndex(index: number): { ringIdx: number; posInRing: number } {
  let acc = 0;
  for (let r = 0; r < RINGS.length; r++) {
    if (index < acc + RINGS[r].count) return { ringIdx: r, posInRing: index - acc };
    acc += RINGS[r].count;
  }
  return { ringIdx: RINGS.length - 1, posInRing: index - (acc - RINGS[RINGS.length - 1].count) };
}

export default function Cosmos({ data, focusedIndex, onCoreTap, onSatelliteTap }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const satelliteRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const animFrameRef   = useRef<number>(0);
  const startTimeRef   = useRef<number>(Date.now());

  const stars = useMemo(() => generateStars(80), []);

  // ── 각 위성의 결정적 오프셋 (시드 기반, 마운트 1회만 계산) ─────
  const scatterOffsets = useMemo(() => {
    return data.satellites.map((sat) => {
      const { r1, r2 } = seededRng(sat.spotifyId);
      return {
        radiusFactor: 1 + (r1 - 0.5) * 0.7,   // ×0.65 ~ ×1.35
        angleOffset:  (r2 - 0.5) * 0.55,        // ±~17°
      };
    });
  }, [data.satellites]);

  // ── rAF 공전 + Dynamic Fog ───────────────────────────────────
  useEffect(() => {
    let lastFrame = 0;
    const FPS_LIMIT = 30;
    const INTERVAL = 1000 / FPS_LIMIT;

    // 안개 상수
    const FOG_CLEAR = 260;   // 이 안쪽은 완전 선명
    const FOG_FULL  = 680;   // 이 바깥은 최대 흐림

    function animate(now: number) {
      animFrameRef.current = requestAnimationFrame(animate);
      if (now - lastFrame < INTERVAL) return;
      lastFrame = now;

      const elapsed = now - startTimeRef.current;
      const container = containerRef.current;
      if (!container) return;

      const cw = container.clientWidth  / 2;
      const ch = container.clientHeight / 2;
      // Dynamic Fog: 화면 정중앙 기준
      const viewCX = window.innerWidth  / 2;
      const viewCY = window.innerHeight / 2;

      data.satellites.forEach((_, i) => {
        const el = satelliteRefs.current[i];
        if (!el) return;

        const { ringIdx, posInRing } = getRingForIndex(i);
        const ring = RINGS[ringIdx];
        const scatter = scatterOffsets[i] ?? { radiusFactor: 1, angleOffset: 0 };

        const actualRadius = ring.radius * scatter.radiusFactor;
        const baseAngle    = (posInRing / ring.count) * 2 * Math.PI + scatter.angleOffset;
        const angle        = baseAngle + elapsed * ring.speed;

        // 우주 좌표
        const worldX = Math.cos(angle) * actualRadius;
        const worldY = Math.sin(angle) * actualRadius * 0.52; // 원근감 (타원)

        // 화면 좌표
        const screenX = cw + worldX;
        const screenY = ch + worldY;

        // 화면 정중앙과의 거리 → Dynamic Fog 보간
        const dist = Math.hypot(screenX - viewCX, screenY - viewCY);
        const t = Math.max(0, Math.min(1, (dist - FOG_CLEAR) / (FOG_FULL - FOG_CLEAR)));
        const blur    = t * 4;               // 0 ~ 4px
        const opacity = 1 - t * 0.72;       // 1.0 ~ 0.28

        const isFocused = focusedIndex === i;
        const scale     = isFocused ? 1.3 : 1;

        // DOM 직접 조작 (React re-render 없이 60fps 유지)
        el.style.transform = `translate(calc(${screenX}px - 50%), calc(${screenY}px - 50%)) scale(${scale})`;
        el.style.zIndex    = isFocused ? "10" : "5";
        el.style.filter    = isFocused ? "none" : `blur(${blur.toFixed(2)}px)`;
        el.style.opacity   = isFocused ? "1" : opacity.toFixed(3);

        // 이름 라벨: 너무 흐리면 숨김 (불필요한 텍스트 렌더링 방지)
        const label = el.querySelector<HTMLElement>("[data-label]");
        if (label) label.style.display = blur > 2.5 ? "none" : "";
      });
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [data.satellites, focusedIndex, scatterOffsets]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        // CSS perspective 기반 깊이감
        perspective: "1200px",
        perspectiveOrigin: "50% 50%",
      }}
    >
      {/* ── 성운 배경 ────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 45%, var(--bg-nebula) 0%, var(--bg-nebula-2) 40%, var(--bg-cosmos) 100%)`,
        }}
      />

      {/* ── 배경 별 (3개 레이어로 분산) ─────────────── */}
      {stars.map((star) => (
        <div
          key={star.id}
          className="star"
          style={{
            left: `${star.x}%`,
            top:  `${star.y}%`,
            width:  `${star.size}px`,
            height: `${star.size}px`,
            "--opacity-min": star.opacity * 0.3,
            "--opacity-max": star.opacity,
            "--duration": `${star.duration}s`,
            "--delay":    `${star.delay}s`,
            // 레이어별 z-depth: far=뒤, near=앞
            transform: `translateZ(${star.layer === 0 ? 0 : star.layer === 1 ? -50 : -100}px)`,
          } as React.CSSProperties}
        />
      ))}

      {/* ── 궤도 링 SVG (점선 타원) ──────────────────── */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        aria-hidden="true"
      >
        <defs>
          <filter id="ring-glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {RINGS.map((ring, i) => {
          const colors = ["var(--ring-1)", "var(--ring-2)", "var(--ring-3)"];
          const zScale = 1 - i * 0.12; // 먼 링일수록 작게 보임
          return (
            <ellipse
              key={i}
              cx="50%"
              cy="50%"
              rx={ring.radius * zScale}
              ry={ring.radius * 0.52 * zScale}
              fill="none"
              stroke={colors[i]}
              strokeWidth="1"
              strokeDasharray="3 10"
              opacity={1 - i * 0.25}
            />
          );
        })}
      </svg>

      {/* ── 코어 노드 ─────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%) translateZ(30px)",
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

      {/* ── 위성 노드 (rAF 위치 + Dynamic Fog) ────────── */}
      {data.satellites.map((satellite, i) => (
        <div
          key={satellite.spotifyId}
          ref={(el) => { satelliteRefs.current[i] = el; }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            willChange: "transform, filter, opacity",
            transition: "filter 0.3s ease, opacity 0.3s ease",
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
