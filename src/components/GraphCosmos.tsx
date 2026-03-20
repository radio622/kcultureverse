"use client";

/**
 * 🌌 GraphCosmos — Universe V5 Canvas 렌더러
 *
 * 기존 DOM 기반 Cosmos.tsx를 완전 대체.
 * react-force-graph-2d 기반 Canvas 렌더링:
 *   - 블랙아웃 없음: 노드 클릭 → 카메라 Fly-To (centerAt)
 *   - LOD: 줌 레벨에 따라 노드 표현 3 단계 전환
 *   - 엣지 관계 유형별 색상 시각화
 *   - Pathfinding: 두 노드 선택 시 최단 경로 빛나는 선
 *
 * Next.js SSR 호환: dynamic import + ssr:false 로 사용할 것
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import type { V5Node, V5Edge, UniverseGraphV5, V5EdgeRelation } from "@/lib/graph-v5";

// ── 타입 ────────────────────────────────────────────────────────────
interface Props {
  graphData: UniverseGraphV5;
  /** 노드 클릭 시 호출 (바텀시트 데이터 교체) */
  onArtistSelect: (nodeId: string) => void;
  /** 현재 포커스된 아티스트 ID */
  focusedId: string | null;
}

// react-force-graph-2d는 SSR 불가 → dynamic import로만 사용
// 이 파일은 항상 client-side에서만 실행됨
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ForceGraph2D = require("react-force-graph-2d").default;

// ── 엣지 유형별 색상 ─────────────────────────────────────────────
const EDGE_COLORS: Record<V5EdgeRelation, string> = {
  SAME_GROUP:    "#86efac",   // 민트 — 그룹 멤버
  FEATURED:      "#c084fc",   // 보라 — 피처링/콜라보
  PRODUCER:      "#60a5fa",   // 파랑 — 프로듀서
  WRITER:        "#fbbf24",   // 노랑 — 작곡/작사
  INDIRECT:      "rgba(255,255,255,0.12)",  // 흰색 반투명 — 간접 연결
  GENRE_OVERLAP: "rgba(167,139,250,0.06)", // 극히 흐린 보라 — 장르 유사 (배경 질감)
};

const EDGE_WIDTH: Record<V5EdgeRelation, number> = {
  SAME_GROUP:    2.5,
  FEATURED:      2.0,
  PRODUCER:      1.5,
  WRITER:        1.5,
  INDIRECT:      0.5,
  GENRE_OVERLAP: 0.3,
};

// ── Dijkstra 최단 경로 탐색 ─────────────────────────────────────
function dijkstra(
  nodes: Record<string, V5Node>,
  edges: V5Edge[],
  fromId: string,
  toId: string
): string[] {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const id of Object.keys(nodes)) {
    dist[id] = Infinity;
    prev[id] = null;
  }
  dist[fromId] = 0;

  // 인접 목록 구성
  const adj: Record<string, { id: string; weight: number }[]> = {};
  for (const e of edges) {
    const cost = 1 - e.weight; // weight 높을수록 거리 짧음
    adj[e.source] = adj[e.source] || [];
    adj[e.target] = adj[e.target] || [];
    adj[e.source].push({ id: e.target, weight: cost });
    adj[e.target].push({ id: e.source, weight: cost });
  }

  const queue = new Set(Object.keys(nodes));

  while (queue.size > 0) {
    // 현재 최소 dist 노드 선택
    let u: string | null = null;
    for (const id of queue) {
      if (u === null || dist[id] < dist[u]) u = id;
    }
    if (!u || dist[u] === Infinity) break;
    if (u === toId) break;
    queue.delete(u);
    visited.add(u);

    for (const neighbor of adj[u] || []) {
      if (visited.has(neighbor.id)) continue;
      const alt = dist[u] + neighbor.weight;
      if (alt < dist[neighbor.id]) {
        dist[neighbor.id] = alt;
        prev[neighbor.id] = u;
      }
    }
  }

  // 경로 역추적
  const path: string[] = [];
  let cur: string | null = toId;
  while (cur) {
    path.unshift(cur);
    cur = prev[cur] ?? null;
    if (path.includes(cur!)) break; // 사이클 방어
  }

  return path[0] === fromId ? path : []; // 경로 없으면 빈 배열
}

// ── 이미지 캐시 (Canvas drawImage 최적화) ──────────────────────
const imageCache = new Map<string, HTMLImageElement>();

