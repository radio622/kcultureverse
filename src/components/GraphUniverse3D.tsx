"use client";

/**
 * GraphUniverse3D — 인물 중심 Lazy Expansion 3D 우주 그래프
 *
 * 동작 방식:
 *  - 처음엔 중심 인물 노드 하나만 등장
 *  - API 응답으로 출연작(Work) 노드들이 "폭발"하며 뻗어나옴
 *  - Work 노드 클릭 → 그 작품에 출연한 다른 배우들이 또 뻗어나옴 (Lazy Expansion)
 *  - Person 노드 클릭 → 해당 인물 상세 페이지로 이동
 *
 * 성능 전략:
 *  - 한 번에 전체 그래프를 로드하지 않음
 *  - 클릭할 때마다 서버에서 1촌 관계만 비동기로 가져옴
 *  - 이미 로드된 노드는 재요청 방지 (expanded Set으로 관리)
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { getTmdbImage } from "@/lib/tmdb";

// react-force-graph-3d 는 SSR 불가 → dynamic import (GraphWrapper에서 처리)
// 여기서는 타입만 import
import type ForceGraph3DType from "react-force-graph-3d";

// ── 그래프 노드 / 링크 타입 ───────────────────────────
interface GraphNode {
  id: string;          // "person-12345" 또는 "work-67890"
  kind: "person" | "work";
  tmdbId: number;
  name: string;
  img: string | null;
  department?: string;
  workType?: "movie" | "tv";
  x?: number;
  y?: number;
  z?: number;
}
interface GraphLink {
  source: string;
  target: string;
  relType: string;
  character?: string | null;
}
interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ── API 응답 타입 ────────────────────────────────────
interface ApiPersonGraph {
  person: { tmdbId: number; name: string; department: string; profilePath: string | null };
  works: Array<{
    tmdbId: number; title: string; type: string;
    posterPath: string | null; relType: string; character: string | null; voteAvg: number;
  }>;
}

// ── 색상 유틸 ────────────────────────────────────────
const COLOR = {
  person:  "#9d6ff7", // 보라 — 인물
  movie:   "#f59e0b", // 골드 — 영화
  tv:      "#ec4899", // 핑크 — 드라마
  link:    "rgba(157,111,247,0.35)",
  bg:      "#0a0e1a",
};

function nodeColor(node: GraphNode) {
  if (node.kind === "person") return COLOR.person;
  return node.workType === "movie" ? COLOR.movie : COLOR.tv;
}

// ── 메인 컴포넌트 ────────────────────────────────────
interface Props {
  initialPersonId: number;
  height?: number;
}

// ForceGraph3D는 dynamic import 후 ref로 받습니다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ForceGraph3D: typeof ForceGraph3DType | null = null;

export default function GraphUniverse3D({ initialPersonId, height = 520 }: Props) {
  const router         = useRouter();
  const containerRef   = useRef<HTMLDivElement>(null);
  const fgRef          = useRef<unknown>(null);

  const [graph, setGraph]       = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // 이미 확장한 노드
  const [tooltip, setTooltip]   = useState<{ x: number; y: number; name: string } | null>(null);
  const [fg3DLoaded, setFg3DLoaded] = useState(false);

  // react-force-graph-3d 동적 로딩
  useEffect(() => {
    import("react-force-graph-3d").then((mod) => {
      ForceGraph3D = mod.default;
      setFg3DLoaded(true);
    });
  }, []);

  // ── 인물 그래프 데이터 로드 ──────────────────────
  const loadPersonGraph = useCallback(async (tmdbId: number) => {
    const nodeId = `person-${tmdbId}`;
    if (expanded.has(nodeId)) return;

    try {
      const res = await fetch(`/api/graph/person/${tmdbId}`);
      if (!res.ok) throw new Error("API 오류");
      const data: ApiPersonGraph = await res.json();

      setGraph((prev) => {
        const nodeMap = new Map(prev.nodes.map((n) => [n.id, n]));
        const linkSet = new Set(prev.links.map((l) => `${l.source}-${l.target}`));

        // Person 노드
        if (!nodeMap.has(nodeId)) {
          nodeMap.set(nodeId, {
            id: nodeId, kind: "person", tmdbId,
            name: data.person.name,
            img: getTmdbImage(data.person.profilePath, "w185"),
            department: data.person.department,
          });
        }

        // Work 노드 + 링크
        for (const work of data.works) {
          const wId = `work-${work.tmdbId}`;
          if (!nodeMap.has(wId)) {
            nodeMap.set(wId, {
              id: wId, kind: "work", tmdbId: work.tmdbId,
              name: work.title,
              img: getTmdbImage(work.posterPath, "w185"),
              workType: work.type as "movie" | "tv",
            });
          }
          const linkKey = `${nodeId}-${wId}`;
          if (!linkSet.has(linkKey)) {
            linkSet.add(linkKey);
          }
        }

        const newLinks: GraphLink[] = [
          ...prev.links,
          ...data.works
            .filter((w) => !prev.links.some((l) => l.source === nodeId && l.target === `work-${w.tmdbId}`))
            .map((w) => ({
              source: nodeId,
              target: `work-${w.tmdbId}`,
              relType: w.relType,
              character: w.character,
            })),
        ];

        return { nodes: Array.from(nodeMap.values()), links: newLinks };
      });

      setExpanded((prev) => new Set([...prev, nodeId]));
    } catch (e) {
      console.error("그래프 로드 실패:", e);
      setError("그래프 데이터를 불러오지 못했습니다.");
    }
  }, [expanded]);

  // 초기 로드
  useEffect(() => {
    setLoading(true);
    loadPersonGraph(initialPersonId).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPersonId]);

  // 카메라 초기 줌
  useEffect(() => {
    if (!fgRef.current || graph.nodes.length === 0) return;
    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fgRef.current as any)?.zoomToFit?.(600, 80);
    }, 800);
  }, [graph.nodes.length]);

  // ── 노드 클릭 핸들러 ────────────────────────────
  const handleNodeClick = useCallback((node: unknown) => {
    const n = node as GraphNode;
    if (n.kind === "person") {
      // 새 인물 → 페이지 이동
      router.push(`/person/${n.tmdbId}`);
    } else {
      // Work 노드 → Lazy Expansion (해당 작품의 출연진 불러오기)
      // NOTE: /api/graph/work/[id] 가 있으면 더 좋지만, 현재는 TMDb credits 활용
      // 우선은 작품 상세 페이지로 이동
      router.push(`/work/${n.workType}-${n.tmdbId}`);
    }
  }, [router]);

  // ── 노드 우클릭 → Lazy Expand ───────────────────
  const handleNodeRightClick = useCallback((node: unknown) => {
    const n = node as GraphNode;
    if (n.kind === "person") {
      loadPersonGraph(n.tmdbId);
    }
  }, [loadPersonGraph]);

  // ── 노드 호버 → 툴팁 ────────────────────────────
  const handleNodeHover = useCallback((node: unknown) => {
    if (!node) { setTooltip(null); return; }
    const n = node as GraphNode;
    setTooltip({ x: 0, y: 0, name: n.name });
  }, []);

  // ── 노드 렌더링 (Three.js Mesh) ──────────────────
  // ForceGraph3D의 nodeThreeObject를 사용해 별/포스터 구체 렌더링
  // THREE는 react-force-graph-3d가 번들해서 제공
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeThreeObject = useCallback((node: any) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const THREE = require("three");
    const n = node as GraphNode;
    const isCenter = n.tmdbId === initialPersonId && n.kind === "person";

    const geo = new THREE.SphereGeometry(isCenter ? 8 : n.kind === "person" ? 5 : 4, 16, 16);
    const mat = new THREE.MeshPhongMaterial({
      color: nodeColor(n),
      emissive: nodeColor(n),
      emissiveIntensity: isCenter ? 0.8 : 0.4,
      transparent: true,
      opacity: 0.92,
    });
    const mesh = new THREE.Mesh(geo, mat);

    // 중심 인물은 큰 글로우 Sprite 추가
    if (isCenter) {
      const canvas = document.createElement("canvas");
      canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(157,111,247,0.9)");
      grad.addColorStop(1, "rgba(157,111,247,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(40, 40, 1);
      mesh.add(sprite);
    }

    return mesh;
  }, [initialPersonId]);

  // ── 렌더링 ──────────────────────────────────────
  if (error) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", background: "var(--bg-surface)", borderRadius: 16 }}>
        ⚠️ {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height,
        background: "radial-gradient(ellipse at center, #0f1835 0%, #0a0e1a 70%)",
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    >
      {/* 로딩 오버레이 */}
      {(loading || !fg3DLoaded) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(10,14,26,0.85)",
            backdropFilter: "blur(8px)",
            gap: 16,
          }}
        >
          <div style={{ fontSize: "2.5rem", animation: "spin 3s linear infinite" }}>🌌</div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>우주 데이터 로딩 중...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* 노드 이름 툴팁 */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(10,14,26,0.9)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: "0.82rem",
            color: "var(--text-primary)",
            pointerEvents: "none",
            zIndex: 5,
            backdropFilter: "blur(8px)",
            whiteSpace: "nowrap",
          }}
        >
          {tooltip.name}
        </div>
      )}

      {/* 조작 안내 */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 16,
          zIndex: 5,
          fontSize: "0.72rem",
          color: "var(--text-muted)",
          pointerEvents: "none",
        }}
      >
        <span>🖱️ 드래그: 회전</span>
        <span>⚙️ 스크롤: 줌</span>
        <span>🟣 클릭: 이동</span>
        <span>🖱️ 우클릭(인물): 관계망 확장</span>
      </div>

      {/* 범례 */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          zIndex: 5,
          background: "rgba(10,14,26,0.75)",
          borderRadius: 10,
          padding: "10px 14px",
          backdropFilter: "blur(8px)",
          border: "1px solid var(--border)",
        }}
      >
        {[
          { color: COLOR.person, label: "인물" },
          { color: COLOR.movie,  label: "영화" },
          { color: COLOR.tv,     label: "드라마" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
            {label}
          </div>
        ))}
        <div style={{ marginTop: 4, fontSize: "0.7rem", color: "var(--text-muted)" }}>
          노드 수: {graph.nodes.length}
        </div>
      </div>

      {/* ForceGraph3D (동적 로딩 완료 후 렌더) */}
      {fg3DLoaded && ForceGraph3D && (
        <ForceGraph3D
          ref={fgRef as React.RefObject<never>}
          graphData={graph}
          backgroundColor={COLOR.bg}
          width={containerRef.current?.clientWidth ?? 800}
          height={height}
          nodeId="id"
          nodeLabel="name"
          nodeColor={(n) => nodeColor(n as GraphNode)}
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend={false}
          linkColor={() => COLOR.link}
          linkWidth={1.2}
          linkOpacity={0.6}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={1.5}
          linkDirectionalParticleColor={() => COLOR.person}
          onNodeClick={handleNodeClick}
          onNodeRightClick={handleNodeRightClick}
          onNodeHover={handleNodeHover}
          enableNodeDrag={false}
          cooldownTicks={120}
          onEngineStop={() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (fgRef.current as any)?.zoomToFit?.(400, 80);
          }}
        />
      )}
    </div>
  );
}
