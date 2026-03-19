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
 *
 * Spotify ID 검증 방법: iTunes API로 교차 검증 완료
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
  // ── 대형 아이돌 / 글로벌 ───────────────────────────────────────
  {
    spotifyId: "3Nrfpe0tUJi4K4DXYWgMUX",
    name: "BTS",
    nameKo: "BTS",
    accent: "#c084fc",
    nebula: "#1a0a2e",
    nebula2: "#130820",
  },
  {
    spotifyId: "41MozSoPIsD1dJM0CLPjZF",
    name: "BLACKPINK",
    nameKo: "블랙핑크",
    accent: "#fb7185",
    nebula: "#2a0a14",
    nebula2: "#1a060e",
  },
  {
    spotifyId: "3HqSLMAZ3g3d5poNaI7GOU",
    name: "IU",
    nameKo: "아이유",
    accent: "#67e8f9",
    nebula: "#041a20",
    nebula2: "#021014",
  },
  // ── 힙합 / 크로스오버 ──────────────────────────────────────────
  {
    spotifyId: "2Ek1q2haOnxVqhvVKqMvJe",
    name: "Zico",
    nameKo: "지코",
    accent: "#fbbf24",
    nebula: "#1a1400",
    nebula2: "#120e00",
  },
  {
    spotifyId: "3yY2jUvSFTDMzPDqBOkO0E",
    name: "Jay Park",
    nameKo: "박재범",
    accent: "#34d399",
    nebula: "#041a10",
    nebula2: "#021008",
  },
  {
    spotifyId: "2w9zwq3AkvD4mVLDyo3i1L",
    name: "Epik High",
    nameKo: "에픽하이",
    accent: "#60a5fa",
    nebula: "#041428",
    nebula2: "#020c1a",
  },
  // ── K-인디 씬 ─────────────────────────────────────────────────
  {
    spotifyId: "0Kv3muNFnLPfFSnJlKZGsS",
    name: "Hyukoh",
    nameKo: "혁오",
    accent: "#f97316",
    nebula: "#1a0c04",
    nebula2: "#120802",
  },
  {
    spotifyId: "6liAMWkB0u95sm91IkwMpK",
    name: "Heize",
    nameKo: "헤이즈",
    accent: "#a78bfa",
    nebula: "#10062e",
    nebula2: "#0a0420",
  },
  {
    spotifyId: "6WeDO4GynFmK4OxwkBzMW8",
    name: "The Black Skirts",
    nameKo: "검정치마",
    accent: "#94a3b8",
    nebula: "#0a0c10",
    nebula2: "#060808",
  },
  // ── 4세대 아이돌 ──────────────────────────────────────────────
  {
    spotifyId: "28ot3wh4oNmoFOdVajibBl",
    name: "NMIXX",
    nameKo: "엔믹스",
    accent: "#e879f9",
    nebula: "#200a28",
    nebula2: "#140618",
  },
  {
    spotifyId: "0L8ExT028jH3ddEcZwqJJ5",
    name: "Stray Kids",
    nameKo: "스트레이 키즈",
    accent: "#f43f5e",
    nebula: "#20040a",
    nebula2: "#140206",
  },
  {
    spotifyId: "2AfmfGFbe0XWe6oFCAxnME",
    name: "(G)I-DLE",
    nameKo: "(여자)아이들",
    accent: "#facc15",
    nebula: "#1a1600",
    nebula2: "#100e00",
  },
  {
    spotifyId: "0NdObd21P2DSFo0iLGmYqZ",
    name: "NewJeans",
    nameKo: "뉴진스",
    accent: "#86efac",
    nebula: "#041a0c",
    nebula2: "#021008",
  },
  // ── 뉴웨이브 ──────────────────────────────────────────────────
  {
    spotifyId: "6HaGTQPmzraZdZR615C3bq",
    name: "BIBI",
    nameKo: "비비",
    accent: "#c026d3",
    nebula: "#1a0420",
    nebula2: "#0e0214",
  },
  {
    spotifyId: "3tVQdUvClmAT7URs9V3rsp",
    name: "pH-1",
    nameKo: "pH-1",
    accent: "#2dd4bf",
    nebula: "#041814",
    nebula2: "#020e0c",
  },
  // ── K-인디 레전드 & 뉴웨이브 (2026.03 추가) ───────────────────
  {
    spotifyId: "5rHUhS9Ya0S63WI9LFmCSx",
    name: "Baek A",
    nameKo: "백아",
    accent: "#f0abfc",
    nebula: "#1a0424",
    nebula2: "#100218",
  },
  {
    spotifyId: "6OSMGFNb20nNBw4a2vWxMT",
    name: "Autumn Vacation",
    nameKo: "가을방학",
    accent: "#fb923c",
    nebula: "#1a0e04",
    nebula2: "#100802",
  },
  {
    spotifyId: "1Juf4OqydiYBfBx4TtMtH9",
    name: "Unnieneibalgwan",
    nameKo: "언니네이발관",
    accent: "#a3e635",
    nebula: "#0e1a04",
    nebula2: "#080e02",
  },
  {
    spotifyId: "1BwU3fTprQmvrVc8Rl9SHw",
    name: "Lee Baksa",
    nameKo: "이박사",
    accent: "#fde68a",
    nebula: "#1a1804",
    nebula2: "#100e02",
  },
  {
    spotifyId: "5wVJpXzuKV6Xj7Yhsf2uYx",
    name: "Han Roro",
    nameKo: "한로로",
    accent: "#93c5fd",
    nebula: "#04101a",
    nebula2: "#020810",
  },
  {
    spotifyId: "3WbKkfwmDLgVwR9ExchFVC",
    name: "Nell",
    nameKo: "넬",
    accent: "#7dd3fc",
    nebula: "#04141a",
    nebula2: "#020c10",
  },
  {
    spotifyId: "2XFSeoCf8No50etmN8b4Sy",
    name: "Linus's Blanket",
    nameKo: "라이너스의 담요",
    accent: "#86efac",
    nebula: "#041a0e",
    nebula2: "#020e08",
  },
  {
    spotifyId: "00iP5z19F6kM7L3gMhF4oD",
    name: "Deli Spice",
    nameKo: "델리스파이스",
    accent: "#fca5a5",
    nebula: "#1a0804",
    nebula2: "#100402",
  },
  {
    spotifyId: "6a14ZNuq4LsSkVHQR0kWd9",
    name: "Through the Sloe",
    nameKo: "through the sloe",
    accent: "#c4b5fd",
    nebula: "#0e0424",
    nebula2: "#080218",
  },
  {
    spotifyId: "4O5NReb5AzwlP3dFQGeTuD",
    name: "Julia's Heart",
    nameKo: "줄리아하트",
    accent: "#f9a8d4",
    nebula: "#1a0414",
    nebula2: "#10020c",
  },
  {
    spotifyId: "1gq4XavqmZhqOzEkpFBz1j",
    name: "Broccoli You Too",
    nameKo: "브로콜리너마저",
    accent: "#bbf7d0",
    nebula: "#041a0c",
    nebula2: "#020e06",
  },
];

