/**
 * K-Culture Universe — 홈 화면
 *
 * 서버 컴포넌트: 외부 API 호출 0회, 즉시 렌더링
 * - pickHubArtist()로 시간대 기반 허브 1명 선택
 * - fs.readFileSync로 pre-baked JSON 즉시 로드
 * - CosmosClient에 전체 데이터 넘겨서 즉시 우주 진입
 */

import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { pickHubArtist, HUB_ARTISTS } from "@/data/hub-artists";
import type { CosmosData } from "@/lib/types";
import { buildDeepSpaceNodes } from "@/lib/deep-space";
import CosmosClient from "@/components/CosmosClient";
import FloatingSearch from "@/components/FloatingSearch";

export const dynamic = "force-dynamic"; // 매 요청마다 시간 기반 허브 선택

export const metadata: Metadata = {
  title: "K-Culture Universe — 음악 우주를 탐험하세요",
  description: "K-culture 아티스트들의 관계망을 별자리처럼 탐험하는 인터랙티브 음악 지도.",
  openGraph: {
    title: "K-Culture Universe",
    description: "K-culture 아티스트들의 관계망을 별자리처럼 탐험하세요.",
  },
};

export default function HomePage() {
  // 1. 홈 첫 화면 아티스트: 사용자 지정 5명 중 시간 기반 선택
  //    (JSON 데이터가 확실한 아티스트들로 제한)
  const FEATURED_IDS = [
    "3Nrfpe0tUJi4K4DXYWgMUX",  // BTS
    "41MozSoPIsD1dJM0CLPjZF",  // BLACKPINK
    "6WeDO4GynFmK4OxwkBzMW8",  // 검정치마
    "5rHUhS9Ya0S63WI9LFmCSx",  // 백아
    "5wVJpXzuKV6Xj7Yhsf2uYx",  // 한로로
  ];
  const hour = new Date().getHours();
  const featuredIdx = hour % FEATURED_IDS.length;
  const hub = HUB_ARTISTS.find(h => h.spotifyId === FEATURED_IDS[featuredIdx])
    ?? pickHubArtist();

  // 2. Pre-baked JSON 즉시 로드 (API 호출 0회)
  let cosmosData: CosmosData | null = null;
  try {
    const filePath = path.join(process.cwd(), "public", "data", "hub", `${hub.spotifyId}.json`);
    const raw = fs.readFileSync(filePath, "utf-8");
    cosmosData = JSON.parse(raw) as CosmosData;
    // JSON의 core 데이터가 다른 아티스트(예: 선우정아)로 오염되었을 수 있으므로
    // hub-artists.ts의 공식 데이터를 강제로 덮어씌움
    cosmosData.core.name = hub.nameKo;
    
    // 만약 JSON의 이름이 원래 허브의 영문/한글 이름이 아닌 완전히 다른 이름(ex: 선우정아)인 경우,
    // imageUrl과 previewUrl도 오염된 것이므로 null로 초기화하여 폴백 UI(이니셜)를 띄우게 함.
    // (선우정아 ID: 00iP5z19F6kM7L3gMhF4oD)
    if (raw.includes('"name": "선우정아"') && hub.nameKo !== "선우정아") {
      cosmosData.core.imageUrl = null;
      cosmosData.core.previewUrl = null;
      cosmosData.core.previewTrackName = null;
    }
  } catch {
    // JSON 없으면 최소한의 코어 데이터로 fallback
    cosmosData = {
      core: {
        spotifyId: hub.spotifyId,
        name: hub.nameKo,
        imageUrl: null,
        genres: [],
        popularity: 0,
        previewUrl: null,
        previewTrackName: null,
        spotifyUrl: `https://open.spotify.com/artist/${hub.spotifyId}`,
      },
      satellites: [],
    };
  }

  // 3. 심우주 노드 생성 (현재 코어 제외한 나머지 허브 아티스트들)
  const deepSpaceNodes = buildDeepSpaceNodes(hub.spotifyId);

  return (
    <>
      {/* 허브 아티스트의 고유 컬러 CSS 변수 주입 */}
      <style>{`
        :root {
          --accent-core: ${hub.accent};
          --accent-glow: ${hub.accent}66;
          --bg-nebula: ${hub.nebula};
          --bg-nebula-2: ${hub.nebula2};
        }
      `}</style>

      {/* 검색 플로팅 버튼 (우상단) */}
      <FloatingSearch />

      {/* 즉시 우주 진입 — API 0회, 애니메이션 즉시 시작 */}
      <CosmosClient
        artistId={hub.spotifyId}
        core={cosmosData.core}
        initialSatellites={cosmosData.satellites}
        hubColor={hub.accent}
        introName={hub.nameKo}
        deepSpaceNodes={deepSpaceNodes}
      />
    </>
  );
}