function getCachedImage(url: string): HTMLImageElement | null {
  if (imageCache.has(url)) return imageCache.get(url)!;
  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  // 로딩 전이라도 중복 요청을 막기 위해 맵에 즉시 등록
  imageCache.set(url, img);
  return img; // 호출 단에서 img.complete 로 렌더 여부 결정
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────
export default function GraphCosmos({ graphData, onArtistSelect, focusedId }: Props) {
  const fgRef = useRef<Record<string, unknown>>(null);
  const [pathfindingFrom, setPathfindingFrom] = useState<string | null>(null);
  const [highlightPath, setHighlightPath] = useState<Set<string>>(new Set());
  const [highlightEdges, setHighlightEdges] = useState<Set<string>>(new Set());
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<[number, number]>([
    typeof window !== "undefined" ? window.innerWidth : 375,
    typeof window !== "undefined" ? window.innerHeight : 812
  ]);

  // 창 크기 변경에 따른 뷰포트 업데이트
  useEffect(() => {
    const handleResize = () => setDimensions([window.innerWidth, window.innerHeight]);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // d3 force-graph용 데이터 변환
  // 호츠는 d3가 자유롭게 배치하도록 놓아두고 시뮬 완료 후 fitView
  const forceData = useMemo(() => ({
    nodes: Object.values(graphData.nodes).map((n) => ({ ...n })),
    links: graphData.edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
      relation: e.relation,
      label: e.label,
    })),
  }), [graphData]);

  // 런타임 시뮬레이션 후 최종 좌표를 저장하여 Fly-To 시 참조 (좌표 불일치 버그 해결)
  const simulatedNodesRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // 시뮬 완료 시: fitView 및 최종 좌표 저장
  const handleEngineStop = useCallback(() => {
    const fg = fgRef.current as { zoomToFit?: (ms: number, padding: number) => void } | null;
    fg?.zoomToFit?.(600, 80);

    // 시뮬레이션 결과(forceData)의 최종 좌표를 Map에 저장
    forceData.nodes.forEach(n => {
      if (typeof n.x === 'number' && typeof n.y === 'number') {
        simulatedNodesRef.current.set(n.id, { x: n.x, y: n.y });
      }
    });
  }, [forceData.nodes]);

  // 포커스된 아티스트로 카메라 Fly-To
  useEffect(() => {
    if (!focusedId || !fgRef.current) return;
    // 그래프에 없는 아티스트(위성 only)이면 카메라 이동 안 함
    if (!graphData.nodes[focusedId]) return;
    
    // JSON의 원본 좌표가 아닌, 시뮬레이션 완료 후의 런타임 좌표를 사용!
    const simNode = simulatedNodesRef.current.get(focusedId);
    if (!simNode) {
      // 아직 시뮬레이션 전이거나 맵에 없으면 원본 좌표 fallback
      const node = graphData.nodes[focusedId];
      if (node?.x === undefined || node?.y === undefined) return;
      const fg = fgRef.current as { centerAt: (x: number, y: number, ms: number) => void; zoom: (z: number, ms: number) => void };
      fg.centerAt(node.x, node.y, 1200);
      fg.zoom(1.5, 1200);
      return;
    }

    const fg = fgRef.current as { centerAt: (x: number, y: number, ms: number) => void; zoom: (z: number, ms: number) => void };
    fg.centerAt(simNode.x, simNode.y, 1200); // 부드러운 이동 (1200ms)
    fg.zoom(1.5, 1200);
  }, [focusedId, graphData.nodes]);

  // 노드 클릭 핸들러 (카메라 Fly-To + 바텀시트 교체 + Pathfinding)
  const handleNodeClick = useCallback((node: V5Node) => {
    const fg = fgRef.current as { centerAt: (x: number, y: number, ms: number) => void; zoom: (z: number, ms: number) => void } | null;
    if (!fg) return;

    // Pathfinding 모드: 두 번째 클릭 시 경로 탐색
    if (pathfindingFrom && pathfindingFrom !== node.id) {
      const path = dijkstra(graphData.nodes, graphData.edges, pathfindingFrom, node.id);
      setHighlightPath(new Set(path));

      // 경로 엣지 하이라이트
      const edgeKeys = new Set<string>();
      for (let i = 0; i < path.length - 1; i++) {
        edgeKeys.add([path[i], path[i + 1]].sort().join("||"));
      }
      setHighlightEdges(edgeKeys);
      setPathfindingFrom(null); // 모드 해제

      // 경로 첫 번째 노드로 Fly-To
      const first = graphData.nodes[path[0]];
      if (first?.x && first?.y) {
        fg.centerAt(first.x, first.y, 600);
        fg.zoom(1.5, 600);
      }
    } else {
      // 일반 클릭: 아티스트 선택만 처리 (카메라 이동은 focusedId useEffect가 담당)
      setHighlightPath(new Set());
      setHighlightEdges(new Set());
      onArtistSelect(node.id); // page.tsx의 handleArtistSelect가 state push를 전담
    }
  }, [pathfindingFrom, graphData, onArtistSelect]);

  // 노드 우클릭 → Pathfinding 시작점 설정
  const handleNodeRightClick = useCallback((node: V5Node, event: MouseEvent) => {
    event.preventDefault();
    setPathfindingFrom(node.id);
    setHighlightPath(new Set([node.id]));
    setHighlightEdges(new Set());
  }, []);

  // ── Focus Mode: 선택된 노드 + 1-hop 이웃 ─────────────────────
  // ⚠️ focusedId가 그래프에 없는 아티스트(위성 only)이면 Focus Mode를 끄지 않으면
  //    모든 노드가 opacity 0.15로 사라져서 "화면이 꺼지는" 블랙아웃처럼 보인다!
  const focusSet = useMemo(() => {
    if (!focusedId) return null;
    // 그래프에 존재하는 노드인지 확인
    if (!graphData.nodes[focusedId]) return null; // ← 핵심: 없으면 Focus Mode OFF
    const set = new Set<string>();
    set.add(focusedId);
    for (const e of graphData.edges) {
      if (e.source === focusedId) set.add(e.target);
      else if (e.target === focusedId) set.add(e.source);
    }
    return set;
  }, [focusedId, graphData.edges, graphData.nodes]);

  // ── LOD 기반 노드 커스텀 렌더링 ─────────────────────────────
  const paintNode = useCallback((
    node: V5Node & { x?: number; y?: number },
    ctx: CanvasRenderingContext2D,
    globalScale: number
  ) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const isHub = node.tier === 0;
    const isFocused = node.id === focusedId || highlightPath.has(node.id);
    const isHovered = node.id === hoverNode;

    // Focus Mode Dimming
    const isDimmed = focusSet && !focusSet.has(node.id);
    ctx.globalAlpha = isDimmed ? 0.15 : 1;

    // LOD 레벨 결정
    const lod = globalScale < 0.6 ? "far" : globalScale < 1.8 ? "mid" : "close";

    // ── 줌 아웃 (far): 점만 ─────────────────────────────────
    if (lod === "far") {
      const radius = isHub ? 7 : node.tier === 1 ? 3 : 1.5;

      // 허브: 글로우 효과
      if (isHub) {
        ctx.beginPath();
        ctx.arc(x, y, radius * 2.5, 0, 2 * Math.PI);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.5);
        glow.addColorStop(0, (node.accent || "#c084fc") + "50");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(x, y, isFocused ? radius * 1.6 : radius, 0, 2 * Math.PI);
      ctx.fillStyle = isHub
        ? (isFocused ? "#fff" : node.accent || "#c084fc")
        : node.tier === 1
          ? "rgba(255,255,255,0.55)"
          : "rgba(255,255,255,0.2)";
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    // ── 중간 (mid): 원 + 이름 ──────────────────────────────
    if (lod === "mid") {
      const radius = isHub ? 22 : node.tier === 1 ? 10 : 5;

      // 글로우
      if (isHub || isFocused) {
        ctx.beginPath();
        ctx.arc(x, y, radius * 1.8, 0, 2 * Math.PI);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.8);
        glow.addColorStop(0, (node.accent || "#c084fc") + "40");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fill();
      }

      // 원
      ctx.beginPath();
      ctx.arc(x, y, isHovered ? radius * 1.15 : radius, 0, 2 * Math.PI);
      ctx.fillStyle = isHub
        ? "rgba(167,139,250,0.25)"
        : "rgba(255,255,255,0.1)";
      ctx.strokeStyle = isHub
        ? (node.accent || "#c084fc")
        : isFocused ? "#c084fc" : "rgba(255,255,255,0.3)";
      ctx.lineWidth = isFocused ? 2 : 1;
      ctx.fill();
      ctx.stroke();

      // 이름 텍스트
      if (isHub || node.tier === 1) {
        ctx.font = `${isHub ? 600 : 400} ${isHub ? 12 : 9}px Inter, sans-serif`;
        ctx.fillStyle = isHub ? "#fff" : "rgba(255,255,255,0.7)";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(node.nameKo || node.name, x, y + radius + 4);
      }
      ctx.globalAlpha = 1;
      return;
    }

    // ── 클로즈업 (close): 이미지 or 이니셜 + 전체 정보 ──────
    const radius = isHub ? 36 : node.tier === 1 ? 24 : 14;

    // 이미지 그리기
    if (node.image) {
      const img = getCachedImage(node.image);
      if (img?.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
        ctx.restore();
      } else {
        // 이미지 로딩 중: 기본 원
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(167,139,250,0.2)";
        ctx.fill();
      }
    } else {
      // 이미지 없음: 이니셜
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(167,139,250,0.15)";
      ctx.fill();
      ctx.font = `600 ${radius * 0.7}px Inter, sans-serif`;
      ctx.fillStyle = node.accent || "rgba(200,180,255,0.8)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((node.nameKo || node.name).charAt(0), x, y);
    }

    // 테두리
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = isFocused ? "#ffffff" : isHub ? (node.accent || "#c084fc") : "rgba(255,255,255,0.25)";
    ctx.lineWidth = isFocused ? 3 : isHub ? 2 : 1;
    ctx.stroke();

    // 이름
    ctx.font = `600 ${isHub ? 13 : 10}px Inter, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    // 텍스트 배경
    const label = node.nameKo || node.name;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(5,5,15,0.65)";
    ctx.fillRect(x - tw / 2 - 4, y + radius + 3, tw + 8, 16);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x, y + radius + 5);
    
    // 복구
    ctx.globalAlpha = 1;
  }, [focusedId, highlightPath, hoverNode, focusSet]);

  // 링크 색상
  const linkColor = useCallback((link: { relation: V5EdgeRelation; source: string | { id: string }; target: string | { id: string } }) => {
    const srcId = typeof link.source === "string" ? link.source : link.source.id;
    const tgtId = typeof link.target === "string" ? link.target : link.target.id;
    const edgeKey = [srcId, tgtId].sort().join("||");
    if (highlightEdges.has(edgeKey)) return "#fff";
    
    // Focus Mode Dimming
    const isDimmed = focusSet && (!focusSet.has(srcId) || !focusSet.has(tgtId));
    if (isDimmed) return "rgba(167,139,250,0.05)";
    
    return EDGE_COLORS[link.relation] ?? "rgba(255,255,255,0.1)";
  }, [highlightEdges, focusSet]);

  // 링크 폭
  const linkWidth = useCallback((link: { relation: V5EdgeRelation; source: string | { id: string }; target: string | { id: string } }) => {
    const srcId = typeof link.source === "string" ? link.source : link.source.id;
    const tgtId = typeof link.target === "string" ? link.target : link.target.id;
    const edgeKey = [srcId, tgtId].sort().join("||");
    if (highlightEdges.has(edgeKey)) return 3;
    return EDGE_WIDTH[link.relation] ?? 0.5;
  }, [highlightEdges]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--bg-cosmos)" }}>
      {/* Pathfinding 안내 토스트 */}
      {pathfindingFrom && (
        <div style={{
          position: "absolute",
          top: 60,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          background: "rgba(5,5,15,0.85)",
          border: "1px solid rgba(167,139,250,0.4)",
          borderRadius: 20,
          padding: "8px 18px",
          color: "rgba(200,180,255,0.9)",
          fontSize: 12,
          backdropFilter: "blur(12px)",
          pointerEvents: "none",
        }}>
          ✦ 연결할 두 번째 아티스트를 클릭하세요 (우클릭으로 취소)
        </div>
      )}

      <ForceGraph2D
        ref={fgRef}
        graphData={forceData}
        // 시뮬레이션 런타임에 켜기: 클릭(히트테스트) 정상 동작 및 Fly-To 좌표 갱신 (선택지 B)
        cooldownTicks={200}
        onEngineStop={handleEngineStop}
        // 배경
        backgroundColor="rgba(0,0,0,0)"
        // 노드: 커스텀 LOD 렌더링 및 히트테스트
        nodeId="id"
        nodeCanvasObjectMode={() => "replace"}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(node: V5Node & { x?: number; y?: number }, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
          // Shadow Canvas용 투명 히트맵. LOD 단계별 radius와 완벽히 동기화
          ctx.beginPath();
          const lod = globalScale < 0.6 ? "far" : globalScale < 1.8 ? "mid" : "close";
          const isHub = node.tier === 0;
          let radius = 1;
          if (lod === "far") {
            radius = isHub ? 7 : node.tier === 1 ? 3 : 1.5;
          } else if (lod === "mid") {
            radius = isHub ? 22 : node.tier === 1 ? 10 : 5;
          } else {
            radius = isHub ? 36 : node.tier === 1 ? 24 : 14;
          }
          // 클릭 편의성을 위해 약간의 패딩(1.2) 부여
          ctx.arc(node.x ?? 0, node.y ?? 0, radius * 1.2, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        // 기본 렌더링 로직 제거
        nodeVal={(node: V5Node) => node.tier === 0 ? 12 : node.tier === 1 ? 4 : 1}
        // 링크: 단순화 (파티클/방향 화살표 제거 → shadow canvas 부하 최소화)
        linkColor={() => "rgba(167,139,250,0.15)"}
        linkWidth={0.5}
        // 이벤트
        onNodeClick={(node: V5Node) => {
          console.log("🟢 NODE CLICKED:", node.id, node.nameKo || node.name);
          handleNodeClick(node);
        }}
        onNodeHover={(node: V5Node | null) => {
          setHoverNode(node?.id ?? null);
          if (typeof document !== "undefined") {
            document.body.style.cursor = node ? "pointer" : "default";
          }
        }}
        // 스타일
        width={dimensions[0]}
        height={dimensions[1]}
      />
    </div>
  );
}
