"use client";

import { useState, useCallback, useEffect } from "react";
import type { CosmosArtist, CosmosData, SatelliteNode } from "@/lib/types";
import Cosmos from "./Cosmos";
import BottomSheet from "./BottomSheet";
import ResonanceDeck from "./ResonanceDeck";
import MiniPlayer from "./MiniPlayer";
import { useAudio } from "@/hooks/useAudio";

interface Props {
  artistId: string;
  core: CosmosArtist;
}

export default function CosmosClient({ artistId, core }: Props) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [sheetState, setSheetState] = useState<"collapsed" | "expanded">("collapsed");
  const [copied, setCopied] = useState(false);

  // 위성 데이터는 별도 상태로 관리 (처음엔 빈 배열, 백그라운드 로드 후 채워짐)
  const [satellites, setSatellites] = useState<SatelliteNode[]>([]);
  const [satelliteLoading, setSatelliteLoading] = useState(true);

  const audio = useAudio();

  // 코어 데이터로 즉시 CosmosData 구성 (위성 없이 먼저 렌더링)
  const data: CosmosData = { core, satellites };

  // 마운트 후 백그라운드에서 위성 데이터 비동기 로드
  useEffect(() => {
    let cancelled = false;

    async function loadSatellites() {
      try {
        setSatelliteLoading(true);
        const res = await fetch(`/api/cosmos/${artistId}`, {
          signal: AbortSignal.timeout(30000), // 30초 타임아웃
        });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const cosmosData: CosmosData = await res.json();
        if (!cancelled) {
          setSatellites(cosmosData.satellites ?? []);
        }
      } catch (err) {
        console.error("[CosmosClient] 위성 로드 실패:", err);
        // 실패해도 화면은 이미 코어로 표시 중 → 사용자에게 영향 없음
      } finally {
        if (!cancelled) setSatelliteLoading(false);
      }
    }

    loadSatellites();
    return () => { cancelled = true; };
  }, [artistId]);

  const handleFocus = useCallback(
    (index: number | null) => {
      setFocusedIndex(index);

      if (index === null) {
        if (data.core.previewUrl) {
          audio.play(data.core.previewUrl, data.core.previewTrackName || data.core.name, data.core.spotifyId);
        } else {
          fetch(`/api/spotify/preview?name=${encodeURIComponent(data.core.name)}`)
            .then(res => res.json())
            .then(preview => {
              if (preview.previewUrl) audio.play(preview.previewUrl, preview.trackName || data.core.name, data.core.spotifyId);
            });
        }
        return;
      }

      const satellite = data.satellites[index];
      if (!satellite) return;

      setSheetState("expanded");

      if (satellite.previewUrl) {
        audio.play(satellite.previewUrl, satellite.previewTrackName || satellite.name, satellite.spotifyId);
      } else {
        fetch(`/api/spotify/preview?name=${encodeURIComponent(satellite.name)}`)
          .then(res => res.json())
          .then(preview => {
            if (preview.previewUrl) audio.play(preview.previewUrl, preview.trackName || satellite.name, satellite.spotifyId);
          });
      }
    },
    [data, audio]
  );

  const handleDive = useCallback((spotifyId: string) => {
    window.location.href = `/from/${spotifyId}`;
  }, []);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const title = `${core.name}로부터`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch { /* 취소 시 무시 */ }
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
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
      {/* 공유 버튼 */}
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
        <span style={{ fontSize: 12, fontWeight: 500, color: copied ? "#22c55e" : "#a78bfa", whiteSpace: "nowrap" }}>
          {copied ? "복사됨!" : `${core.name}로부터`}
        </span>
      </button>

      {/* 위성 로딩 인디케이터 */}
      {satelliteLoading && (
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
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            관계망 분석 중...
          </span>
        </div>
      )}

      {/* 우주 시각화 */}
      <Cosmos
        data={data}
        focusedIndex={focusedIndex}
        onCoreTap={() => handleFocus(null)}
        onSatelliteTap={handleFocus}
      />

      {/* Bottom Sheet */}
      <BottomSheet state={sheetState} onStateChange={setSheetState}>
        <>
          <MiniPlayer
            isPlaying={audio.isPlaying}
            trackName={audio.currentTrackName}
            progress={audio.progress}
            onStop={audio.stop}
          />
          <ResonanceDeck
            satellites={data.satellites}
            focusedIndex={focusedIndex}
            onSnap={handleFocus}
            onDive={handleDive}
            isVisible={sheetState === "expanded"}
          />
        </>
      </BottomSheet>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
