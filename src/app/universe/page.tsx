/**
 * 🌌 K-Culture Universe V5 — 단일 캔버스 우주 페이지
 *
 * 핵심 특징:
 *   - 블랙아웃 없음: GraphCosmos(Canvas)는 한 번만 마운트, 절대 언마운트 안 됨
 *   - 노드 클릭 → 카메라 Fly-To + 바텀시트 데이터만 갱신 (API 호출)
 *   - URL 변경은 history.pushState (페이지 리로드 없음)
 *   - 그래프 데이터는 universe-graph-v5.json 정적 파일 서빙
 */

"use client";

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
import ResonanceDeck from "@/components/ResonanceDeck";
import FloatingSearch from "@/components/FloatingSearch";
import { useAudio } from "@/hooks/useAudio";
import type { CosmosData, SatelliteNode } from "@/lib/types";
import type { UniverseGraphV5 } from "@/lib/graph-v5";

// GraphCosmos는 SSR 불가 (Canvas/window 의존) → dynamic import
const GraphCosmos = dynamic(
  () => import("@/components/GraphCosmos"),
  {
    ssr: false,
    loading: () => (
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-cosmos)",
        color: "rgba(200,180,255,0.6)",
        fontSize: 14,
        gap: 10,
      }}>
        <span style={{ animation: "pulse 1.5s ease-in-out infinite" }}>✦</span>
        우주를 펼치는 중...
      </div>
    ),
  }
);

export default function UniversePage() {
  const audio = useAudio();
  const [sheetState, setSheetState] = useState<SheetState>("collapsed");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [satellites, setSatellites] = useState<SatelliteNode[]>([]);
  const [graphData, setGraphData] = useState<UniverseGraphV5 | null>(null);
  const [graphLoading, setGraphLoading] = useState(true);

  // 그래프 데이터 최초 1회 로드
  useEffect(() => {
    fetch("/data/universe-graph-v5.json")
      .then((r) => r.json())
      .then((data: UniverseGraphV5) => {
        setGraphData(data);
        setGraphLoading(false);
      })
      .catch(() => {
        console.warn("[UniversePage] universe-graph-v5.json 없음 — 빌드 스크립트를 먼저 실행하세요");
        setGraphLoading(false);
      });
  }, []);

  // 아티스트 선택 핸들러 (바텀시트 동적 교체, 블랙아웃 없음)
  const handleArtistSelect = useCallback(async (nodeId: string, skipHistory = false) => {
    setFocusedId(nodeId);
    setSheetState("peek");
    setFocusedIndex(null);

    // Next.js 라우터 간섭 방지 처리: URL 안 바꾸고 state만 push
    if (!skipHistory) {
      window.history.pushState({ artist: nodeId }, "", "");
    }

    try {
      const res = await fetch(`/api/universe/artist?id=${nodeId}`);
      if (!res.ok) return;
      const data: CosmosData = await res.json();
      setSatellites(data.satellites);
      // 첫 번째 위성 자동 포커스
      if (data.satellites.length > 0) {
        setFocusedIndex(0);
        audio.announce(data.satellites[0].spotifyId, data.satellites[0].name);
      }
    } catch {
      // 네트워크 실패 시 현재 상태 유지
    }
  }, [audio]);

  // 카드 덱 스와이프
  const handleSatelliteFocus = useCallback((index: number) => {
    setFocusedIndex(index);
    const sat = satellites[index];
    if (!sat) return;
    audio.announce(sat.spotifyId, sat.name);
    // 디바운스된 재생 (300ms 후)
    setTimeout(() => {
      if (sat.previewUrl) {
        audio.play(sat.spotifyId, sat.previewUrl, sat.name);
      }
    }, 300);
  }, [satellites, audio]);

  // 카드 탭 (두 번째 탭은 아티스트 탐색)
  const handleCardTap = useCallback((index: number) => {
    const sat = satellites[index];
    if (!sat) return;
    if (focusedIndex === index) {
      // 이미 포커스된 카드: 해당 아티스트 우주로 이동
      handleArtistSelect(sat.spotifyId);
    } else {
      setFocusedIndex(index);
      audio.announce(sat.spotifyId, sat.name);
    }
  }, [satellites, focusedIndex, handleArtistSelect, audio]);

  // 브라우저 뒤로가기/앞으로가기 시 무중단 카메라 이동
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const state = e.state as { artist?: string } | null;
      if (state?.artist) {
        handleArtistSelect(state.artist, true);
      } else {
        setSheetState("collapsed");
        setFocusedId(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [handleArtistSelect]);

  return (
    <>
      {/* 별 배경 스타일 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
      `}</style>

      {/* 검색 */}
      <FloatingSearch onSelect={handleArtistSelect} />

      {/* 그래프 상태 안내 */}
      {graphLoading && (
        <div style={{
          position: "fixed",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          color: "rgba(200,180,255,0.6)",
          fontSize: 12,
          pointerEvents: "none",
        }}>
          ✦ 우주 지도 로딩 중...
        </div>
      )}

      {/* 그래프 없음 안내 */}
      {!graphLoading && !graphData && (
        <div style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "rgba(200,180,255,0.7)",
          textAlign: "center",
          fontSize: 14,
          lineHeight: 2,
        }}>
          <p>🌌 우주 지도를 찾을 수 없습니다.</p>
          <p style={{ fontSize: 12, opacity: 0.6 }}>
            터미널에서 실행: <code>npm run build-universe-v5</code>
          </p>
        </div>
      )}

      {/* 🌌 핵심: Canvas 우주 (절대 언마운트 안 됨) */}
      {graphData && (
        <Suspense fallback={null}>
          <GraphCosmos
            graphData={graphData}
            onArtistSelect={handleArtistSelect}
            focusedId={focusedId}
          />
        </Suspense>
      )}

      {/* 바텀시트 (데이터만 교체, 재마운트 없음) */}
      <BottomSheet state={sheetState} onStateChange={setSheetState}>
        <>
          <MiniPlayer
            isPlaying={audio.isPlaying}
            trackName={audio.currentTrackName}
            progress={audio.progress}
            onStop={audio.stop}
            sheetState={sheetState}
            onExpand={() => setSheetState("expanded")}
          />
          <ResonanceDeck
            satellites={satellites}
            focusedIndex={focusedIndex}
            onSnap={handleSatelliteFocus}
            onCardTap={handleCardTap}
            onDive={handleArtistSelect}
            isVisible={sheetState === "expanded"}
          />
        </>
      </BottomSheet>
    </>
  );
}
