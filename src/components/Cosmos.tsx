"use client";

import { useEffect, useRef, useMemo } from "react";
import type { CosmosData, DeepSpaceNode } from "@/lib/types";
import CosmosNode from "./CosmosNode";

interface Props {
  data: CosmosData;
  focusedIndex: number | null;
  onCoreTap: () => void;
  onSatelliteTap: (index: number) => void;
  /** 심우주 노드 (먼 배경에 흐릿하게 보이는 다른 허브 아티스트들) */
  deepSpaceNodes?: DeepSpaceNode[];
  onDeepSpaceTap?: (spotifyId: string) => void;
}

// ── 궤도 링 설정 (Step 3: 반경 확대로 광활한 우주 공간) ──────────
const RINGS = [
  { count: 5,  radius: 160, speed: 0.00015 },  // Ring 1: 가까운
  { count: 8,  radius: 290, speed: 0.00009 },  // Ring 2: 중간
  { count: 7,  radius: 430, speed: 0.00005 },  // Ring 3: 먼
];

// ── 시드 기반 결정적 랜덤 ────────────────────────────────────────
function seededRng(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  h = Math.abs(h);
  const r1 = ((h * 1664525  + 1013904223) >>> 0) / 0xffffffff;
  const r2 = ((h * 22695477 + 1)          >>> 0) / 0xffffffff;
  return { r1, r2 };
}

// ── 배경 별 데이터 생성 ─────────────────────────────────────────
function generateStars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    // -50% ~ 150% 범위로 넓게 분포 → 카메라 이동 시 패럴랙스 효과 자연스러움
    x: ((i * 137.5) % 200) - 50,
    y: ((i * 97.3)  % 200) - 50,
    size: 0.8 + (i % 4) * 0.5,
    opacity: 0.15 + (i % 6) * 0.07,
    duration: 2 + (i % 5),
    delay: (i % 40) * 0.15,
    // 0=near(빠름), 1=mid, 2=far(느림)
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

// ── Dynamic Fog 상수 (기존 위성용) ───────────────────────────────
const FOG_CLEAR  = 160;
const FOG_FULL   = 500;
const FOG_BLUR   = 5;
const FOG_ALPHA  = 0.25;

// ── 심우주 Fog 상수 (더 넓은 범위) ────────────────────────
const DEEP_FOG_CLEAR = 200;
const DEEP_FOG_FULL  = 900;
const DEEP_FOG_ALPHA = 0.08; // 심우주는 더 희미하게

// ── 무한 루프 우주 (Torus Topology) ─────────────────────────────
const UNIVERSE_W = 4000;   // 우주 가로 크기: x ∈ [-2000, +2000)
const UNIVERSE_H = 3000;   // 우주 세로 크기: y ∈ [-1500, +1500)

/** 좌표를 [-half, +half) 범위로 순환 (모듈러 래핑) */
function wrap(val: number, half: number): number {
  const size = half * 2;
  return ((val + half) % size + size) % size - half;
}

/** Torus 공간에서 from → to 최단 이동량 반환 */
function shortestDelta(from: number, to: number, half: number): number {
  const size = half * 2;
  let d = ((to - from) % size + size) % size;
  if (d > half) d -= size;
  return d;
}

