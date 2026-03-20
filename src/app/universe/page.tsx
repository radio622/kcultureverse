"use client";

/**
 * 🌌 K-Culture Universe V5.3 — 단일 캔버스 우주 페이지
 *
 * Phase 4 구현:
 *   Task 4-1. 3분할 데이터 로딩 파이프라인
 *     - v5-layout.json (42KB) → 즉시 렌더링 (별점 우주)
 *     - v5-edges.json (74KB) → 백그라운드 로딩 (~2초 후)
 *     - v5-details.json → 아티스트 클릭 시 on-demand
 *
 *   Task 4-2. 바텀시트 1촌 워프 포탈
 *     - 클릭된 아티스트의 1촌 목록을 바텀시트에 표시
 *     - 각 항목 탭 → Fly-To (페이지 전환 없음)
 *     - 캔버스 Dim/Blur: expanded 시 배경 희미
 *
 *   Core SPA 원칙:
 *     - GraphCosmos Canvas는 절대 언마운트 안 됨 (블랙아웃 방지)
 *     - URL은 history.replaceState (/universe?artist=ID)
 *     - 뒤로가기 → popstate 감지 → Fly-To
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  Suspense,
} from "react";
import dynamic from "next/dynamic";
import BottomSheet, { type SheetState } from "@/components/BottomSheet";
import MiniPlayer from "@/components/MiniPlayer";
import FloatingSearch from "@/components/FloatingSearch";
import { useAudio } from "@/hooks/useAudio";

// ── V5 타입 ──────────────────────────────────────────────────────
interface LayoutNode {
  id: string;
  name: string;
  nameKo: string;
  x: number;
  y: number;
  degree: number;
  accent?: string;
}

interface V5LayoutFile {
  version: string;
  nodeCount: number;
  nodes: LayoutNode[];
}

interface V5EdgeFile {
  version: string;
  edgeCount: number;
  edges: {
    source: string;
    target: string;
    weight: number;
    relation: string;
    label: string;
  }[];
}

interface V5DetailNode {
  image: string | null;
  genres: string[];
  popularity: number;
  previewUrl: string | null;
  previewTrackName: string | null;
  spotifyUrl: string | null;
}

interface V5DetailFile {
  nodes: Record<string, V5DetailNode>;
}

// 바텀시트에 표시할 1촌 항목
interface HopItem {
  id: string;
  name: string;
  nameKo: string;
  image: string | null;
  relation: string;
  label?: string;
  degree: number;
  accent?: string;
}

// GraphCosmos용 통합 그래프 타입
import type { UniverseGraphV5 } from "@/lib/graph-v5";

// GraphCosmos는 SSR 불가 → dynamic import
const GraphCosmos = dynamic(
  () => import("@/components/GraphCosmos"),
  {
    ssr: false,
    loading: () => (
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-cosmos, #05050f)",
        color: "rgba(200,180,255,0.6)", fontSize: 14, gap: 10,
      }}>
        <span style={{ animation: "cosmosP 1.5s ease-in-out infinite" }}>✦</span>
        우주를 펼치는 중...
      </div>
    ),
  }
);

export default function UniversePage() {
  const audio = useAudio();

  // ── 데이터 상태 ────────────────────────────────────────────────
  const [graphData, setGraphData] = useState<UniverseGraphV5 | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<"layout" | "edges" | "ready" | "error">("layout");

  // Detail 캐시 (on-demand)
  const detailCache = useRef<Record<string, V5DetailNode>>({});
  const detailLoaded = useRef(false);

  // ── UI 상태 ──────────────────────────────────────────────────
  const [sheetState, setSheetState] = useState<SheetState>("collapsed");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusedArtistName, setFocusedArtistName] = useState<string>("");
  const [hop1List, setHop1List] = useState<HopItem[]>([]);

  // ── Task 4-1: 3분할 로딩 파이프라인 ──────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadUniverse() {
      // Phase A: layout (즉시 렌더링용 — 좌표 + tier만)
      setLoadingPhase("layout");
      let layoutFile: V5LayoutFile;
      try {
        const res = await fetch("/data/v5-layout.json");
        if (!res.ok) throw new Error("layout 없음");
        layoutFile = await res.json();
      } catch {
        setLoadingPhase("error");
        return;
      }
      if (cancelled) return;

      // layout만으로 최소 그래프 구성 → 즉시 표시
      const nodesMap: Record<string, UniverseGraphV5["nodes"][string]> = {};
      for (const n of layoutFile.nodes) {
        nodesMap[n.id] = {
          id: n.id, name: n.name, nameKo: n.nameKo,
          x: n.x, y: n.y, degree: n.degree ?? 0, accent: n.accent,
          image: null, genres: [], popularity: 0,
          previewUrl: null, previewTrackName: null, spotifyUrl: null,
        };
      }
      setGraphData({
        version: 5, builtAt: "", nodeCount: layoutFile.nodeCount, edgeCount: 0,
        nodes: nodesMap, edges: [],
      });
      setLoadingPhase("edges");

      // Phase B: edges (백그라운드 — ~2초 후 관계선 표시)
      try {
        const res = await fetch("/data/v5-edges.json");
        if (!res.ok) throw new Error("edges 없음");
        const edgeFile: V5EdgeFile = await res.json();
        if (cancelled) return;

        setGraphData((prev) => prev
          ? { ...prev, edgeCount: edgeFile.edgeCount, edges: edgeFile.edges as UniverseGraphV5["edges"] }
          : prev
        );
      } catch {
        // edges 없어도 계속 진행 (좌표만으로도 탐색 가능)
      }
      if (cancelled) return;

      // Phase C: details (백그라운드 — 이미지/장르 보완)
      try {
        const res = await fetch("/data/v5-details.json");
        if (!res.ok) throw new Error("details 없음");
        const detailFile: V5DetailFile = await res.json();
        if (cancelled) return;

        detailCache.current = detailFile.nodes;
        detailLoaded.current = true;

        // 노드에 detail 정보 주입
        setGraphData((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, nodes: { ...prev.nodes } };
          for (const [id, detail] of Object.entries(detailFile.nodes)) {
            if (updated.nodes[id]) {
              updated.nodes[id] = { ...updated.nodes[id], ...detail };
            }
          }
          return updated;
        });
      } catch {
        // details 없어도 계속
      }

      setLoadingPhase("ready");
    }

    loadUniverse();
    return () => { cancelled = true; };
  }, []);

  // ── URL → focusedId 초기 동기화 ─────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const artistId = params.get("artist");
    if (artistId && graphData?.nodes[artistId]) {
      handleArtistSelect(artistId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData?.nodeCount]); // graph 로드 직후 1회

  // ── 뒤로가기(popstate) 동기화 ────────────────────────────────
  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const artistId = params.get("artist");
      if (artistId) {
        setFocusedId(artistId);
      } else {
        setFocusedId(null);
        setSheetState("collapsed");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // ── Task 4-2: 아티스트 선택 → 1촌 워프 포탈 구성 ─────────────
  const handleArtistSelect = useCallback((nodeId: string) => {
    if (!graphData) return;
    const node = graphData.nodes[nodeId];
    if (!node) return;

    setFocusedId(nodeId);
    setFocusedArtistName(node.nameKo || node.name);
    setSheetState("peek");

    // URL 업데이트 (페이지 전환 없음)
    window.history.replaceState(null, "", `/universe?artist=${nodeId}`);

    // 1촌 hop 목록 구성 (weight 내림차순, 최대 20개)
    const neighbors = graphData.edges
      .filter((e) => e.source === nodeId || e.target === nodeId)
      .map((e) => {
        const nbId = e.source === nodeId ? e.target : e.source;
        const nb = graphData.nodes[nbId];
        if (!nb) return null;
        return {
          id: nbId,
          name: nb.name,
          nameKo: nb.nameKo || nb.name,
          image: nb.image,
          relation: e.relation,
          label: e.label,
          degree: nb.degree ?? 0,
          accent: nb.accent,
          weight: e.weight,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b as any).weight - (a as any).weight)
      .slice(0, 20) as HopItem[];

    setHop1List(neighbors);

    // 오디오 프리뷰 (detail에서)
    const detail = detailCache.current[nodeId];
    if (detail?.previewUrl) {
      audio.announce(nodeId, node.nameKo || node.name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, audio]);

  // 1촌 워프 포탈 탭 → Fly-To
  const handleHopItemTap = useCallback((id: string) => {
    handleArtistSelect(id);
  }, [handleArtistSelect]);

  return (
    <>
      <style>{`
        @keyframes cosmosP {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
        .warp-list { list-style: none; margin: 0; padding: 8px 16px 24px; overflow-y: auto; flex: 1 1 0; min-height: 0; }
        .warp-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px; cursor: pointer; transition: background 0.15s; margin-bottom: 4px; }
        .warp-item:hover, .warp-item:active { background: rgba(167,139,250,0.12); }
        .warp-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: rgba(167,139,250,0.15); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600; color: rgba(200,180,255,0.8); overflow: hidden; }
        .warp-info { flex: 1; min-width: 0; }
        .warp-name { font-size: 14px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .warp-label { font-size: 11px; color: rgba(167,139,250,0.75); margin-top: 2px; }
        .warp-fly { font-size: 11px; color: rgba(200,180,255,0.4); flex-shrink: 0; }
        .relation-pill { display: inline-block; padding: 1px 7px; border-radius: 20px; font-size: 10px; font-weight: 500; margin-right: 4px; }
        .rel-SAME_GROUP { background: rgba(134,239,172,0.15); color: #86efac; }
        .rel-FEATURED   { background: rgba(192,132,252,0.15); color: #c084fc; }
        .rel-PRODUCER   { background: rgba(96,165,250,0.15);  color: #60a5fa; }
        .rel-WRITER     { background: rgba(251,191,36,0.15);  color: #fbbf24; }
        .rel-INDIRECT   { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); }
        .rel-GENRE_OVERLAP { background: rgba(167,139,250,0.08); color: rgba(167,139,250,0.5); }
        .universe-focused-header { padding: 12px 16px 4px; }
        .universe-focused-name  { font-size: 18px; font-weight: 700; color: #fff; }
        .universe-hop-count     { font-size: 12px; color: rgba(167,139,250,0.7); margin-top: 2px; }
        .canvas-dim { transition: filter 0.3s, opacity 0.3s; }
        .canvas-dim.dimmed { filter: blur(2px); opacity: 0.6; }
      `}</style>

      {/* 검색 */}
      <FloatingSearch onSelect={handleArtistSelect} />

      {/* 로딩 상태 안내 */}
      {loadingPhase === "layout" && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          zIndex: 50, color: "rgba(200,180,255,0.6)", fontSize: 12, pointerEvents: "none",
        }}>
          ✦ 우주 지도 로딩 중...
        </div>
      )}
      {loadingPhase === "error" && (
        <div style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          color: "rgba(200,180,255,0.7)", textAlign: "center", fontSize: 14, lineHeight: 2,
        }}>
          <p>🌌 우주 지도를 찾을 수 없습니다.</p>
          <p style={{ fontSize: 12, opacity: 0.6 }}>
            터미널: <code>npm run v5:build</code>
          </p>
        </div>
      )}

      {/* 🌌 Canvas 우주 (절대 언마운트 안 됨) */}
      <div className={`canvas-dim${sheetState === "expanded" ? " dimmed" : ""}`}
        style={{ position: "absolute", inset: 0 }}
      >
        {graphData && (
          <Suspense fallback={null}>
            <GraphCosmos
              graphData={graphData}
              onArtistSelect={handleArtistSelect}
              focusedId={focusedId}
            />
          </Suspense>
        )}
      </div>

      {/* 바텀시트 — Task 4-2: 1촌 워프 포탈 */}
      <BottomSheet state={sheetState} onStateChange={setSheetState}>
        <>
          {/* 미니 플레이어 */}
          <MiniPlayer
            isPlaying={audio.isPlaying}
            trackName={audio.currentTrackName}
            progress={audio.progress}
            onStop={audio.stop}
            sheetState={sheetState}
            onExpand={() => setSheetState("expanded")}
          />

          {/* 1촌 워프 포탈 목록 */}
          {sheetState === "expanded" && focusedId && (
            <>
              {/* 헤더 */}
              <div className="universe-focused-header">
                <div className="universe-focused-name">{focusedArtistName}</div>
                <div className="universe-hop-count">
                  연결된 아티스트 {hop1List.length}명
                </div>
              </div>

              {hop1List.length === 0 ? (
                <div style={{ padding: "20px 16px", color: "rgba(200,180,255,0.4)", fontSize: 13, textAlign: "center" }}>
                  연결된 아티스트가 없습니다
                </div>
              ) : (
                <ul className="warp-list">
                  {hop1List.map((item) => (
                    <li
                      key={item.id}
                      className="warp-item"
                      onClick={() => handleHopItemTap(item.id)}
                      role="button"
                      aria-label={`${item.nameKo}로 이동`}
                    >
                      {/* 아바타 */}
                      <div className="warp-avatar" style={{
                        border: `1.5px solid ${item.accent || "rgba(167,139,250,0.3)"}`,
                      }}>
                        {item.image
                          ? <img src={item.image} alt={item.nameKo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : (item.nameKo || item.name).charAt(0)
                        }
                      </div>

                      {/* 정보 */}
                      <div className="warp-info">
                        <div className="warp-name">{item.nameKo || item.name}</div>
                        <div className="warp-label">
                          <span className={`relation-pill rel-${item.relation}`}>
                            {item.relation === "SAME_GROUP" ? "멤버" :
                             item.relation === "FEATURED"   ? "피처링" :
                             item.relation === "PRODUCER"   ? "프로듀서" :
                             item.relation === "WRITER"     ? "작곡/작사" :
                             item.relation === "INDIRECT"   ? "간접" : "관련"}
                          </span>
                          {item.label}
                        </div>
                      </div>

                      {/* 워프 화살표 */}
                      <div className="warp-fly">→</div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      </BottomSheet>
    </>
  );
}
