"use client";

/**
 * 🌌 GraphCosmos — Universe V5.5 Canvas 렌더러
 *
 * V5.5 핵심 원칙: 모든 아티스트는 평등한 별이다.
 * 별의 크기와 밝기는 오직 degree(연결된 간선 수)에 비례하는
 * 연속적(continuous) 스케일로만 자연 결정된다.
 * tier(계급) 시스템 완전 폐지.
 *
 * LOD 3단계: far (< 0.4), mid (0.4-1.5), close (≥ 1.5)
 * BFS 포커스: 클릭 시 1/2촌 하이라이트, Star Bloom 애니메이션
 * Zero Physics: 사전 계산 좌표만 사용 (브라우저 물리 OFF)
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import type { V5Node, V5Edge, UniverseGraphV5, V5EdgeRelation } from "@/lib/graph-v5";

// ── Props ────────────────────────────────────────────────────────
interface Props {
  graphData: UniverseGraphV5;
  onArtistSelect: (nodeId: string) => void;
  focusedId: string | null;
  onBackgroundClick?: () => void;
  sheetState?: string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ForceGraph2D = require("react-force-graph-2d").default;

// ── 상수 ────────────────────────────────────────────────────────
const BLOOM_DURATION_MS = 600;  // Star Bloom 애니메이션 총 시간
const IMG_CACHE_MAX = 50;       // LRU 이미지 캐시 최대 장수
const MAX_HOP1_EDGES = 15;      // Hairball 방지: hop1 엣지 최대 수

const EDGE_COLORS: Record<V5EdgeRelation, string> = {
  SAME_GROUP:    "#86efac",                   // 민트 — 그룹 멤버
  FEATURED:      "#c084fc",                   // 보라 — 피처링
  PRODUCER:      "#60a5fa",                   // 파랑 — 프로듀서
  WRITER:        "#fbbf24",                   // 노랑 — 작곡/작사
  INDIRECT:      "rgba(255,255,255,0.15)",
  GENRE_OVERLAP: "rgba(167,139,250,0.06)",
};

const EDGE_WIDTH: Record<V5EdgeRelation, number> = {
  SAME_GROUP:    2.5,
  FEATURED:      2.0,
  PRODUCER:      1.5,
  WRITER:        1.5,
  INDIRECT:      0.5,
  GENRE_OVERLAP: 0.2,
};

// ── LRU 이미지 캐시 ────────────────────────────────────────────
const imageCache = new Map<string, HTMLImageElement>();
const imageLRU: string[] = []; // 최근 사용 순서 추적

function getCachedImage(url: string): HTMLImageElement | null {
  if (imageCache.has(url)) {
    // LRU 갱신
    const idx = imageLRU.indexOf(url);
    if (idx !== -1) imageLRU.splice(idx, 1);
    imageLRU.push(url);
    return imageCache.get(url)!;
  }
  // 캐시 미스: LRU 초과 시 오래된 것 제거
  if (imageLRU.length >= IMG_CACHE_MAX) {
    const oldest = imageLRU.shift()!;
    imageCache.delete(oldest);
  }
  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  imageCache.set(url, img);
  imageLRU.push(url);
  return img;
}

// ── Dijkstra 경로탐색 ────────────────────────────────────────────
function dijkstra(
  nodes: Record<string, V5Node>,
  edges: V5Edge[],
  fromId: string,
  toId: string
): string[] {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const id of Object.keys(nodes)) { dist[id] = Infinity; prev[id] = null; }
  dist[fromId] = 0;

  const adj: Record<string, { id: string; weight: number }[]> = {};
  for (const e of edges) {
    const cost = 1 - e.weight;
    adj[e.source] = adj[e.source] || [];
    adj[e.target] = adj[e.target] || [];
    adj[e.source].push({ id: e.target, weight: cost });
    adj[e.target].push({ id: e.source, weight: cost });
  }

  const queue = new Set(Object.keys(nodes));
  while (queue.size > 0) {
    let u: string | null = null;
    for (const id of queue) { if (u === null || dist[id] < dist[u]) u = id; }
    if (!u || dist[u] === Infinity) break;
    if (u === toId) break;
    queue.delete(u); visited.add(u);
    for (const nb of adj[u] || []) {
      if (visited.has(nb.id)) continue;
      const alt = dist[u] + nb.weight;
      if (alt < dist[nb.id]) { dist[nb.id] = alt; prev[nb.id] = u; }
    }
  }

  const path: string[] = [];
  let cur: string | null = toId;
  while (cur) {
    path.unshift(cur);
    cur = prev[cur] ?? null;
    if (path.includes(cur!)) break;
  }
  return path[0] === fromId ? path : [];
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function GraphCosmos({ graphData, onArtistSelect, focusedId, onBackgroundClick, sheetState }: Props) {
  const fgRef = useRef<Record<string, unknown>>(null);

  // 뷰포트 크기
  const [dimensions, setDimensions] = useState<[number, number]>([
    typeof window !== "undefined" ? window.innerWidth : 375,
    typeof window !== "undefined" ? window.innerHeight : 812,
  ]);
  useEffect(() => {
    const onResize = () => setDimensions([window.innerWidth, window.innerHeight]);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Pathfinding
  const [pathfindingFrom, setPathfindingFrom] = useState<string | null>(null);
  const [highlightPath, setHighlightPath] = useState<Set<string>>(new Set());
  const [highlightEdges, setHighlightEdges] = useState<Set<string>>(new Set());

  // Hover
  const [hoverNode, setHoverNode] = useState<string | null>(null);

  // 줌 레벨 추적 (Phase 2B: 줌 반응형 엣지)
  const [currentScale, setCurrentScale] = useState(1);

  // Star Bloom 애니메이션 타임스탬프
  const [focusChangedAt, setFocusChangedAt] = useState<number>(0);
  const [prevFocusedId, setPrevFocusedId] = useState<string | null>(null);

  // focusedId 변경 시 Bloom 트리거
  useEffect(() => {
    if (focusedId !== prevFocusedId) {
      setFocusChangedAt(Date.now());
      setPrevFocusedId(focusedId);
    }
  }, [focusedId, prevFocusedId]);

  // ── 인접 리스트 (BFS용, 1회만 빌드) ─────────────────────────
  const adjList = useMemo(() => {
    const map = new Map<string, { id: string; weight: number; relation: V5EdgeRelation }[]>();
    for (const e of graphData.edges) {
      if (!map.has(e.source)) map.set(e.source, []);
      if (!map.has(e.target)) map.set(e.target, []);
      map.get(e.source)!.push({ id: e.target, weight: e.weight, relation: e.relation });
      map.get(e.target)!.push({ id: e.source, weight: e.weight, relation: e.relation });
    }
    return map;
  }, [graphData.edges]);

  // ── BFS 포커스 계산 (Task 3-3) ─────────────────────────────
  const { hop1, hop2, focusEdgeKeys } = useMemo(() => {
    if (!focusedId || !graphData.nodes[focusedId]) {
      return { hop1: new Set<string>(), hop2: new Set<string>(), focusEdgeKeys: new Set<string>() };
    }

    const hop1 = new Set<string>();
    const hop2 = new Set<string>();
    const focusEdgeKeys = new Set<string>();

    // 1촌: 직접 이웃 (weight 상위 MAX_HOP1_EDGES개 — Hairball 방지)
    const neighbors = (adjList.get(focusedId) ?? [])
      .filter(nb => nb.id !== focusedId)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_HOP1_EDGES);

    for (const nb of neighbors) {
      hop1.add(nb.id);
      focusEdgeKeys.add([focusedId, nb.id].sort().join("||"));
    }

    // 2촌: 1촌의 이웃 (focusedId, 1촌 제외)
    for (const h1 of hop1) {
      for (const nb of adjList.get(h1) ?? []) {
        if (nb.id !== focusedId && !hop1.has(nb.id)) {
          hop2.add(nb.id);
        }
      }
    }

    return { hop1, hop2, focusEdgeKeys };
  }, [focusedId, adjList, graphData.nodes]);

  // ── Fly-To: focusedId 및 sheetState 변경 시 동적 카메라 이동 ─────────────────
  useEffect(() => {
    if (!focusedId || !fgRef.current || !graphData.nodes[focusedId]) return;
    const node = graphData.nodes[focusedId];
    if (node.x === undefined || node.y === undefined) return;
    const fg = fgRef.current as {
      centerAt: (x: number, y: number, ms: number) => void;
      zoom: (z: number, ms: number) => void;
    };
    
    // 모바일/PC 여부 확인
    const isMobile = window.innerWidth <= 768;
    
    // 바텀 시트가 펼쳐진(expanded) 상태일 경우 시야 확보를 위해 줌아웃 & 상향 이동
    if (sheetState === "expanded") {
      const targetZoom = isMobile ? 0.9 : 1.3;
      const offsetY = isMobile ? 180 : 80;
      fg.centerAt(node.x, node.y - offsetY / targetZoom, 800);
      fg.zoom(targetZoom, 800);
    } else {
      // 일반 상태 (접혀있거나 peek)
      fg.centerAt(node.x, node.y, 800);
      fg.zoom(isMobile ? 1.3 : 1.8, 800);
    }
  }, [focusedId, sheetState, graphData.nodes]);

  // ── 노드 클릭 핸들러 ─────────────────────────────────────
  const handleNodeClick = useCallback((node: V5Node) => {
    const fg = fgRef.current as {
      centerAt: (x: number, y: number, ms: number) => void;
      zoom: (z: number, ms: number) => void;
    } | null;
    if (!fg) return;

    // Pathfinding 모드: 두 번째 클릭
    if (pathfindingFrom && pathfindingFrom !== node.id) {
      const path = dijkstra(graphData.nodes, graphData.edges, pathfindingFrom, node.id);
      setHighlightPath(new Set(path));
      const edgeKeys = new Set<string>();
      for (let i = 0; i < path.length - 1; i++) {
        edgeKeys.add([path[i], path[i + 1]].sort().join("||"));
      }
      setHighlightEdges(edgeKeys);
      setPathfindingFrom(null);
      const first = graphData.nodes[path[0]];
      if (first?.x && first?.y) { fg.centerAt(first.x, first.y, 600); fg.zoom(1.5, 600); }
      return;
    }

    // 일반 클릭
    setHighlightPath(new Set());
    setHighlightEdges(new Set());
    onArtistSelect(node.id);
  }, [pathfindingFrom, graphData, onArtistSelect]);

  // ── LOD 기반 노드 커스텀 렌더링 (Task 3-2) ───────────────
  const paintNode = useCallback((
    node: V5Node & { x?: number; y?: number },
    ctx: CanvasRenderingContext2D,
    globalScale: number
  ) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const deg = node.degree ?? 0;
    const isFocused = node.id === focusedId;
    const isHop1 = hop1.has(node.id);
    const isHop2 = hop2.has(node.id);
    const isOnPath = highlightPath.has(node.id);
    const isHovered = node.id === hoverNode;
    // degree 기반 연속 스케일 — "거대별"인지를 판단하는 것이 아니라 자연스러운 크기 비례
    const isMajor = deg >= 4; // 연결이 일정 수준 이상인 별 (이름 표시 등에만 사용)

    // Star Bloom 보간: 0~BLOOM_DURATION_MS
    const bloomProgress = focusChangedAt > 0
      ? Math.min(1, (Date.now() - focusChangedAt) / BLOOM_DURATION_MS)
      : 1;

    // Focus Mode 딤
    const hasFocus = focusedId && graphData.nodes[focusedId];
    const isVisible = !hasFocus || isFocused || isHop1 || isHop2 || isOnPath;
    ctx.globalAlpha = isVisible ? 1 : 0.07;

    // LOD 레벨 결정
    const lod = globalScale < 0.4 ? "far" : globalScale < 1.5 ? "mid" : "close";

    // ── FAR: 빛나는 점 (degree 비례 크기) ────────────────────
    if (lod === "far") {
      const r = 1.0 + Math.sqrt(deg) * 0.5; // degree=0→1, degree=25→3.5, degree=100→6

      // 큰 별 or 포커스: 글로우
      if (isMajor || isFocused) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        glow.addColorStop(0, (node.accent || "#c084fc") + "60");
        glow.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, 2 * Math.PI);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(x, y, isFocused ? r * 1.8 : r, 0, 2 * Math.PI);
      ctx.fillStyle = isFocused ? "#fff"
        : isMajor ? (node.accent || "#c084fc")
        : isHop1 ? "rgba(255,255,255,0.8)"
        : "rgba(255,255,255,0.25)";
      ctx.fill();

      // 연결이 많은 별: 이름 표시 (far에서도)
      if (isMajor && globalScale > 0.25) {
        ctx.font = `500 ${Math.max(8, 10 / globalScale)}px Inter, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(node.nameKo || node.name, x, y + r + 2 / globalScale);
      }

      ctx.globalAlpha = 1;
      return;
    }

    // ── MID: 원 + 이름 (degree 비례) ──────────────────────────
    if (lod === "mid") {
      const r = 3 + Math.sqrt(deg) * 2; // degree=0→3, degree=25→13, degree=100→23
      const displayR = isHovered ? r * 1.12 : r;

      // 글로우
      if (isMajor || isFocused || isHop1) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, displayR * 2);
        glow.addColorStop(0, (node.accent || "#c084fc") + "35");
        glow.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(x, y, displayR * 2, 0, 2 * Math.PI);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(x, y, displayR, 0, 2 * Math.PI);
      ctx.fillStyle = isMajor ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.08)";
      ctx.strokeStyle = isFocused ? "#ffffff"
        : isHop1 ? (node.accent || "#c084fc")
        : "rgba(255,255,255,0.25)";
      ctx.lineWidth = isFocused ? 2.5 : isHop1 ? 1.5 : 0.8;
      ctx.fill(); ctx.stroke();

      // 이름 (큰 별 or 포커스/1촌)
      if (isMajor || isHop1 || isFocused) {
        const fontSize = deg >= 25 ? 11 : 9;
        ctx.font = `${deg >= 25 ? 600 : 400} ${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = deg >= 25 ? "#fff" : "rgba(255,255,255,0.7)";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(node.nameKo || node.name, x, y + displayR + 3);
      }

      ctx.globalAlpha = 1;
      return;
    }

    // ── CLOSE: 사진 + 전체 정보 (degree 비례) ──────────────────
    const baseR = 10 + Math.sqrt(deg) * 4; // degree=0→10, degree=25→30, degree=100→50
    const r = isFocused ? Math.max(40, baseR) : isHop1 ? Math.max(26, baseR * 0.8) : isHop2 ? 14 : baseR;

    // Star Bloom: focused/hop1는 bloomProgress로 크기 보간
    const animR = (isFocused || isHop1)
      ? r * (0.6 + 0.4 * bloomProgress)
      : r;

    // 글로우 (focused/hop1)
    if (isFocused || isHop1 || isOnPath) {
      const glowColor = isFocused ? "#ffffff" : (node.accent || "#c084fc");
      const glow = ctx.createRadialGradient(x, y, 0, x, y, animR * 2);
      glow.addColorStop(0, glowColor + "40");
      glow.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(x, y, animR * 2, 0, 2 * Math.PI);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // 이미지 또는 이니셜
    if (node.image && (isFocused || isHop1 || isMajor)) {
      const img = getCachedImage(node.image);
      const imgAlpha = (isFocused || isHop1) ? bloomProgress : 1;
      ctx.globalAlpha = isVisible ? imgAlpha : 0.07;

      if (img?.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, animR, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(img, x - animR, y - animR, animR * 2, animR * 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, animR, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(167,139,250,0.2)";
        ctx.fill();
      }
      ctx.globalAlpha = isVisible ? 1 : 0.07;
    } else {
      // 이니셜 원
      ctx.beginPath();
      ctx.arc(x, y, animR, 0, 2 * Math.PI);
      ctx.fillStyle = isMajor ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.06)";
      ctx.fill();

      // 이니셜 텍스트
      if (animR >= 8) {
        ctx.font = `600 ${Math.round(animR * 0.65)}px Inter, sans-serif`;
        ctx.fillStyle = node.accent || "rgba(200,180,255,0.8)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((node.nameKo || node.name).charAt(0), x, y);
      }
    }

    // 테두리
    ctx.beginPath();
    ctx.arc(x, y, animR, 0, 2 * Math.PI);
    ctx.strokeStyle = isFocused ? "#ffffff"
      : isOnPath ? "#fbbf24"
      : isHop1 ? (node.accent || "#c084fc")
      : isMajor ? (node.accent || "#c084fc")
      : "rgba(255,255,255,0.2)";
    ctx.lineWidth = isFocused ? 3 : isHop1 ? 2 : 1;
    ctx.stroke();

    // 이름 라벨
    if (isFocused || isHop1 || isMajor) {
      const label = node.nameKo || node.name;
      ctx.font = `${isFocused ? 700 : 600} ${isFocused ? 13 : 10}px Inter, sans-serif`;
      const tw = ctx.measureText(label).width;
      // 텍스트 배경
      ctx.fillStyle = "rgba(5,5,15,0.7)";
      ctx.beginPath();
      ctx.roundRect?.(x - tw / 2 - 5, y + animR + 3, tw + 10, 16, 3);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(label, x, y + animR + 5);
    }

    ctx.globalAlpha = 1;
  }, [focusedId, hop1, hop2, highlightPath, hoverNode, focusChangedAt, graphData.nodes]);

  // ── 링크 색상 (V5.4: 평상시는 유령선, 포커스 시에만 발광) ────────
  const linkColor = useCallback((link: {
    relation: V5EdgeRelation;
    source: string | { id: string };
    target: string | { id: string };
  }) => {
    const srcId = typeof link.source === "string" ? link.source : link.source.id;
    const tgtId = typeof link.target === "string" ? link.target : link.target.id;
    const key = [srcId, tgtId].sort().join("||");

    if (highlightEdges.has(key)) return "#fbbf24"; // 경로 탐색 하이라이트

    // Focus Mode: hop1 엣지만 색상 표시, 나머지는 거의 안 보이게
    if (focusedId && graphData.nodes[focusedId]) {
      if (!focusEdgeKeys.has(key)) {
        return `rgba(167,139,250,${Math.max(0.01, currentScale * 0.015).toFixed(3)})`;
      }
      return EDGE_COLORS[link.relation] ?? "rgba(255,255,255,0.4)";
    }

    // 기본 모드 (첫 화면): 줌에 따라 투명도 조절
    const alpha = Math.max(0.01, Math.min(0.08, currentScale * 0.06));
    return `rgba(255,255,255,${alpha.toFixed(3)})`;
  }, [highlightEdges, focusedId, focusEdgeKeys, graphData.nodes, currentScale]);

  // ── 링크 폭 ────────────────────────────────────────────────
  const linkWidth = useCallback((link: {
    relation: V5EdgeRelation;
    source: string | { id: string };
    target: string | { id: string };
  }) => {
    const srcId = typeof link.source === "string" ? link.source : link.source.id;
    const tgtId = typeof link.target === "string" ? link.target : link.target.id;
    const key = [srcId, tgtId].sort().join("||");
    
    // 줌 스케일에 비례하는 공통 선 두께 배율 (줌아웃 시 가늘어짐)
    const scaleMultiplier = Math.max(0.2, Math.min(currentScale, 1.5));
    
    if (highlightEdges.has(key)) return 3 * scaleMultiplier;
    
    if (focusedId && graphData.nodes[focusedId]) {
      if (!focusEdgeKeys.has(key)) return 0.05 * scaleMultiplier;
      return (EDGE_WIDTH[link.relation] ?? 0.5) * 1.5 * scaleMultiplier; // 강조 시 선 굵기 1.5배 + 줌 배율
    }
    
    // 기본 모드
    return Math.max(0.05, 0.15 * scaleMultiplier);
  }, [highlightEdges, focusedId, focusEdgeKeys, graphData.nodes, currentScale]);

  // ── nodePointerAreaPaint: LOD에 맞는 히트영역 (degree 비례) ─
  const nodePointerAreaPaint = useCallback((
    node: V5Node & { x?: number; y?: number },
    color: string,
    ctx: CanvasRenderingContext2D,
    globalScale: number
  ) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const deg = node.degree ?? 0;
    const lod = globalScale < 0.4 ? "far" : globalScale < 1.5 ? "mid" : "close";
    const isFocused = node.id === focusedId;
    const isHop1 = hop1.has(node.id);

    let r = 6; // 최소 히트 반지름
    if (lod === "far")        r = 3 + Math.sqrt(deg) * 0.8;
    else if (lod === "mid")   r = 5 + Math.sqrt(deg) * 2.5;
    else /* close */          r = isFocused ? 44 : isHop1 ? 30 : 12 + Math.sqrt(deg) * 4;

    ctx.beginPath();
    ctx.arc(x, y, r * 1.15, 0, 2 * Math.PI); // 히트 영역은 시각보다 15% 크게
    ctx.fillStyle = color;
    ctx.fill();
  }, [focusedId, hop1]);

  // ── d3 force 데이터 (좌표 고정, physics OFF) ─────────────
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

  // ── Star Bloom: 애니메이션 중이면 리렌더 강제 ─────────────
  useEffect(() => {
    if (focusChangedAt === 0) return;
    const elapsed = Date.now() - focusChangedAt;
    if (elapsed >= BLOOM_DURATION_MS) return;

    const frame = requestAnimationFrame(() => {
      // React 상태 변경 없이 강제 리렌더를 위해 dummy state 사용
      setFocusChangedAt((t) => t); // no-op — ForceGraph2D가 자체 재렌더
    });
    return () => cancelAnimationFrame(frame);
  }, [focusChangedAt]);

  // ── 초기 로드 시 자동 zoomToFit ─────────────────────────────
  useEffect(() => {
    if (!graphData || graphData.nodeCount === 0) return;
    const fg = fgRef.current as { zoomToFit?: (ms: number, padding: number) => void } | null;
    if (!fg?.zoomToFit) return;
    
    // 약간의 딜레이 후 전체 우주가 화면에 맞게 줌
    const timer = setTimeout(() => {
      fg.zoomToFit?.(1000, 80); // 1초 애니메이션, 패딩 80px
      // Phase 2A: 최소 줌 보장 (거대별 클릭 가능)
      setTimeout(() => {
        const fgAny = fgRef.current as any;
        const curZoom = fgAny?.zoom?.();
        if (curZoom && curZoom < 0.4) {
          fgAny.zoom(0.4, 600);
        }
      }, 1200);
    }, 300);
    return () => clearTimeout(timer);
  }, [graphData?.nodeCount]); // graphData 로드 시 1회만

  // ── ZoomToFit ───────────────────────────────────────────────
  const handleZoomToFit = useCallback(() => {
    const fg = fgRef.current as { zoomToFit?: (ms: number, padding: number) => void } | null;
    fg?.zoomToFit?.(800, 60);
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--bg-cosmos, #05050f)" }}>
      {/* Pathfinding 안내 토스트 */}
      {pathfindingFrom && (
        <div style={{
          position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)",
          zIndex: 100, background: "rgba(5,5,15,0.85)",
          border: "1px solid rgba(167,139,250,0.4)", borderRadius: 20,
          padding: "8px 18px", color: "rgba(200,180,255,0.9)", fontSize: 12,
          backdropFilter: "blur(12px)", pointerEvents: "none",
        }}>
          ✦ 연결할 두 번째 아티스트를 클릭 (우클릭으로 취소)
        </div>
      )}

      <ForceGraph2D
        ref={fgRef}
        graphData={forceData}
        cooldownTicks={0}
        backgroundColor="rgba(0,0,0,0)"
        nodeId="id"
        nodeCanvasObjectMode={() => "replace"}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={nodePointerAreaPaint}
        nodeVal={(node: V5Node) => Math.max(2, Math.sqrt(node.degree ?? 0) * 3)}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkCanvasObjectMode={() => focusedId ? "after" : undefined}
        linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          // 포커스 모드 + 줌이 충분할 때만 레이블 표시
          if (!focusedId || globalScale < 0.6) return;
          
          const srcId = typeof link.source === "string" ? link.source : link.source?.id;
          const tgtId = typeof link.target === "string" ? link.target : link.target?.id;
          const key = [srcId, tgtId].sort().join("||");
          
          // 포커스된 아티스트의 1촌 엣지만
          if (!focusEdgeKeys.has(key)) return;
          
          const src = typeof link.source === "string" ? null : link.source;
          const tgt = typeof link.target === "string" ? null : link.target;
          if (!src?.x || !tgt?.x) return;
          
          const midX = (src.x + tgt.x) / 2;
          const midY = (src.y + tgt.y) / 2;
          
          const label = link.label || "";
          if (!label) return;
          
          const fontSize = Math.max(3, 10 / globalScale);
          ctx.save();
          ctx.font = `${fontSize}px -apple-system, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "rgba(200,180,255,0.4)";
          ctx.fillText(label, midX, midY - fontSize * 0.8);
          ctx.restore();
        }}
        onNodeClick={(node: V5Node) => {
          console.log("🟢 NODE CLICKED:", node.id, node.nameKo || node.name);
          handleNodeClick(node);
        }}
        onNodeRightClick={(node: V5Node, event: MouseEvent) => {
          event.preventDefault();
          setPathfindingFrom(node.id);
          setHighlightPath(new Set([node.id]));
          setHighlightEdges(new Set());
        }}
        onNodeHover={(node: V5Node | null) => {
          setHoverNode(node?.id ?? null);
          if (typeof document !== "undefined") {
            document.body.style.cursor = node ? "pointer" : "default";
          }
        }}
        onBackgroundClick={() => {
          if (pathfindingFrom) {
            setPathfindingFrom(null);
            setHighlightPath(new Set());
            setHighlightEdges(new Set());
          }
          if (onBackgroundClick) {
            onBackgroundClick();
          }
        }}
        onZoom={({ k }: { k: number }) => setCurrentScale(k)}
        width={dimensions[0]}
        height={dimensions[1]}
      />

      {/* Phase 5: 우하단 컨트롤 패널 */}
      <div style={{
        position: "absolute", bottom: 100, right: 16, zIndex: 80,
        display: "flex", flexDirection: "column", gap: 8,
        transition: "opacity 0.3s, transform 0.3s",
        opacity: sheetState === "expanded" ? 0 : 1,
        pointerEvents: sheetState === "expanded" ? "none" : "auto",
        transform: sheetState === "expanded" ? "translateY(10px)" : "translateY(0)"
      }}>
        {/* ZoomToFit — 전체보기 */}
        <button
          onClick={handleZoomToFit}
          title="전체 우주 보기"
          aria-label="전체 우주 보기"
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: "rgba(10,14,26,0.85)",
            border: "1px solid rgba(167,139,250,0.25)",
            color: "rgba(200,180,255,0.8)", fontSize: 16,
            cursor: "pointer", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(167,139,250,0.15)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(10,14,26,0.85)")}
        >
          ⊞
        </button>
      </div>

      {/* Phase 5: 좌하단 색상 범례 */}
      <div style={{
        position: "absolute", bottom: 100, left: 16, zIndex: 80,
        background: "rgba(10,14,26,0.82)",
        border: "1px solid rgba(167,139,250,0.15)",
        borderRadius: 12, padding: "8px 12px",
        backdropFilter: "blur(12px)",
        display: "flex", flexDirection: "column", gap: 4,
        transition: "opacity 0.3s, transform 0.3s",
        opacity: sheetState === "expanded" ? 0 : 1,
        pointerEvents: sheetState === "expanded" ? "none" : "auto",
        transform: sheetState === "expanded" ? "translateY(10px)" : "translateY(0)"
      }}>
        {([
          { color: "#86efac", label: "그룹 멤버" },
          { color: "#c084fc", label: "피처링" },
          { color: "#60a5fa", label: "프로듀서" },
          { color: "#fbbf24", label: "작곡/작사" },
        ] as { color: string; label: string }[]).map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{
              width: 20, height: 2.5, borderRadius: 2,
              background: color, opacity: 0.85, flexShrink: 0
            }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
