"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { CosmosArtist, CosmosData, SatelliteNode, DeepSpaceNode } from "@/lib/types";
import Cosmos from "./Cosmos";
import BottomSheet, { type SheetState } from "./BottomSheet";
import ResonanceDeck from "./ResonanceDeck";
import MiniPlayer from "./MiniPlayer";
import { useAudio } from "@/hooks/useAudio";

interface Props {
  artistId: string;
  core: CosmosArtist;
  initialSatellites?: SatelliteNode[];
  hubColor?: string;
  introName?: string;
  /** 심우주 노드 (다른 허브 아티스트 배경) */
  deepSpaceNodes?: DeepSpaceNode[];
}

export default function CosmosClient({
  artistId,
  core,
  initialSatellites,
  hubColor,
  introName,
  deepSpaceNodes = [],
}: Props) {
  const router = useRouter();
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  // ── 3단계 바텀시트 상태 ─────────────────────────────────────
  const [sheetState, setSheetState] = useState<SheetState>("collapsed");
  const [copied, setCopied]         = useState(false);
  const [introVisible, setIntroVisible] = useState(!!introName);
  // ── 워프(다이브) 페이드아웃 ─────────────────────────────────
  const [isWarping, setIsWarping] = useState(false);
  const [diveTargetId, setDiveTargetId] = useState<string | null>(null);

  // ── 스와이프 디바운스 타이머 ────────────────────────────────
  const swipeTimeoutRef = useRef<number | null>(null);

  // ── 위성 데이터 ─────────────────────────────────────────────
  const [satellites, setSatellites] = useState<SatelliteNode[]>(initialSatellites ?? []);
  const [satelliteLoading, setSatelliteLoading] = useState(!initialSatellites);

  const audio = useAudio();
  const data: CosmosData = { core, satellites };

  // ── 인트로 타이머 ───────────────────────────────────────────
  useEffect(() => {
    if (!introName) return;
    const t = setTimeout(() => setIntroVisible(false), 1800);
    return () => clearTimeout(t);
  }, [introName]);
  void introVisible; // ESLint suppress (향후 사용 예정)

  // ── 위성 데이터 로드 (pre-baked 없을 때만) ─────────────────
  useEffect(() => {
    if (initialSatellites) return;
    let cancelled = false;

    async function loadSatellites() {
      try {
        setSatelliteLoading(true);
        const res = await fetch(`/api/cosmos/${artistId}`, {
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const cosmosData: CosmosData = await res.json();
        if (!cancelled) setSatellites(cosmosData.satellites ?? []);
      } catch (err) {
        console.error("[CosmosClient] 위성 로드 실패:", err);
      } finally {
        if (!cancelled) setSatelliteLoading(false);
      }
    }

    loadSatellites();
    return () => { cancelled = true; };
  }, [artistId, initialSatellites]);

  // ── 우주 push-up (바텀시트가 올라올 때 덜 밀려올라가게 축소) ────
  const cosmosShift = sheetState === "expanded" ? -50 : sheetState === "peek" ? -36 : 0;

   // ── 포커스 핸들러 ────────────────────────────────────
  // 카드 스크롤 시 0.4초 머무르면 자동 음악 재생 (Debounce)
  const handleSatelliteFocus = useCallback((index: number) => {
    setFocusedIndex(index);
    if (swipeTimeoutRef.current) window.clearTimeout(swipeTimeoutRef.current);

    const satellite = data.satellites[index];
    if (!satellite) return;

    // ✨ 즉각 아티스트 이름 표시 (fetch 대기 전에 MiniPlayer에 바로 반영)
    audio.announce(satellite.name, satellite.spotifyId);

    swipeTimeoutRef.current = window.setTimeout(() => {
      if (satellite.previewUrl) {
        audio.play(satellite.previewUrl, satellite.previewTrackName || satellite.name, satellite.spotifyId);
      } else {
        fetch(`/api/spotify/preview?name=${encodeURIComponent(satellite.name)}`)
          .then(r => r.json())
          .then(p => {
            if (p.previewUrl) audio.play(p.previewUrl, p.trackName || satellite.name, satellite.spotifyId);
            // previewUrl 없으면 이름은 이미 announce로 표시됨 — 음악만 못 나오는 상태 유지
          });
      }
    }, 250);
  }, [data, audio]);

  const handleFocus = useCallback(
    (index: number | null) => {
      setFocusedIndex(index);

      // ── 코어 클릭 ──────────────────────────────────────
      if (index === null) {
        if (data.core.previewUrl) {
          audio.play(data.core.previewUrl, data.core.previewTrackName || data.core.name, data.core.spotifyId);
        } else {
          fetch(`/api/spotify/preview?name=${encodeURIComponent(data.core.name)}`)
            .then(r => r.json())
            .then(p => {
              if (p.previewUrl) {
                audio.play(p.previewUrl, p.trackName || data.core.name, data.core.spotifyId);
              }
            });
        }
        if (focusedIndex === null) {
          setSheetState(prev => prev === "expanded" ? "collapsed" : "expanded");
        } else {
          setSheetState("expanded");
        }
        return;
      }

      // ── 위성 클릭 (코스모스 노드 클릭시에만 음악 재생) ─────────
      const satellite = data.satellites[index];
      if (!satellite) return;

      if (satellite.previewUrl) {
        audio.play(satellite.previewUrl, satellite.previewTrackName || satellite.name, satellite.spotifyId);
      } else {
        // previewUrl 없으면 서버에서 조회 시도
        fetch(`/api/spotify/preview?name=${encodeURIComponent(satellite.name)}`)
          .then(r => r.json())
          .then(p => {
            if (p.previewUrl) audio.play(p.previewUrl, p.trackName || satellite.name, satellite.spotifyId);
          });
      }

      // 2) 바텀시트를 peek → expanded로 (위성클릭: 연관 아티스트 카드 표시)
      setSheetState("expanded");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, audio]
  );

  // ── 위성 카드 탭 (데크에서 카드 클릭시) — 카메라 워프 발동 ──
  const handleCardTap = useCallback((index: number) => {
    const satellite = data.satellites[index];
    if (!satellite) return;
    // 카드 자체를 클릭하면 카메라가 그 위성으로 날아가는 "워프 다이브" 발동!
    setDiveTargetId(satellite.spotifyId);
  }, [data]);

  const handleDive = useCallback((spotifyId: string) => {
    // 버튼("이 아티스트의 우주로") 클릭도 동일하게 워프 카메라 연출 발동
    setDiveTargetId(spotifyId);
  }, []);

  // ── 카메라가 목표 위성에 도달했을 때 불리는 최종 다이브(페이드) ──
  const finishDive = useCallback((spotifyId: string) => {
    setIsWarping(true);
    audio.stop();
    setTimeout(() => {
      router.push(`/from/${spotifyId}`);
    }, 450); // CSS transition과 동기화
  }, [router, audio]);

  const handleShare = useCallback(async () => {
    // 포커스된 위성이 있으면 위성 타겟, 없으면 코어 타겟
    const isSatelliteTarget = focusedIndex !== null && data.satellites[focusedIndex];
    const targetId = isSatelliteTarget ? data.satellites[focusedIndex].spotifyId : core.spotifyId;
    const targetName = isSatelliteTarget ? data.satellites[focusedIndex].name : core.name;
    
    // 타겟 아티스트의 K-Culture Universe 다이브 주소를 생성
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/from/${targetId}`;
    const title = `${targetName}로부터`;

    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* 취소 */ }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [core.name]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100svh",
        overflow: "hidden",
        background: "var(--bg-cosmos)",
      }}
    >
      {/* ── 인트로 오버레이 ──────────────────────────── */}
      {introName && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 80,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            animation: "introFadeOut 1.8s ease-out forwards",
          }}
        >
          <p style={{
            fontSize: 11,
            letterSpacing: "0.25em",
            color: hubColor ?? "var(--accent-core)",
            textTransform: "uppercase",
            marginBottom: 12,
            opacity: 0.8,
          }}>
            오늘의 우주
          </p>
          <h2 style={{
            fontSize: "clamp(22px, 6vw, 40px)",
            fontWeight: 700,
            color: "#fff",
            textShadow: `0 0 40px ${hubColor ?? "var(--accent-core)"}`,
            textAlign: "center",
            lineHeight: 1.2,
            margin: 0,
          }}>
            {introName}의 세계
          </h2>
        </div>
      )}

      {/* ── 워프 페이드아웃 오버레이 ─────────────────────── */}
      {isWarping && (
        <div style={{
          position: "absolute",
          inset: 0,
          zIndex: 90,
          background: "var(--bg-cosmos)",
          opacity: 1,
          animation: "warpFadeIn 0.45s ease-out forwards",
          pointerEvents: "all",
        }} />
      )}

      {/* ── Cosmos (우주 시각화) ── 카메라 팬을 이용한 워프 ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateY(${cosmosShift}px)`,
          transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <Cosmos
          data={data}
          focusedIndex={focusedIndex}
          onCoreTap={() => handleFocus(null)}
          onSatelliteTap={handleFocus}
          deepSpaceNodes={deepSpaceNodes}
          onDeepSpaceTap={finishDive}
          activeDiveTargetId={diveTargetId}
        />
      </div>

      {/* ── 공유 버튼 ────────────────────────────────── */}
      <button
        onClick={handleShare}
        aria-label="공유 링크 복사"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          background: copied ? "rgba(34,197,94,0.2)" : "rgba(167,139,250,0.12)",
          border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(167,139,250,0.25)"}`,
          borderRadius: 20,
          cursor: "pointer",
          transition: "all 0.3s ease",
          backdropFilter: "blur(8px)",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={copied ? "#22c55e" : "#a78bfa"} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        >
          {copied ? (
            <polyline points="20 6 9 17 4 12" />
          ) : (
            <>
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </>
          )}
        </svg>
        <span className="share-btn-text" style={{ fontSize: 12, fontWeight: 500, color: copied ? "#22c55e" : "#a78bfa", whiteSpace: "nowrap" }}>
          {copied ? "복사됨!" : `${focusedIndex !== null && data.satellites[focusedIndex] ? data.satellites[focusedIndex].name : core.name}로부터`}
        </span>
      </button>

      {/* ── 위성 로딩 인디케이터 ─────────────────────── */}
      {satelliteLoading && !initialSatellites && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            background: "rgba(10,14,26,0.85)",
            border: "1px solid rgba(167,139,250,0.2)",
            borderRadius: 20,
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "var(--accent-core)",
            animation: "pulse 1.5s ease-in-out infinite",
          }} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>관계망 분석 중...</span>
        </div>
      )}

      {/* ── Bottom Sheet (3단계) ─────────────────────── */}
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
            satellites={data.satellites}
            focusedIndex={focusedIndex}
            onSnap={handleSatelliteFocus}
            onCardTap={handleCardTap}
            onDive={handleDive}
            isVisible={sheetState === "expanded"}
          />
        </>
      </BottomSheet>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes introFadeOut {
          0%   { opacity: 1; }
          70%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes warpFadeIn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
