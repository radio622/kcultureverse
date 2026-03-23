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
import UserAvatar from "@/components/UserAvatar";
import EditSuggestModal from "@/components/EditSuggestModal";
import AutoWarpPanel from "@/components/AutoWarpPanel";
import { useAudio } from "@/hooks/useAudio";
import { useAutoWarp } from "@/hooks/useAutoWarp";
import { usePlayQueue } from "@/hooks/usePlayQueue";
import { useJourneyPlayer } from "@/hooks/useJourneyPlayer";
import { dijkstra } from "@/lib/dijkstra";
import { useSession } from "next-auth/react";





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
  previewUrl?: string | null;
  previewTrackName?: string | null;
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

// 국어 종성(받침) 유무에 따른 조사 선택 함수
function getJosa(word: string, josa1: string, josa2: string) {
  if (!word) return josa1;
  const lastChar = word.charCodeAt(word.length - 1);
  if (lastChar < 0xac00 || lastChar > 0xd7a3) {
    // 한글이 아닌 경우(영어, 숫자 등) 일부 발음에 따라 예외 처리
    const isEnglishConsonant = /[13678LMNR]$/i.test(word);
    return isEnglishConsonant ? josa2 : josa1;
  }
  const hasJongsung = (lastChar - 0xac00) % 28 > 0;
  return hasJongsung ? josa2 : josa1;
}