/**
 * 시간대 기반으로 허브 아티스트 후보 풀을 좁히고, 그 중 하나를 반환.
 * - 하루 동안 여러 번 들어오면 시간대마다 다른 분위기
 * - 같은 시간대에서도 약간의 랜덤성 유지
 */
export function pickHubArtist(hourOverride?: number): HubArtist {
  const hour = hourOverride ?? new Date().getHours();
  const n = HUB_ARTISTS.length;

  // 시간대별로 5~7명씩 다른 풀을 배정 (인덱스 기반)
  const poolByHour: number[][] = [
    [0, 19, 20, 22, 24],          // 0~3시  : 아이유, 한로로, 넬, 델리스파이스, 줄리아하트
    [0, 19, 20, 22, 24],
    [0, 19, 20, 22, 24],
    [0, 19, 20, 22, 24],
    [3, 4, 5, 17, 21],            // 4~7시  : 지코, 박재범, 에픽하이, 가을방학, 라이너스
    [3, 4, 5, 17, 21],
    [3, 4, 5, 17, 21],
    [3, 4, 5, 17, 21],
    [6, 7, 8, 16, 23, 25],        // 8~11시 : 혁오, 헤이즈, 검정치마, 백아, 슬로, 브로콜리
    [6, 7, 8, 16, 23, 25],
    [6, 7, 8, 16, 23, 25],
    [6, 7, 8, 16, 23, 25],
    [9, 10, 11, 12, 18],          // 12~15시: NMIXX, 스키즈, 아이들, 뉴진스, 이박사
    [9, 10, 11, 12, 18],
    [9, 10, 11, 12, 18],
    [9, 10, 11, 12, 18],
    [13, 14, 15, 24, 25],         // 16~19시: 비비, pH-1, 언니네이발관, 줄리아하트, 브로콜리
    [13, 14, 15, 24, 25],
    [13, 14, 15, 24, 25],
    [13, 14, 15, 24, 25],
    [0, 1, 2, 3, 6, 16],          // 20~23시: 혼합 하이라이트
    [1, 4, 7, 13, 17, 22],
    [2, 5, 8, 14, 20, 23],
    [0, 6, 9, 12, 19, 21],
  ];

  // 유효 인덱스만 필터 (배열 범위 초과 방어)
  const raw = poolByHour[hour] ?? [0];
  const pool = raw.filter((i) => i < n);
  if (!pool.length) return HUB_ARTISTS[0];

  const idx = pool[Math.floor(Math.random() * pool.length)];
  return HUB_ARTISTS[idx];
}
