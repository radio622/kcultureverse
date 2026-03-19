/**
 * K-Culture Universe — 허브 아티스트 마스터 목록
 *
 * 선정 기준:
 *  1) K-Culture 관계망에서 협업/피처링이 많아 "인맥왕"인 아티스트
 *  2) MusicBrainz·Genius DB에 데이터가 비교적 풍부한 아티스트
 *  3) 장르·세대·성별 다양성 (아이돌, 인디, 힙합, 솔로 등)
 *
 * accent  : CSS --accent-core 오버라이드 (노드 Glow 컬러)
 * nebula  : CSS --bg-nebula 오버라이드 (성운 배경 컬러)
 * nebula2 : CSS --bg-nebula-2 오버라이드 (성운 보조 컬러)
 */

export interface HubArtist {
  spotifyId: string;
  name: string;
  nameKo: string;
  accent: string;
  nebula: string;
  nebula2: string;
}

export const HUB_ARTISTS: HubArtist[] = [
  {
    spotifyId: "3Nrfpe0tUJi4K4DXYWgMUX",
    name: "BTS",
    nameKo: "BTS",
    accent: "#c084fc",   // 보라
    nebula: "#1a0a2e",
    nebula2: "#130820",
  },
  {
    spotifyId: "41MozSoPIsD1dJM0CLPjZF",
    name: "BLACKPINK",
    nameKo: "블랙핑크",
    accent: "#fb7185",   // 핑크
    nebula: "#2a0a14",
    nebula2: "#1a060e",
  },
  {
    spotifyId: "3HqSLMAZ3g3d5poNaI7GOU",
    name: "IU",
    nameKo: "아이유",
    accent: "#67e8f9",   // 하늘
    nebula: "#041a20",
    nebula2: "#021014",
  },
  {
    spotifyId: "2Ek1q2haOnxVqhvVKqMvJe",
    name: "Zico",
    nameKo: "지코",
    accent: "#fbbf24",   // 금빛
    nebula: "#1a1400",
    nebula2: "#120e00",
  },
  {
    spotifyId: "3yY2jUvSFTDMzPDqBOkO0E",
    name: "Jay Park",
    nameKo: "박재범",
    accent: "#34d399",   // 민트
    nebula: "#041a10",
    nebula2: "#021008",
  },
  {
    spotifyId: "2w9zwq3AkvD4mVLDyo3i1L",
    name: "Epik High",
    nameKo: "에픽하이",
    accent: "#60a5fa",   // 파랑
    nebula: "#041428",
    nebula2: "#020c1a",
  },
  {
    spotifyId: "0Kv3muNFnLPfFSnJlKZGsS",  // 혁오(Hyukoh) 정확한 ID
    name: "Hyukoh",
    nameKo: "혁오",
    accent: "#f97316",   // 주황
    nebula: "#1a0c04",
    nebula2: "#120802",
  },
  {
    spotifyId: "6liAMWkB0u95sm91IkwMpK",
    name: "Heize",
    nameKo: "헤이즈",
    accent: "#a78bfa",   // 라벤더
    nebula: "#10062e",
    nebula2: "#0a0420",
  },
  {
    spotifyId: "28ot3wh4oNmoFOdVajibBl",
    name: "NMIXX",
    nameKo: "엔믹스",
    accent: "#e879f9",   // 마젠타
    nebula: "#200a28",
    nebula2: "#140618",
  },
  {
    spotifyId: "0L8ExT028jH3ddEcZwqJJ5", // Stray Kids
    name: "Stray Kids",
    nameKo: "스트레이 키즈",
    accent: "#f43f5e",   // 레드
    nebula: "#20040a",
    nebula2: "#140206",
  },
  {
    spotifyId: "2AfmfGFbe0XWe6oFCAxnME", // (G)I-DLE
    name: "(G)I-DLE",
    nameKo: "(여자)아이들",
    accent: "#facc15",   // 옐로우
    nebula: "#1a1600",
    nebula2: "#100e00",
  },
  {
    spotifyId: "0NdObd21P2DSFo0iLGmYqZ", // NewJeans (정확한 ID 재확인 필요)
    name: "NewJeans",
    nameKo: "뉴진스",
    accent: "#86efac",   // 연두
    nebula: "#041a0c",
    nebula2: "#021008",
  },
  {
    spotifyId: "6WeDO4GynFmK4OxwkBzMW8",  // 검정치마(The Black Skirts) 정확한 ID
    name: "The Black Skirts",
    nameKo: "검정치마",
    accent: "#94a3b8",   // 슬레이트
    nebula: "#0a0c10",
    nebula2: "#060808",
  },
  {
    spotifyId: "6HaGTQPmzraZdZR615C3bq", // BIBI
    name: "BIBI",
    nameKo: "비비",
    accent: "#c026d3",   // 퍼플
    nebula: "#1a0420",
    nebula2: "#0e0214",
  },
  {
    spotifyId: "3tVQdUvClmAT7URs9V3rsp", // pH-1
    name: "pH-1",
    nameKo: "pH-1",
    accent: "#2dd4bf",   // 틸
    nebula: "#041814",
    nebula2: "#020e0c",
  },
];

/**
 * 시간대 기반으로 허브 아티스트 후보 풀을 좁히고, 그 중 하나를 반환.
 * - 하루 동안 여러 번 들어오면 시간대마다 다른 분위기
 * - 같은 시간대에서도 약간의 랜덤성 유지
 * - 완전 랜덤보다 "이 시간엔 이런 분위기" 라는 장소감을 줌
 */
export function pickHubArtist(hourOverride?: number): HubArtist {
  const hour = hourOverride ?? new Date().getHours();

  // 시간대별로 3~5명씩 다른 풀을 배정
  // 인덱스는 HUB_ARTISTS 배열 순서에 맞음
  const poolByHour: number[][] = [
    [0, 1, 2],        // 0~3시  : BTS, BLACKPINK, 아이유 (대형 아이돌)
    [0, 1, 2],
    [0, 1, 2],
    [0, 1, 2],
    [3, 4, 5],        // 4~7시  : 지코, 박재범, 에픽하이 (힙합)
    [3, 4, 5],
    [3, 4, 5],
    [3, 4, 5],
    [6, 7, 12],       // 8~11시 : 혁오, 헤이즈, 검정치마 (인디)
    [6, 7, 12],
    [6, 7, 12],
    [6, 7, 12],
    [8, 9, 10],       // 12~15시: NMIXX, 스키즈, 아이들 (4세대)
    [8, 9, 10],
    [8, 9, 10],
    [8, 9, 10],
    [11, 13, 14],     // 16~19시: 뉴진스, 비비, pH-1 (뉴웨이브)
    [11, 13, 14],
    [11, 13, 14],
    [11, 13, 14],
    [0, 3, 6, 11],    // 20~23시: 혼합 (하이라이트 타임)
    [1, 4, 7, 13],
    [2, 5, 8, 14],
    [0, 6, 9, 12],
  ];

  const pool = poolByHour[hour] ?? [0];
  const idx = pool[Math.floor(Math.random() * pool.length)];
  return HUB_ARTISTS[idx];
}