export default function Cosmos({ data, focusedIndex, onCoreTap, onSatelliteTap, deepSpaceNodes = [], onDeepSpaceTap }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const zoomWrapperRef = useRef<HTMLDivElement>(null);
  const universeRef    = useRef<HTMLDivElement>(null);
  
  // 카메라 워프 타겟 (심우주 다이브 시 부드러운 패닝용)
  const warpTargetRef = useRef<{ x: number, y: number, id: string, done: boolean, progress?: number } | null>(null);

  const satelliteRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const deepSpaceRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const starRefs       = useRef<(HTMLDivElement | null)[]>([]);
  const animFrameRef   = useRef<number>(0);
  const startTimeRef   = useRef<number>(Date.now());

  // 카메라 오프셋 (camera = 우주 전체가 얼마나 이동했는지)
  const camera = useRef({ x: 0, y: 0 });
  // 줌 레벨 (1 = 기본, 0.4 = 엀청 축소, 2.5 = 최대 확대)
  const zoomRef = useRef(1);
  // 드래그 상태
  const drag = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    velX: 0,
    velY: 0,
  });
  // 핀치 줌 상태
  const pinch = useRef({ active: false, startDist: 0, startZoom: 1 });

  const stars = useMemo(() => generateStars(200), []);

  // 위성별 결정적 오프셋 (시드 기반)
  const scatterOffsets = useMemo(() =>
    data.satellites.map((sat) => {
      const { r1, r2 } = seededRng(sat.spotifyId);
      return {
        radiusFactor: 1 + (r1 - 0.5) * 0.65,  // ×0.675 ~ ×1.325
        angleOffset:  (r2 - 0.5) * 0.5,         // ±~14°
      };
    }),
  [data.satellites]);

  // ── 드래그 이벤트 핸들러 (pointerEvent로 터치+마우스 통합) ────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function clamp(v: number, lo: number, hi: number) {
      return Math.max(lo, Math.min(hi, v));
    }

    function onDown(e: PointerEvent) {
      // 버튼 클릭(Cosmos Node)이면 드래그 시작 안 함
      if ((e.target as HTMLElement).closest("button")) return;
      drag.current.active = true;
      drag.current.startX = e.clientX - camera.current.x;
      drag.current.startY = e.clientY - camera.current.y;
      drag.current.lastX  = e.clientX;
      drag.current.lastY  = e.clientY;
      drag.current.velX   = 0;
      drag.current.velY   = 0;
      if (el) {
        el.style.cursor = "grabbing";
        el.setPointerCapture(e.pointerId);
      }
    }

    function onMove(e: PointerEvent) {
      if (!drag.current.active) return;
      drag.current.velX = e.clientX - drag.current.lastX;
      drag.current.velY = e.clientY - drag.current.lastY;
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;

      camera.current.x = e.clientX - drag.current.startX;
      camera.current.y = e.clientY - drag.current.startY;
    }

    function onUp() {
      drag.current.active = false;
      const el = containerRef.current;
      if (el) el.style.cursor = "grab";
      // 관성 시작: velX/velY를 이어서 감속
    }

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup",   onUp);
    el.addEventListener("pointercancel", onUp);

    // ── 핀치 줌 (터치) + 휠 줌 (마우스) ───────────────────
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinch.current.active = true;
        pinch.current.startDist = Math.hypot(dx, dy);
        pinch.current.startZoom = zoomRef.current;
        drag.current.active = false; // 드래그 중단
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinch.current.active) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = dist / pinch.current.startDist;
        zoomRef.current = Math.max(0.4, Math.min(2.5, pinch.current.startZoom * scale));
      }
    }
    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        pinch.current.active = false;
      }
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.92 : 1.08; // 스크롤 다운 = 축소, 업 = 확대
      zoomRef.current = Math.max(0.4, Math.min(2.5, zoomRef.current * delta));
    }

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup",   onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  // ── rAF 메인 루프: 공전 + 관성 + Dynamic Fog + 패럴랙스 ───────
  useEffect(() => {
    const FRICTION = 0.91;   // 관성 감속 계수
    const FPS_LIMIT = 60;
    const INTERVAL  = 1000 / FPS_LIMIT;
    let lastFrame   = 0;

    function clamp(v: number, lo: number, hi: number) {
      return Math.max(lo, Math.min(hi, v));
    }

    function animate(time: number) {
      animFrameRef.current = requestAnimationFrame(animate);
      if (time - lastFrame < INTERVAL) return;
      lastFrame = time;

      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      const container = containerRef.current;
      if (!container) return;

      // ── 관성 및 워프 이동 처리 ────────────────────────────────
      if (warpTargetRef.current) {
        // 워프 타겟이 설정되면 관성을 무시하고 해당 방향으로 카메라를 부드럽게 끌어당김
        const wt = warpTargetRef.current;
        const dx = shortestDelta(camera.current.x, wt.x, UNIVERSE_W / 2);
        const dy = shortestDelta(camera.current.y, wt.y, UNIVERSE_H / 2);
        
        // 거리에 비례하여 이동 (점점 느려지는 ease-out 곡선, 속도를 조금 줄여 우아하게)
        camera.current.x += dx * 0.035;
        camera.current.y += dy * 0.035;

        // 목표에 거의 도달했다면 실제로 라우팅 실행
        if (Math.hypot(dx, dy) < 5 && !wt.done) {
          wt.done = true;
          onDeepSpaceTap?.(wt.id); // 화면 전환 시작
        }
      } else if (!drag.current.active) {
        const speed = Math.hypot(drag.current.velX, drag.current.velY);
        if (speed > 0.3) {
          drag.current.velX *= FRICTION;
          drag.current.velY *= FRICTION;
          camera.current.x += drag.current.velX;
          camera.current.y += drag.current.velY;
        }
      }

      const camX = camera.current.x;
      const camY = camera.current.y;

      // ── 페이드 애니메이션 (마운트인 & 다이브아웃) ──────────────
      let warpProgress = 0;
      let targetId: string | null = null;
      if (warpTargetRef.current && !warpTargetRef.current.done) {
        warpTargetRef.current.progress = Math.min(1, (warpTargetRef.current.progress || 0) + 0.015); // 약 1초 동안 1도달
        warpProgress = warpTargetRef.current.progress;
        targetId = warpTargetRef.current.id;
      }
      const mountElapsed = Math.max(0, now - startTimeRef.current);
      const mountFade = Math.min(1, mountElapsed / 1000); // 1초 동안 1로 페이드인

      // ── 줌 래퍼: 별+우주+심우주 모든 레이어에 줌 동시 적용 ──
      const zoom = zoomRef.current;
      const zw = zoomWrapperRef.current;
      if (zw) {
        zw.style.transform = `scale(${zoom})`;
      }

      // ── 우주 레이어 카메라 오프셋 이동 ────────────────────
      const uni = universeRef.current;
      if (uni) {
        uni.style.transform = `translate(${camX}px, ${camY}px)`;
      }

      // ── 패럴랙스 별 이동 ──────────────────────────────────
      const PARALLAX = [1.0, 0.45, 0.18]; // near/mid/far 배율
      stars.forEach((star, i) => {
        const el = starRefs.current[i];
        if (!el) return;
        const px = camX * PARALLAX[star.layer];
        const py = camY * PARALLAX[star.layer];
        el.style.transform = `translate(${px}px, ${py}px)`;
      });

      // ── 화면 중심 기준으로 Viewport Center 계산 ──────────
      const cw = container.clientWidth  / 2;
      const ch = container.clientHeight / 2;
      // 카메라 이동했으므로: 우주의 원점(코어 위치)이 화면에서 차지하는 위치
      const originScreenX = cw + camX;
      const originScreenY = ch + camY;

      // ── 위성 공전 위치 + Dynamic Fog ─────────────────────
      data.satellites.forEach((_, i) => {
        const el = satelliteRefs.current[i];
        if (!el) return;

        const { ringIdx, posInRing } = getRingForIndex(i);
        const ring    = RINGS[ringIdx];
        const scatter = scatterOffsets[i] ?? { radiusFactor: 1, angleOffset: 0 };

        const actualRadius = ring.radius * scatter.radiusFactor;
        const baseAngle    = (posInRing / ring.count) * 2 * Math.PI + scatter.angleOffset;
        const angle        = baseAngle + elapsed * ring.speed;

        // 우주 좌표 (카메라 이동 전 원점 기준)
        const worldX = Math.cos(angle) * actualRadius;
        const worldY = Math.sin(angle) * actualRadius * 0.5; // 타원 원근감

        // 위성 노드의 실제 화면 좌표 (카메라 포함)
        const screenX = originScreenX + worldX;
        const screenY = originScreenY + worldY;

        // ── Dynamic Fog: 화면 정중앙과의 거리 ───────────────
        const dist = Math.hypot(screenX - cw, screenY - ch);
        const t    = Math.max(0, Math.min(1, (dist - FOG_CLEAR) / (FOG_FULL - FOG_CLEAR)));
        const blur    = t * FOG_BLUR;
        const opacity = 1 - t * (1 - FOG_ALPHA);

        const isFocused = focusedIndex === i;
        const scale     = isFocused ? 1.35 : 1;
        let finalOpacity = isFocused ? 1 : opacity;

        // 마운트 시 서서히 나타나는 효과 (기존 코어는 그대로 두고 위성들만 스르륵 나타남)
        finalOpacity *= mountFade;
        // 다이브 페이드아웃 효과 (워프 대상은 남고 나머지는 서서히 사라짐)
        if (targetId && data.satellites[i].spotifyId !== targetId) {
          finalOpacity *= (1 - warpProgress);
        }

        // ── DOM 직접 조작 (React 리렌더 없이 60fps 유지) ────
        // 위성 노드는 universeRef 내부에 있으므로, camX/camY가 이미 반영됨
        // 따라서 worldX/worldY만 이용해 원점 기준으로 위치 설정
        el.style.transform = `translate(calc(${cw + worldX}px - 50%), calc(${ch + worldY}px - 50%)) scale(${scale})`;
        el.style.zIndex    = isFocused ? "10" : "5";
        el.style.filter    = isFocused ? "none" : `blur(${blur.toFixed(2)}px)`;
        el.style.opacity   = finalOpacity.toFixed(3);

        // 이름 라벨: blur 심하면 숨김
        const label = el.querySelector<HTMLElement>("[data-label]");
        if (label) label.style.display = blur > 2.8 ? "none" : "";
      });
      // ── 심우주 노드 Dynamic Fog (4프레임당 1회 업데이트 — 성능 최적화)
      const deepFrame = Math.floor(now / (INTERVAL * 4));
      if (deepFrame !== (animate as any).__lastDeepFrame) {
        (animate as any).__lastDeepFrame = deepFrame;

        deepSpaceNodes.forEach((node, i) => {
          const el = deepSpaceRefs.current[i];
          if (!el) return;

          // Torus 래핑: 카메라 기준 상대 위치를 우주 범위 안으로 순환
          const relX = wrap(node.x + camX, UNIVERSE_W / 2);
          const relY = wrap(node.y + camY, UNIVERSE_H / 2);

          // ── Phase 0: Viewport Culling — 시야 밖 노드 건너뛰기 ──
          // Fog가 900px 밖을 완전히 가리므로, 1200px 밖은 계산할 필요 없음
          if (Math.abs(relX) > 1200 || Math.abs(relY) > 1200) {
            el.style.opacity = "0";
            return;
          }

          const screenX = cw + relX;
          const screenY = ch + relY;

          const dist = Math.hypot(relX, relY);
          const t    = Math.max(0, Math.min(1, (dist - DEEP_FOG_CLEAR) / (DEEP_FOG_FULL - DEEP_FOG_CLEAR)));
          let finalOpacity = 1 - t * (1 - DEEP_FOG_ALPHA);

          finalOpacity *= mountFade;
          if (targetId && node.spotifyId !== targetId) {
            finalOpacity *= (1 - warpProgress);
          }

          el.style.opacity = finalOpacity.toFixed(3);
          // Torus: 래핑된 좌표로 위치 동적 갱신 (universeRef 밖이므로 직접 배치)
          el.style.transform = `translate(calc(${screenX}px - 50%), calc(${screenY}px - 50%))`;

          // 이름 라벨: 멀면 숨김
          const label = el.querySelector<HTMLElement>("[data-deep-label]");
          if (label) label.style.display = finalOpacity < 0.35 ? "none" : "";
        });
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [data.satellites, focusedIndex, scatterOffsets, stars, deepSpaceNodes]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        cursor: "grab",
        userSelect: "none",
        // CSS perspective로 2.5D 깊이감
        perspective: "1000px",
        perspectiveOrigin: "50% 50%",
      }}
    >
      {/* ── 성운 배경 (카메라 이동 불필요 — 고정 레이어) ──── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 90% 70% at 50% 50%, var(--bg-nebula) 0%, var(--bg-nebula-2) 45%, var(--bg-cosmos) 100%)`,
          zIndex: 0,
        }}
      />

      {/* ── 줌 래퍼: 별+우주+심우주를 모두 감싸서 핀치줌/휠줌 동시 적용 ── */}
      <div
        ref={zoomWrapperRef}
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "50% 50%",
          willChange: "transform",
          zIndex: 1,
        }}
      >
      {/* ── 배경 별 (패럴랙스 레이어별 다른 속도) ───────────── */}
      {stars.map((star, i) => (
        <div
          key={star.id}
          ref={(el) => { starRefs.current[i] = el; }}
          className="star"
          style={{
            position: "absolute",
            left: `${star.x}%`,
            top:  `${star.y}%`,
            width:  `${star.size}px`,
            height: `${star.size}px`,
            "--opacity-min": star.opacity * 0.25,
            "--opacity-max": star.opacity,
            "--duration": `${star.duration}s`,
            "--delay":    `${star.delay}s`,
            zIndex: 1,
            willChange: "transform",
          } as React.CSSProperties}
        />
      ))}

      {/* ── 우주 레이어 (dragger, 카메라 오프셋에 따라 이동) ── */}
      <div
        ref={universeRef}
        style={{
          position: "absolute",
          inset: 0,
          willChange: "transform",
          zIndex: 2,
        }}
      >
        {/* 궤도 링 SVG */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            overflow: "visible",
          }}
          aria-hidden="true"
        >
          {RINGS.map((ring, i) => {
            const colors   = ["var(--ring-1)", "var(--ring-2)", "var(--ring-3)"];
            const opacity  = [0.3, 0.18, 0.1];
            const dashArr  = ["4 14", "3 18", "2 22"];
            return (
              <ellipse
                key={i}
                cx="50%"
                cy="50%"
                rx={ring.radius}
                ry={ring.radius * 0.5}
                fill="none"
                stroke={colors[i]}
                strokeWidth="1"
                strokeDasharray={dashArr[i]}
                opacity={opacity[i]}
              />
            );
          })}
        </svg>

        {/* 코어 노드 (항상 중앙, 안개 없음) */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%) translateZ(20px)",
            zIndex: 20,
          }}
        >
          <CosmosNode
            artist={data.core}
            size={90}
            isCore
            isFocused={false}
            onClick={onCoreTap}
          />
        </div>

        {/* 위성 노드 (rAF에서 위치·안개 실시간 갱신) */}
        {data.satellites.map((satellite, i) => (
          <div
            key={satellite.spotifyId}
            ref={(el) => { satelliteRefs.current[i] = el; }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              willChange: "transform, filter, opacity",
            }}
          >
            <CosmosNode
              artist={satellite}
              size={focusedIndex === i ? 58 : 46}
              isCore={false}
              isFocused={focusedIndex === i}
              onClick={() => {
                if (focusedIndex === i) {
                  if (warpTargetRef.current) return;
                  // 현재 시점의 궤도 상 위치(worldX, worldY) 역산하여 워프 다이브 타겟 설정
                  const elapsed = Date.now() - startTimeRef.current;
                  const { ringIdx, posInRing } = getRingForIndex(i);
                  const ring    = RINGS[ringIdx];
                  const scatter = scatterOffsets[i] ?? { radiusFactor: 1, angleOffset: 0 };
                  const actualRadius = ring.radius * scatter.radiusFactor;
                  const baseAngle    = (posInRing / ring.count) * 2 * Math.PI + scatter.angleOffset;
                  const angle        = baseAngle + elapsed * ring.speed;

                  const worldX = Math.cos(angle) * actualRadius;
                  const worldY = Math.sin(angle) * actualRadius * 0.5;

                  warpTargetRef.current = { x: -worldX, y: -worldY, id: satellite.spotifyId, done: false };
                } else {
                  onSatelliteTap(i);
                }
              }}
            />
          </div>
        ))}
      </div>

      {/* ── 심우주 노드 (universeRef 밖 — Torus 래핑으로 위치 동적 갱신) ─ */}
      {deepSpaceNodes.map((node, i) => {
        const initial = node.name.charAt(0);
        const hue = (node.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 47) % 360;
        return (
          <button
            key={`ds-${node.spotifyId}`}
            ref={(el) => { deepSpaceRefs.current[i] = el as unknown as HTMLDivElement; }}
            onClick={() => {
              if (warpTargetRef.current) return;
              warpTargetRef.current = { x: -node.x, y: -node.y, id: node.spotifyId, done: false };
            }}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              willChange: "transform, opacity",
              cursor: "pointer",
              opacity: 0,
              background: "none",
              border: "none",
              padding: 0,
              zIndex: 3,
            }}
          >
            <div style={{
              width: node.size,
              height: node.size,
              borderRadius: "50%",
              background: node.imageUrl ? `url(${node.imageUrl}) center/cover no-repeat` : `hsl(${hue},30%,18%)`,
              border: `1px solid ${node.accent}50`,
              boxShadow: `0 0 ${node.size / 2}px ${node.accent}20`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: node.size * 0.4,
              fontWeight: 600,
              color: node.accent,
            }}>
              {!node.imageUrl && initial}
            </div>
            <span
              data-deep-label="true"
              style={{
                fontSize: 9,
                color: `${node.accent}aa`,
                whiteSpace: "nowrap",
                maxWidth: node.size + 30,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {node.name}
            </span>
          </button>
        );
      })}

      </div>{/* zoomWrapperRef 닫기 */}

      {/* ── 화면 가장자리 안개 그라데이션 (vignette) ───────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, rgba(5,7,16,0.55) 75%, rgba(5,7,16,0.85) 100%)`,
          pointerEvents: "none",
          zIndex: 5,
        }}
      />

      {/* ── 조작 힌트 (첫 방문 3초간 표시) ─────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 14px",
          background: "rgba(10,14,26,0.7)",
          border: "1px solid rgba(167,139,250,0.15)",
          borderRadius: 20,
          backdropFilter: "blur(10px)",
          animation: "hintFadeOut 4s ease forwards",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 14 }}>✦</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          드래그로 탐험 · 별을 클릭해 음악 감상
        </span>
      </div>

      <style>{`
        @keyframes hintFadeOut {
          0%   { opacity: 1; }
          70%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