export default function UniverseClient() {
  const audio = useAudio();
  const { data: session } = useSession();


  // ── 데이터 상태 ────────────────────────────────────────────────
  const [graphData, setGraphData] = useState<UniverseGraphV5 | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<"layout" | "edges" | "ready" | "error">("layout");

  // Detail 캐시 (on-demand)
  const detailCache = useRef<Record<string, V5DetailNode>>({});
  const detailLoaded = useRef(false);

  // 마우스 스크롤(드래그) 지원용 Refs
  const warpListRef = useRef<HTMLUListElement>(null);
  const isDraggingCard = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const hasDragged = useRef(false);

  // ── UI 상태 ──────────────────────────────────────────────────
  const [sheetState, setSheetState] = useState<SheetState>("collapsed");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const currentFocusedIdRef = useRef<string | null>(null); // 최신 포커스 ID 즉각 참조용
  const [focusedArtistName, setFocusedArtistName] = useState<string>("");
  const [hop1List, setHop1List] = useState<HopItem[]>([]);

  // ── 탐험 발자국 (Breadcrumbs) ─────────────────────────────────
  const [breadcrumbs, setBreadcrumbs] = useState<{id: string; name: string}[]>([]);

  // Phase 4: 에디트 제안 모달
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Phase 3-1: 여정 도착 토스트
  const [arrivedToast, setArrivedToast] = useState<string | null>(null);

  // Phase 7: 자율주행 (handleArtistSelect 참조를 ref로 안전하게 전달)
  const handleArtistSelectRef = useRef<(nodeId: string, options?: { isSystem?: boolean; skipAudio?: boolean }) => void>(() => {});
  const warp = useAutoWarp({
    graphData,
    audioPlay: audio.play,
    audioStop: audio.stop,
    onNodeFocus: (nodeId: string) => handleArtistSelectRef.current(nodeId),
  });

  // V7.7: 연속 재생 큐
  // /api/spotify/preview?name= 엔드포인트로 previewUrl 조회
  const fetchPreviewByName = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/spotify/preview?name=${encodeURIComponent(name)}`);
      if (!res.ok) return null;
      return await res.json() as { previewUrl?: string; trackName?: string };
    } catch {
      return null;
    }
  }, []);

  const playQueue = usePlayQueue({
    audioPlay: audio.play,
    audioSetOnEnded: audio.setOnEnded,
    fetchPreview: fetchPreviewByName,
  });

  // V7.7 Phase 3-1: A→B 여정 플레이어
  const journey = useJourneyPlayer({
    getArtistName: (nodeId) =>
      graphData?.nodes[nodeId]
        ? (graphData.nodes[nodeId].nameKo || graphData.nodes[nodeId].name)
        : nodeId,
    onNodeFocus: (nodeId) => handleArtistSelectRef.current(nodeId, { isSystem: true, skipAudio: true }),
    audioPlay: audio.play,
    audioSetOnEnded: audio.setOnEnded,
    fetchPreview: fetchPreviewByName,
    onArrived: (steps) => {
      setDualPathTarget(null);
      const lastName = steps[steps.length - 1]?.name ?? "";
      setArrivedToast(`🎉 ${lastName}에 도착했습니다!`);
      // 5초 후 여정 관련 상태 모두 정리 → 일반 탐색 모드 복귀
      setTimeout(() => {
        setArrivedToast(null);
        setJourneyShareUrl(null);
        setDualTargetName(null);
      }, 5000);
    },
  });


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
  // 주의: ?to= 파라미터가 있으면 여정 모드이므로 여기서 포커스하지 않음
  //       (여정 Effect가 edges 로딩 완료 후 Bird's Eye View → 줌인을 순차 처리)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const artistId = params.get("artist");
    const toId = params.get("to");
    // 여정 모드(?to= 존재)에서는 건너뜀 — handleDualSelect가 전담
    if (toId) return;
    if (artistId && graphData?.nodes[artistId]) {
      handleArtistSelect(artistId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData?.nodeCount]); // graph 로드 직후 1회

  // ── URL ?to 파라미터 감지 → 여정 자동 시작 ──────────────────────
  // /universe?artist=A&to=B → A에서 B까지 자동 여정
  useEffect(() => {
    if (!graphData || graphData.edges.length === 0) return; // edges 로딩 완료 후 실행
    const params = new URLSearchParams(window.location.search);
    const toId = params.get("to");
    const fromId = params.get("artist");
    if (!toId || !fromId) return;
    if (!graphData.nodes[toId] || !graphData.nodes[fromId]) return;

    // handleDualSelect를 호출해 줌아웃(새의 눈) -> 여정 시작 경험 동일 적용
    handleDualSelect(fromId, toId);

    // ?to 파라미터 제거 (중복 실행 방지) — artist 파라미터는 유지
    const url = new URL(window.location.href);
    url.searchParams.delete("to");
    window.history.replaceState({}, "", url.toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData?.edges.length]); // edges 로딩 완료 시 1회

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const artistId = params.get("artist");
      if (artistId) {
        setFocusedId(artistId);
        currentFocusedIdRef.current = artistId;
      } else {
        setFocusedId(null);
        currentFocusedIdRef.current = null;
        setSheetState("collapsed");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleArtistSelect = useCallback((nodeId: string, options?: { isSystem?: boolean; skipAudio?: boolean }) => {
    if (!graphData) return;
    const node = graphData.nodes[nodeId];
    if (!node) {
      alert("현재 우주에 존재하지 않는 아티스트입니다. (우주 지도는 V6.5 배포 버전 기준 989명을 지원합니다)");
      return;
    }

    // 이미 선택된 별을 다시 클릭하면 바텀시트 토글 (올리기/내리기)
    if (currentFocusedIdRef.current === nodeId && !options?.isSystem) {
      setSheetState((s) => (s === "expanded" ? "peek" : "expanded"));
      return;
    }

    // 수동 선택: journey / warp 정지 (자동 탐색 중단 후 유저 의도 우선)
    if (!options?.isSystem) {
      journey.stop();
      warp.stop();
      setDualPathTarget(null);
    }

    setFocusedId(nodeId);
    currentFocusedIdRef.current = nodeId;
    setFocusedArtistName(node.nameKo || node.name);
    setSheetState("expanded");

    // 탐험 발자국 업데이트
    setBreadcrumbs(prev => {
      const existIdx = prev.findIndex(b => b.id === nodeId);
      if (existIdx >= 0) return prev.slice(0, existIdx + 1);
      const next = [...prev, { id: nodeId, name: node.nameKo || node.name }];
      return next.length > 10 ? next.slice(-10) : next;
    });

    // URL 업데이트 (페이지 전환 없음)
    window.history.replaceState(null, "", `/universe?artist=${nodeId}`);

    // 1촌 hop 목록 구성 (weight 내림차순, 최대 20개)
    const neighbors = graphData.edges
      .filter((e) => e.source === nodeId || e.target === nodeId)
      .map((e) => {
        const nbId = e.source === nodeId ? e.target : e.source;
        const nb = graphData.nodes[nbId];
        if (!nb) return null;
        const nbDetail = detailCache.current[nbId];
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
          previewUrl: nbDetail?.previewUrl ?? null,
          previewTrackName: nbDetail?.previewTrackName ?? null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b as any).weight - (a as any).weight)
      .slice(0, 20) as HopItem[];

    setHop1List(neighbors);

    // V7.7: 연속 재생 큐 구성 — 현재 포커스 아티스트부터 시작
    const detail = detailCache.current[nodeId];
    const queueItems = [
      {
        artistId: nodeId,
        artistName: node.nameKo || node.name,
        previewUrl: detail?.previewUrl ?? undefined,
      },
      ...neighbors.map((n) => ({
        artistId: n.id,
        artistName: n.nameKo || n.name,
        previewUrl: n.previewUrl ?? undefined,
      })),
    ];
    playQueue.setQueue(queueItems, 0);

    // 오디오 프리뷰 자동 재생 (detail에서 바로 있으면 재생, 없으면 API fetch)
    if (!options?.skipAudio) {
      if (detail?.previewUrl) {
        audio.play(
          detail.previewUrl,
          detail.previewTrackName || node.nameKo || node.name,
          nodeId
        );
      } else {
        // previewUrl 없으면 API에서 즉시 fetch 후 재생
        fetchPreviewByName(node.nameKo || node.name).then((r) => {
          if (r?.previewUrl && currentFocusedIdRef.current === nodeId) {
            audio.play(r.previewUrl, r.trackName || node.nameKo || node.name, nodeId);
          }
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, audio, playQueue, journey, warp, fetchPreviewByName]);


  // Phase 7: ref 동기화
  handleArtistSelectRef.current = handleArtistSelect;

  // ── 스와이프 시 음악 자동재생 옵저버 ──────────────────────────────────
  useEffect(() => {
    if (!warpListRef.current) return;
    const list = warpListRef.current;
    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      clearTimeout(timeoutId);
      // 스크롤이 끝난 뒤 0.4초 후 위치를 파악하여 음악 재생
      timeoutId = setTimeout(() => {
        if (isDraggingCard.current || sheetState !== "expanded") return;

        // 리스트의 화면 중앙 X 좌표 계산
        const listRect = list.getBoundingClientRect();
        const listCenter = listRect.left + listRect.width / 2;
        
        let closestItem: HTMLElement | null = null;
        let minDiff = Infinity;

        // 가장 중앙에 가까운 warp-item 찾기
        for (const child of Array.from(list.children)) {
          const rect = child.getBoundingClientRect();
          const itemCenter = rect.left + rect.width / 2;
          const diff = Math.abs(listCenter - itemCenter);
          if (diff < minDiff) {
            minDiff = diff;
            closestItem = child as HTMLElement;
          }
        }

        // 중앙(오차 80px 내)에 아이템이 확실히 멈춰있으면 자동 재생
        if (closestItem && minDiff < 80) {
          const artistId = closestItem.getAttribute("data-id");
          const url = closestItem.getAttribute("data-url");
          const track = closestItem.getAttribute("data-track");
          
          if (artistId && url && artistId !== audio.currentArtistId) {
            audio.play(url, track || "", artistId);
          }
        }
      }, 400); 
    };

    list.addEventListener("scroll", handleScroll, { passive: true });
    return () => list.removeEventListener("scroll", handleScroll);
  }, [sheetState, audio]);

  // 1촌 워프 포탈 탭 → Fly-To
  const handleHopItemTap = useCallback((id: string) => {
    handleArtistSelect(id);
  }, [handleArtistSelect]);

  // ── Phase 3: 듀얼 아티스트 관계 탐색 ────────────────────────────
  // A 포커스 → B까지 경로 하이라이트 (GraphCosmos의 Pathfinding 기능 활용)
  // GraphCosmos 내부 pathfindingFrom 상태 직접 제어가 어려우므로
  // 표준 방식: A를 선택(포커스) → B를 "두번째 Pathfinding 클릭"과 동일하게 처리하기 위해
  // GraphCosmos에 dualTarget prop을 추가하거나, 여기서 URL 쿼리로 넘기는 방식 사용.
  // 현재 아키텍처에서는 A 포커스 후 URL에 pathTo 파라미터를 추가하는 방식이 가장 간결.
  const [dualPathTarget, setDualPathTarget] = useState<string | null>(null);
  const [journeyShareUrl, setJourneyShareUrl] = useState<string | null>(null); // A→B 공유 URL
  const [dualTargetName, setDualTargetName] = useState<string | null>(null); // 궤도 목표 아티스트 이름


  const handleDualSelect = useCallback((idA: string, idB: string) => {
    if (!graphData) return;
    const nodeB = graphData.nodes[idB];
    if (!graphData.nodes[idA] || !nodeB) {
      alert("두 아티스트 중 하나 이상이 현재 우주에 없습니다.");
      return;
    }
    // 사용자 검색 상호작용이므로 기존 흐름 중지
    audio.stop();
    playQueue.disableQueue();
    warp.stop();
    journey.stop();

    // 1. A를 포커스하되 재생 없이 시스템 모드로, B로 듀얼 타겟 설정 -> GraphCosmos에서 Bird's Eye 줌아웃 수행
    handleArtistSelect(idA, { isSystem: true, skipAudio: true });
    setDualPathTarget(idB);
    setDualTargetName(nodeB.nameKo || nodeB.name);

    // 즉시 공유 가능하도록 URL 세팅
    const shareUrl = `${window.location.origin}/universe?artist=${idA}&to=${idB}`;
    setJourneyShareUrl(shareUrl);

    // 2. 4초간 한눈에 경로를 감상한 뒤 (Bird's Eye View), 여정 자동 재생 (줌인 포함)
    //    줌아웃 애니메이션 1.8s + 전류 흐름 감상 ~2.2s = 4s
    setTimeout(() => {
      setDualPathTarget(null); // BBox 해제, handleArtistSelect 시 카메라는 다시 node Focus로 이동 가능
      if (graphData.edges.length > 0) {
        const path = dijkstra(graphData.nodes, graphData.edges, idA, idB);
        if (path.length >= 2) {
          journey.start(path); // 내부적으로 handleArtistSelect를 순차 호출하며 카메라 줌인 & 재생
        }
      }
    }, 4000);

  }, [graphData, handleArtistSelect, playQueue, journey]);



  // ── 네이티브 공유 및 클립보드 복사 기능 ──────────────────────────────────
  const handleShare = useCallback(async () => {
    const targetId = audio.currentArtistId || currentFocusedIdRef.current;
    const artistName = targetId && graphData?.nodes[targetId]
      ? (graphData.nodes[targetId].nameKo || graphData.nodes[targetId].name)
      : focusedArtistName;
      
    // 현재 탐험 중인 아티스트 기준 URL 생성
    const shareUrl = new URL(window.location.href);
    if (targetId) {
      shareUrl.searchParams.set("artist", targetId);
    }

    const josa = getJosa(artistName, "로부터", "으로부터");
    const shareData = {
      title: `${artistName}${josa} 🚀`,
      text: `${artistName}의 음악 우주를 탐험하세요`,
      url: shareUrl.toString()
    };

    if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("공유 취소/실패:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl.toString());
        alert(`우주 좌표가 복사되었습니다!\n${shareUrl.toString()}`);
      } catch {
        alert("링크 복사를 지원하지 않는 환경입니다.");
      }
    }
  }, [audio.currentArtistId, graphData, focusedArtistName]);

  // ── 여정 공유 콜백 ───────────────────────────────────────────────
  const handleJourneyShare = useCallback(async () => {
    if (!journeyShareUrl) return;
    try {
      let first = "";
      let last = "";
      if (journey.steps.length > 0) {
        first = journey.steps[0]?.name || "";
        last = journey.steps[journey.steps.length - 1]?.name || "";
      } else if (focusedId && dualTargetName) {
        first = graphData?.nodes[focusedId]?.nameKo || graphData?.nodes[focusedId]?.name || focusedArtistName;
        last = dualTargetName;
      }

      if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        const shareTitle = `${first}${getJosa(first, "로부터", "으로부터")} ${last}에게 🚀`;
        await navigator.share({
          title: shareTitle,
          text: `${first}에서 ${last}까지, 음악으로 이어지는 우주 여정`,
          url: journeyShareUrl,
        });
      } else {
        await navigator.clipboard.writeText(journeyShareUrl);
        setArrivedToast("🔗 여정 링크가 복사되었습니다!");
        setTimeout(() => setArrivedToast(null), 2500);
      }
    } catch {
      // ignore
    }
  }, [journeyShareUrl, journey.steps, focusedId, dualTargetName, graphData, focusedArtistName]);

  return (
    <>
      <style>{`
        @keyframes cosmosP {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
        /* Swipeable Card Deck */
        .warp-list { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 12px; padding: 0px 20px 8px; margin: 0; list-style: none; scrollbar-width: none; -ms-overflow-style: none; }
        .warp-list::-webkit-scrollbar { display: none; }
        .warp-item { position: relative; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; width: 130px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 12px 12px 20px; text-align: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); scroll-snap-align: center; scroll-margin-inline: 20px; }
        .warp-item:hover, .warp-item:active { background: rgba(255,255,255,0.07); border-color: rgba(167,139,250,0.4); transform: translateY(-2px); }
        .warp-avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: rgba(167,139,250,0.15); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 600; color: rgba(200,180,255,0.8); overflow: hidden; margin-bottom: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .warp-info { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; flex: 1; min-height: 54px; }
        .warp-name { font-size: 13px; font-weight: 600; color: #fff; width: 100%; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; }
        .warp-label { font-size: 11px; color: rgba(167,139,250,0.75); display: flex; flex-direction: column; gap: 2px; align-items: center; width: 100%; }
        .warp-label span.relation-desc { display: block; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.8; }
        .relation-pill { display: inline-flex; align-items: center; justify-content: center; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; letter-spacing: -0.2px; }
        .rel-SAME_GROUP { background: rgba(134,239,172,0.15); color: #86efac; }
        .rel-FEATURED   { background: rgba(192,132,252,0.15); color: #c084fc; }
        .rel-PRODUCER   { background: rgba(96,165,250,0.15);  color: #60a5fa; }
        .rel-WRITER     { background: rgba(251,191,36,0.15);  color: #fbbf24; }
        .rel-SHARED_WRITER   { background: rgba(251,191,36,0.10);  color: rgba(251,191,36,0.7); }
        .rel-SHARED_PRODUCER { background: rgba(96,165,250,0.10);  color: rgba(96,165,250,0.7); }
        .rel-INDIRECT   { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); }
        .rel-GENRE_OVERLAP { background: rgba(167,139,250,0.08); color: rgba(167,139,250,0.5); }
        /* Warp item play button (Card version) */
        .warp-play { width: 100%; height: 36px; margin-top: 10px; background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; color: #d8b4ff; font-size: 12px; font-weight: 600; transition: all 0.2s; padding: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .warp-play:hover { background: rgba(167,139,250,0.2); color: #fff; border-color: rgba(167,139,250,0.5); }
        .warp-play.playing { background: rgba(167,139,250,0.25); color: #fff; border-color: rgba(167,139,250,0.6); animation: wpulse 2s ease-in-out infinite; box-shadow: 0 0 10px rgba(167,139,250,0.3); }
        @keyframes wpulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
        @keyframes toastIn { 0% { opacity: 0; transform: translate(-50%, -44%); } 100% { opacity: 1; transform: translate(-50%, -50%); } }
        /* Breadcrumbs */
        .breadcrumbs-bar { position: fixed; top: 12px; left: 56px; right: 16px; z-index: 90; display: flex; align-items: center; gap: 4px; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%); -webkit-mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%); padding: 4px 8px; }
        .breadcrumbs-bar::-webkit-scrollbar { display: none; }
        .bc-crumb { flex-shrink: 0; padding: 4px 10px; border-radius: 14px; font-size: 11px; font-weight: 500; color: rgba(200,180,255,0.5); background: rgba(167,139,250,0.08); border: 1px solid rgba(167,139,250,0.12); cursor: pointer; transition: all 0.2s; white-space: nowrap; backdrop-filter: blur(8px); }
        .bc-crumb:hover { background: rgba(167,139,250,0.18); color: rgba(200,180,255,0.8); }
        .bc-crumb.active { background: rgba(167,139,250,0.2); color: #c8b4ff; border-color: rgba(167,139,250,0.4); }
        .bc-arrow { color: rgba(167,139,250,0.25); font-size: 10px; flex-shrink: 0; }
        .universe-focused-header { padding: 12px 16px 4px; display: flex; justify-content: space-between; alignItems: flex-start; gap: 8px;}
        .universe-focused-name  { font-size: 18px; font-weight: 700; color: #fff; }
        .universe-hop-count     { font-size: 12px; color: rgba(167,139,250,0.7); margin-top: 2px; }
        .artist-external-link { font-size: 11px; color: rgba(200,180,255,0.7); background: rgba(167,139,250,0.1); padding: 5px 11px; border-radius: 12px; text-decoration: none; transition: 0.2s; white-space: nowrap; border: 1px solid rgba(167,139,250,0.2); display: inline-block; margin-top: 2px; }
        .artist-external-link:hover { background: rgba(167,139,250,0.2); color: #fff; }
        .artist-external-link span { font-size: 9px; opacity: 0.7; margin-left: 2px; }
      `}</style>

      {/* 검색 */}
      <FloatingSearch onSelect={handleArtistSelect} onDualSelect={handleDualSelect} />


      {/* 우측 상단: 정보 수정 제안 + 공유 버튼 + 유저 아바타 */}
      <div style={{
        position: "fixed", top: 16, right: 16, zIndex: 200,
        display: "flex", alignItems: "center", gap: 8,
        maxWidth: "calc(100vw - 80px)", /* 검색 아이콘 등 좌측 여백 확보 */
        flexWrap: "nowrap",
      }}>
        {/* 정보 수정 제안 버튼 (포커스 + expanded 상태에서만, 여정 모드에서는 숨김 — 공간 확보) */}
        {focusedId && sheetState === "expanded" && !journeyShareUrl && (
          <button
            id="edit-suggest-btn"
            onClick={() => setEditModalOpen(true)}
            title="아티스트 정보 수정 제안"
            style={{
              margin: 0, padding: "8px 12px",
              fontSize: 11, fontWeight: 600,
              color: "rgba(167,139,250,0.8)",
              background: "rgba(10,14,26,0.85)",
              border: "1px solid rgba(167,139,250,0.25)",
              borderRadius: 20, cursor: "pointer",
              backdropFilter: "blur(8px)",
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(167,139,250,0.15)";
              e.currentTarget.style.borderColor = "rgba(167,139,250,0.5)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(10,14,26,0.85)";
              e.currentTarget.style.borderColor = "rgba(167,139,250,0.25)";
            }}
          >
            ✨ 정보 수정 제안
          </button>
        )}
        {/* 공유 버튼 — 여정 공유는 진행 바에 통합됨. 여기는 일반 아티스트 공유만 */}
        {!journeyShareUrl && focusedId && sheetState !== "collapsed" ? (
          <button
            onClick={handleShare}
            className="artist-external-link"
            title="현재 좌표 궤도 공유"
            style={{
              margin: 0, padding: "8px 14px", fontSize: "12px",
              backdropFilter: "blur(8px)", background: "rgba(10,14,26,0.85)",
              cursor: "pointer", border: "1px solid rgba(167,139,250,0.3)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              maxWidth: "min(200px, 50vw)", flexShrink: 1,
            }}
          >
            {audio.currentArtistId
              ? (graphData?.nodes[audio.currentArtistId]?.nameKo || graphData?.nodes[audio.currentArtistId]?.name || "")
              : focusedArtistName}
            {getJosa(
              audio.currentArtistId
                ? (graphData?.nodes[audio.currentArtistId]?.nameKo || graphData?.nodes[audio.currentArtistId]?.name || "")
                : focusedArtistName,
              "로부터",
              "으로부터"
            )}{" "}
            <span style={{ marginLeft: 4 }}>🔗</span>
          </button>
        ) : null}
        {/* 유저 아바타 (로그인/드롭다운) — 항상 표시 */}
        <UserAvatar position="relative" />
      </div>

      {/* Phase 7: 자율주행 패널 */}
      <AutoWarpPanel
        isWarping={warp.isWarping}
        flightLog={warp.flightLog}
        currentStep={warp.currentStep}
        focusedId={focusedId}
        focusedName={focusedArtistName}
        isLoggedIn={!!session?.user}
        onStart={warp.start}
        onStop={() => {
          // Flight Log 저장 (비행 기록이 2정거장 이상일 때만)
          if (warp.flightLog.length >= 2) {
            const fl = warp.flightLog;
            const totalSec = Math.round((fl[fl.length - 1].timestamp - fl[0].timestamp) / 1000);
            fetch("/api/universe/flight-log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                startArtist: fl[0].nodeId,
                path: fl.map(s => ({ nodeId: s.nodeId, name: s.name })),
                totalStops: fl.length,
                totalSeconds: totalSec,
              }),
            }).catch(() => {}); // 실패해도 무시
          }
          warp.stop();
        }}
      />


      {/* 탐험 발자국 (Breadcrumbs) */}
      {breadcrumbs.length > 1 && (
        <div className="breadcrumbs-bar">
          {breadcrumbs.map((bc, i) => (
            <>
              {i > 0 && <span key={`arrow-${i}`} className="bc-arrow">›</span>}
              <button
                key={bc.id}
                className={`bc-crumb${i === breadcrumbs.length - 1 ? " active" : ""}`}
                onClick={() => handleArtistSelect(bc.id)}
              >
                {bc.name}
              </button>
            </>
          ))}
        </div>
      )}

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

      {/* V7.7 Phase 3-1: 여정 진행 바 */}
      {/* V7.7: 여정 진행 바 + 공유 버튼 통합 */}
      {journeyShareUrl && (
        <div style={{
          position: "fixed", top: 56, left: "50%",
          transform: "translateX(-50%)",
          zIndex: 200,
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 14px",
          background: "rgba(10,14,26,0.88)",
          border: "1px solid rgba(167,139,250,0.35)",
          borderRadius: 20,
          backdropFilter: "blur(12px)",
          fontSize: 12, color: "rgba(200,180,255,0.9)",
          whiteSpace: "nowrap",
          pointerEvents: "auto",
          maxWidth: "calc(100vw - 32px)",
        }}>
          {journey.isPlaying && journey.steps.length > 0 ? (
            <>
              <span style={{ color: "#a78bfa" }}>🚀</span>
              <span>{journey.steps[journey.currentStep]?.name || ""}</span>
              <span style={{ opacity: 0.5 }}>→</span>
              <span>{journey.steps[journey.steps.length - 1]?.name || ""}</span>
              <span style={{
                fontSize: 10, opacity: 0.6,
                background: "rgba(167,139,250,0.15)",
                padding: "2px 7px", borderRadius: 10,
              }}>
                {journey.currentStep + 1} / {journey.steps.length}
              </span>
            </>
          ) : (
            <span style={{ color: "rgba(200,180,255,0.6)" }}>🚀 여정 완료</span>
          )}
          {/* 공유 버튼 — 진행 바 안에 통합 */}
          <button
            onClick={handleJourneyShare}
            style={{
              background: "rgba(167,139,250,0.15)",
              border: "1px solid rgba(167,139,250,0.3)",
              borderRadius: 14, padding: "3px 10px",
              color: "#c8b4ff", fontSize: 11, fontWeight: 600,
              cursor: "pointer", whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
          >
            공유 🔗
          </button>
        </div>
      )}

      {/* V7.7 Phase 3-1: 도착 토스트 */}
      {arrivedToast && (
        <div style={{
          position: "fixed", top: "40%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 300,
          padding: "14px 24px",
          background: "rgba(10,14,26,0.95)",
          border: "1px solid rgba(167,139,250,0.5)",
          borderRadius: 24,
          color: "#e8eaed",
          fontSize: 16, fontWeight: 600,
          backdropFilter: "blur(16px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 40px rgba(167,139,250,0.15)",
          animation: "toastIn 0.3s ease",
          pointerEvents: "none",
          textAlign: "center",
          lineHeight: 1.5,
        }}>
          {arrivedToast}
        </div>
      )}

      {/* 🌌 Canvas 우주 (절대 언마운트 안 됨) */}
      <div style={{ position: "absolute", inset: 0 }}>
        {graphData && (
          <Suspense fallback={null}>
            <GraphCosmos
              graphData={graphData}
              onArtistSelect={handleArtistSelect}
              focusedId={focusedId}
              dualPathTarget={dualPathTarget}
              onBackgroundClick={() => {
                // 아티스트 디셀렉트: 모든 포커스 상태 초기화
                setFocusedId(null);
                currentFocusedIdRef.current = null;
                setFocusedArtistName("");
                setHop1List([]);
                setSheetState("collapsed");
                setDualPathTarget(null);
                warp.stop(); // 자율주행 정지
                // 오디오 정지
                audio.stop();
                // URL에서 artist 파라미터 제거
                const url = new URL(window.location.href);
                url.searchParams.delete("artist");
                window.history.replaceState({}, "", url.toString());
              }}
              sheetState={sheetState}
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
            artistName={
              audio.currentArtistId
                ? (graphData?.nodes[audio.currentArtistId]?.nameKo || graphData?.nodes[audio.currentArtistId]?.name)
                : null
            }
            progress={audio.progress}
            onStop={audio.stop}
            onTogglePause={audio.togglePause}
            sheetState={sheetState}
            onExpand={() => setSheetState("expanded")}
          />

          {/* 1촌 워프 포탈 목록 */}
          {sheetState === "expanded" && focusedId && (
            <>
              {hop1List.length === 0 ? (

                <div style={{ padding: "20px 16px", color: "rgba(200,180,255,0.4)", fontSize: 13, textAlign: "center" }}>
                  연결된 아티스트가 없습니다
                </div>
              ) : (
                <ul
                  className="warp-list"
                  ref={warpListRef}
                  onMouseDown={(e: React.MouseEvent) => {
                    isDraggingCard.current = true;
                    hasDragged.current = false;
                    if (warpListRef.current) {
                      startX.current = e.pageX - warpListRef.current.offsetLeft;
                      scrollLeft.current = warpListRef.current.scrollLeft;
                      warpListRef.current.style.scrollSnapType = 'none'; // 드래그 부드럽게
                    }
                  }}
                  onMouseLeave={() => {
                    isDraggingCard.current = false;
                    if (warpListRef.current) warpListRef.current.style.scrollSnapType = 'x mandatory';
                  }}
                  onMouseUp={() => {
                    isDraggingCard.current = false;
                    if (warpListRef.current) warpListRef.current.style.scrollSnapType = 'x mandatory';
                  }}
                  onMouseMove={(e: React.MouseEvent) => {
                    if (!isDraggingCard.current) return;
                    e.preventDefault();
                    if (warpListRef.current) {
                      const x = e.pageX - warpListRef.current.offsetLeft;
                      const walk = (x - startX.current) * 1.5;
                      if (Math.abs(walk) > 5) hasDragged.current = true;
                      warpListRef.current.scrollLeft = scrollLeft.current - walk;
                    }
                  }}
                >
                  {hop1List.map((item) => (
                    <li
                      key={item.id}
                      className="warp-item"
                      data-id={item.id}
                      data-url={item.previewUrl || ""}
                      data-track={item.previewTrackName || item.nameKo || item.name}
                      role="group"
                    >
                      {/* 클릭 가능한 상단 카드 영역 (원초적 모바일 터치 오작동 방어를 위해 투명 button화) */}
                      <button
                        type="button"
                        className="warp-card-content"
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", flex: 1, cursor: "pointer", background: "transparent", border: "none", padding: 0 }}
                        onClick={(e) => {
                          if (hasDragged.current) {
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                          }
                          handleHopItemTap(item.id);
                        }}
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
                               item.relation === "SHARED_WRITER"   ? "공유 작가" :
                               item.relation === "SHARED_PRODUCER" ? "공유 작가" :
                               item.relation === "INDIRECT"   ? "딥스캔 교류" :
                               item.relation === "GENRE_OVERLAP"? "장르/테마" : "관련"}
                            </span>
                            {item.label && <span className="relation-desc">{item.label}</span>}
                          </div>
                        </div>
                      </button>

                      {/* 재생 버튼 (Play) - 카드 하단 강조 */}
                      {item.previewUrl ? (
                        <button
                          type="button"
                          className={`warp-play${audio.currentArtistId === item.id && audio.isPlaying ? " playing" : ""}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // V7.7: 수동 클릭 시 연속 재생 큐 비활성화 (사용자 의도 우선)
                            playQueue.disableQueue();
                            if (audio.currentArtistId === item.id) {
                              audio.togglePause();
                            } else {
                              audio.play(
                                item.previewUrl!,
                                item.previewTrackName || item.nameKo || item.name,
                                item.id
                              );
                            }
                          }}
                          aria-label={`${item.nameKo} 미리듣기`}
                        >
                          {audio.currentArtistId === item.id && audio.isPlaying ? (
                            <><span>⏸</span> 일시정지</>
                          ) : audio.currentArtistId === item.id && !audio.isPlaying && audio.currentTrackName ? (
                            <><span>▶</span> 이어서 듣기</>
                          ) : (
                            <><span>▶</span> 미리듣기</>
                          )}
                        </button>
                      ) : (
                        <div style={{ width: '100%', height: 32, marginTop: 'auto' }} /> /* 공간 유지용 */
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      </BottomSheet>

      {/* Phase 4: 에디트 제안 모달 */}
      <EditSuggestModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        artistName={focusedArtistName || undefined}
      />
    </>

  );
}
