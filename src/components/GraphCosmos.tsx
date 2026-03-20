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
  img.onload = () => imageCache.set(url, img);
  return null; // 첫 요청 시 null, 로드 완료 후 캐시에서 꺼냄
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────
export default function GraphCosmos({ graphData, onArtistSelect, focusedId }: Props) {
  const fgRef = useRef<Record<string, unknown>>(null);
  const [pathfindingFrom, setPathfindingFrom] = useState<string | null>(null);
  const [highlightPath, setHighlightPath] = useState<Set<string>>(new Set());
  const [highlightEdges, setHighlightEdges] = useState<Set<string>>(new Set());
  const [hoverNode, setHoverNode] = useState<string | null>(null);

  // d3 force-graph용 데이터 변환
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

  // 포커스된 아티스트로 카메라 Fly-To
  useEffect(() => {
    if (!focusedId || !fgRef.current) return;
    const node = graphData.nodes[focusedId];
    if (!node?.x || !node?.y) return;
    const fg = fgRef.current as { centerAt: (x: number, y: number, ms: number) => void; zoom: (z: number, ms: number) => void };
    fg.centerAt(node.x, node.y, 900);
    fg.zoom(2.8, 900);
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
      // 일반 클릭: 카메라 이동 + 아티스트 선택
      if (node.x !== undefined && node.y !== undefined) {
        fg.centerAt(node.x, node.y, 800);
        fg.zoom(2.8, 800);
      }
      setHighlightPath(new Set());
      setHighlightEdges(new Set());
      onArtistSelect(node.id);
      // URL을 조용히 변경 (페이지 리로드 없음)
      window.history.pushState(null, "", `/from/${node.id}`);
    }
  }, [pathfindingFrom, graphData, onArtistSelect]);

  // 노드 우클릭 → Pathfinding 시작점 설정
  const handleNodeRightClick = useCallback((node: V5Node, event: MouseEvent) => {
    event.preventDefault();
    setPathfindingFrom(node.id);
    setHighlightPath(new Set([node.id]));
    setHighlightEdges(new Set());
  }, []);

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
  }, [focusedId, highlightPath, hoverNode]);

  // 링크 색상
  const linkColor = useCallback((link: { relation: V5EdgeRelation; source: string | { id: string }; target: string | { id: string } }) => {
    const srcId = typeof link.source === "string" ? link.source : link.source.id;
    const tgtId = typeof link.target === "string" ? link.target : link.target.id;
    const edgeKey = [srcId, tgtId].sort().join("||");
    if (highlightEdges.has(edgeKey)) return "#fff";
    return EDGE_COLORS[link.relation] ?? "rgba(255,255,255,0.1)";
  }, [highlightEdges]);

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
        // 좌표는 prebake 시점에 계산됨 → 물리 시뮬 OFF
        cooldownTicks={0}
        warmupTicks={0}
        // 배경 투명 (CSS background에 의존)
        backgroundColor="rgba(0,0,0,0)"
        // 노드
        nodeId="id"
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => "replace"}
        nodePointerAreaPaint={(node: V5Node & { x?: number; y?: number }, color: string, ctx: CanvasRenderingContext2D) => {
          const radius = node.tier === 0 ? 36 : node.tier === 1 ? 20 : 10;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        // 링크
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalParticles={(link: { relation: V5EdgeRelation }) =>
          link.relation === "GENRE_OVERLAP" ? 0 : 1
        }
        linkDirectionalParticleWidth={(link: { relation: V5EdgeRelation }) =>
          link.relation === "INDIRECT" ? 1 : 2
        }
        linkDirectionalParticleColor={linkColor}
        linkDirectionalParticleSpeed={0.003}
        // 이벤트
        onNodeClick={handleNodeClick}
        onNodeRightClick={handleNodeRightClick}
        onNodeHover={(node: V5Node | null) => setHoverNode(node?.id ?? null)}
        // 스타일
        width={typeof window !== "undefined" ? window.innerWidth : 375}
        height={typeof window !== "undefined" ? window.innerHeight : 812}
      />
    </div>
  );
}
