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
 * Spotify ID 검증: iTunes API + Wikidata API 교차검증 완료 (2026-03-19)
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
  // 0: ── 대형 아이돌 / 글로벌 ──────────────────────────────────
  {
    spotifyId: "3Nrfpe0tUJi4K4DXYWgMUX",
    name: "BTS",
    nameKo: "BTS",
    accent: "#c084fc",
    nebula: "#1a0a2e",
    nebula2: "#130820",
  },
  // 1:
  {
    spotifyId: "41MozSoPIsD1dJM0CLPjZF",
    name: "BLACKPINK",
    nameKo: "블랙핑크",
    accent: "#fb7185",
    nebula: "#2a0a14",
    nebula2: "#1a060e",
  },
  // 2:
  {
    spotifyId: "3HqSLMAZ3g3d5poNaI7GOU",
    name: "IU",
    nameKo: "아이유",
    accent: "#67e8f9",
    nebula: "#041a20",
    nebula2: "#021014",
  },
  // 3: ── 힙합 / 크로스오버 ─────────────────────────────────────
  {
    spotifyId: "2Ek1q2haOnxVqhvVKqMvJe",
    name: "Zico",
    nameKo: "지코",
    accent: "#fbbf24",
    nebula: "#1a1400",
    nebula2: "#120e00",
  },
  // 4:
  {
    spotifyId: "3yY2jUvSFTDMzPDqBOkO0E",
    name: "Jay Park",
    nameKo: "박재범",
    accent: "#34d399",
    nebula: "#041a10",
    nebula2: "#021008",
  },
  // 5:
  {
    spotifyId: "2w9zwq3AkvD4mVLDyo3i1L",
    name: "Epik High",
    nameKo: "에픽하이",
    accent: "#60a5fa",
    nebula: "#041428",
    nebula2: "#020c1a",
  },
  // 6: ── K-인디 씬 ──────────────────────────────────────────────
  {
    spotifyId: "0Kv3muNFnLPfFSnJlKZGsS",
    name: "Hyukoh",
    nameKo: "혁오",
    accent: "#f97316",
    nebula: "#1a0c04",
    nebula2: "#120802",
  },
  // 7:
  {
    spotifyId: "6liAMWkB0u95sm91IkwMpK",
    name: "Heize",
    nameKo: "헤이즈",
    accent: "#a78bfa",
    nebula: "#10062e",
    nebula2: "#0a0420",
  },
  // 8:
  {
    spotifyId: "6WeDO4GynFmK4OxwkBzMW8",
    name: "The Black Skirts",
    nameKo: "검정치마",
    accent: "#94a3b8",
    nebula: "#0a0c10",
    nebula2: "#060808",
  },
  // 9: ── 4세대 아이돌 ───────────────────────────────────────────
  {
    spotifyId: "28ot3wh4oNmoFOdVajibBl",
    name: "NMIXX",
    nameKo: "엔믹스",
    accent: "#e879f9",
    nebula: "#200a28",
    nebula2: "#140618",
  },
  // 10:
  {
    spotifyId: "0L8ExT028jH3ddEcZwqJJ5",
    name: "Stray Kids",
    nameKo: "스트레이 키즈",
    accent: "#f43f5e",
    nebula: "#20040a",
    nebula2: "#140206",
  },
  // 11:
  {
    spotifyId: "2AfmfGFbe0XWe6oFCAxnME",
    name: "(G)I-DLE",
    nameKo: "(여자)아이들",
    accent: "#facc15",
    nebula: "#1a1600",
    nebula2: "#100e00",
  },
  // 12:
  {
    spotifyId: "0NdObd21P2DSFo0iLGmYqZ",
    name: "NewJeans",
    nameKo: "뉴진스",
    accent: "#86efac",
    nebula: "#041a0c",
    nebula2: "#021008",
  },
  // 13: ── 뉴웨이브 ───────────────────────────────────────────────
  {
    spotifyId: "6HaGTQPmzraZdZR615C3bq",
    name: "BIBI",
    nameKo: "비비",
    accent: "#c026d3",
    nebula: "#1a0420",
    nebula2: "#0e0214",
  },
  // 14:
  {
    spotifyId: "3tVQdUvClmAT7URs9V3rsp",
    name: "pH-1",
    nameKo: "pH-1",
    accent: "#2dd4bf",
    nebula: "#041814",
    nebula2: "#020e0c",
  },
  // 15: ── K-인디 레전드 & 뉴웨이브 ────────────────────────────
  {
    spotifyId: "5rHUhS9Ya0S63WI9LFmCSx",
    name: "Baek A",
    nameKo: "백아",
    accent: "#f0abfc",
    nebula: "#1a0424",
    nebula2: "#100218",
  },
  // 16:
  {
    spotifyId: "6OSMGFNb20nNBw4a2vWxMT",
    name: "Autumn Vacation",
    nameKo: "가을방학",
    accent: "#fb923c",
    nebula: "#1a0e04",
    nebula2: "#100802",
  },
  // 17:
  {
    spotifyId: "1Juf4OqydiYBfBx4TtMtH9",
    name: "Unnieneibalgwan",
    nameKo: "언니네이발관",
    accent: "#a3e635",
    nebula: "#0e1a04",
    nebula2: "#080e02",
  },
  // 18:
  {
    spotifyId: "1BwU3fTprQmvrVc8Rl9SHw",
    name: "Lee Baksa",
    nameKo: "이박사",
    accent: "#fde68a",
    nebula: "#1a1804",
    nebula2: "#100e02",
  },
  // 19:
  {
    spotifyId: "5wVJpXzuKV6Xj7Yhsf2uYx",
    name: "Han Roro",
    nameKo: "한로로",
    accent: "#93c5fd",
    nebula: "#04101a",
    nebula2: "#020810",
  },
  // 20:
  {
    spotifyId: "3WbKkfwmDLgVwR9ExchFVC",
    name: "Nell",
    nameKo: "넬",
    accent: "#7dd3fc",
    nebula: "#04141a",
    nebula2: "#020c10",
  },
  // 21:
  {
    spotifyId: "2XFSeoCf8No50etmN8b4Sy",
    name: "Linus's Blanket",
    nameKo: "라이너스의 담요",
    accent: "#86efac",
    nebula: "#041a0e",
    nebula2: "#020e08",
  },
  // 22:
  {
    spotifyId: "00iP5z19F6kM7L3gMhF4oD",
    name: "Deli Spice",
    nameKo: "델리스파이스",
    accent: "#fca5a5",
    nebula: "#1a0804",
    nebula2: "#100402",
  },
  // 23:
  {
    spotifyId: "6a14ZNuq4LsSkVHQR0kWd9",
    name: "Through the Sloe",
    nameKo: "through the sloe",
    accent: "#c4b5fd",
    nebula: "#0e0424",
    nebula2: "#080218",
  },
  // 24:
  {
    spotifyId: "4O5NReb5AzwlP3dFQGeTuD",
    name: "Julia's Heart",
    nameKo: "줄리아하트",
    accent: "#f9a8d4",
    nebula: "#1a0414",
    nebula2: "#10020c",
  },
  // 25:
  {
    spotifyId: "1gq4XavqmZhqOzEkpFBz1j",
    name: "Broccoli You Too",
    nameKo: "브로콜리너마저",
    accent: "#bbf7d0",
    nebula: "#041a0c",
    nebula2: "#020e06",
  },
  // 26: ── Wikidata 기반 추가 아티스트 (2026-03-19) ─────────────
  {
    spotifyId: "6OwKE9Ez6ALxpTaKcT5ayv",
    name: "AKMU",
    nameKo: "악동뮤지션",
    accent: "#e46b67",
    nebula: "#1b0f0e",
    nebula2: "#0f0a0a",
  },
  // 27:
  {
    spotifyId: "4Kxlr1PRlDKEB0ekOCyHgX",
    name: "BIGBANG",
    nameKo: "빅뱅",
    accent: "#dc67e4",
    nebula: "#1a0e1b",
    nebula2: "#0f0a0f",
  },
  // 28:
  {
    spotifyId: "0Sadg1vgvaPqGTOjxu0N6c",
    name: "Girls' Generation",
    nameKo: "소녀시대",
    accent: "#e48967",
    nebula: "#1b120e",
    nebula2: "#0f0c0a",
  },
  // 29:
  {
    spotifyId: "1TTx0YcbKUtJIZY1HEnh9B",
    name: "J.Y. Park",
    nameKo: "박진영",
    accent: "#8b67e4",
    nebula: "#120e1b",
    nebula2: "#0c0a0f",
  },
  // 30:
  {
    spotifyId: "52Gsa9Zypqztm2DeNkQfCm",
    name: "Seo Taiji",
    nameKo: "서태지",
    accent: "#e46778",
    nebula: "#1b0e10",
    nebula2: "#0f0a0b",
  },
  // 31:
  {
    spotifyId: "6sxtN9maIhNAu663hY5g6B",
    name: "Yoon Sang",
    nameKo: "윤상",
    accent: "#67e48d",
    nebula: "#0e1b12",
    nebula2: "#0a0f0c",
  },
  // 32:
  {
    spotifyId: "7sS12h1hMwOqXiB5vYdlu8",
    name: "Toy",
    nameKo: "토이",
    accent: "#e4c767",
    nebula: "#1b180e",
    nebula2: "#0f0e0a",
  },
  // 33:
  {
    spotifyId: "4hDVt8U6lhZNnXpFcXwYwS",
    name: "Yoon Mirae",
    nameKo: "윤미래",
    accent: "#677ae4",
    nebula: "#0e101b",
    nebula2: "#0a0b0f",
  },
  // 34: ── 2026-03-19 추가 ──────────────────────────────────────
  {
    spotifyId: "04L3elxyr0XFua2Ek3domW",
    name: "Sunwoo Jung-a",
    nameKo: "선우정아",
    accent: "#f472b6",
    nebula: "#1a0814",
    nebula2: "#100410",
  },
  // 35:
  {
    spotifyId: "0JGN9XIqm3vfg7hhPHjExI",
    name: "Leessang",
    nameKo: "리쌍",
    accent: "#fbbf24",
    nebula: "#1a1400",
    nebula2: "#120e00",
  },
  // 36:
  {
    spotifyId: "0pfVDTchnVMBTzGylIuJNa",
    name: "Lee Juk",
    nameKo: "이적",
    accent: "#38bdf8",
    nebula: "#04121a",
    nebula2: "#020b10",
  },
  // 37:
  {
    spotifyId: "64RfnYDHtR3ZaLdtxAjPDA",
    name: "Deux",
    nameKo: "듀스",
    accent: "#fb7185",
    nebula: "#1a0610",
    nebula2: "#100208",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "41lcf5k3PkUdxupYLkcjCd",
    name: "dosii",
    nameKo: "도시",
    accent: "#38bdf8",
    nebula: "#082f49",
    nebula2: "#0c4a6e",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "1tpzH7XBT9sUJx4CMB4hCp",
    name: "Mot",
    nameKo: "못",
    accent: "#a78bfa",
    nebula: "#2e1065",
    nebula2: "#4c1d95",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "0oN8IZB1C3lY1ABKwJOu1I",
    name: "Kiha & The Faces",
    nameKo: "장기하와 얼굴들",
    accent: "#f472b6",
    nebula: "#831843",
    nebula2: "#be185d",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "07OePkse2fcvU9wlVftNMl",
    name: "SE SO NEON",
    nameKo: "새소년",
    accent: "#fb923c",
    nebula: "#7c2d12",
    nebula2: "#9a3412",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "7zhojNyxff5HeS5mIgUVmU",
    name: "Bosudongcooler",
    nameKo: "보수동쿨러",
    accent: "#4ade80",
    nebula: "#14532d",
    nebula2: "#166534",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "2PsnDm6aGMnPFcqyyII5iQ",
    name: "Bluedawn",
    nameKo: "푸른새벽",
    accent: "#94a3b8",
    nebula: "#0f172a",
    nebula2: "#1e293b",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "0ndvlJnYkMJZhet7fVhk9C",
    name: "DABDA",
    nameKo: "다브다",
    accent: "#facc15",
    nebula: "#713f12",
    nebula2: "#854d0e",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "08J6v4qHZz06ua0qAicWmE",
    name: "Kim Sawol",
    nameKo: "김사월",
    accent: "#fb7185",
    nebula: "#881337",
    nebula2: "#9f1239",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "6S4fsREHT1NEjTb3lYD2pG",
    name: "THORNAPPLE",
    nameKo: "쏜애플",
    accent: "#38bdf8",
    nebula: "#082f49",
    nebula2: "#0c4a6e",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "5WKUZJPvN1SScyggtPFShK",
    name: "Nerd Connection",
    nameKo: "너드커넥션",
    accent: "#a78bfa",
    nebula: "#2e1065",
    nebula2: "#4c1d95",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "7EVlq3yUVHbHZZsaYSOcXt",
    name: "Meaningful Stone",
    nameKo: "김뜻돌",
    accent: "#f472b6",
    nebula: "#831843",
    nebula2: "#be185d",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "6evmYxFbDSIHilUaYC9MhL",
    name: "Jaurim",
    nameKo: "자우림",
    accent: "#fb923c",
    nebula: "#7c2d12",
    nebula2: "#9a3412",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "29UQ130XMQDR55X4Rmjapd",
    name: "mingginyu",
    nameKo: "밍기뉴",
    accent: "#4ade80",
    nebula: "#14532d",
    nebula2: "#166534",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "2kxVxKOgoefmgkwoHipHsn",
    name: "Silica Gel",
    nameKo: "실리카겔",
    accent: "#94a3b8",
    nebula: "#0f172a",
    nebula2: "#1e293b",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "5KOhn3Gjbd4DUavli5No5f",
    name: "cotoba",
    nameKo: "코토바",
    accent: "#facc15",
    nebula: "#713f12",
    nebula2: "#854d0e",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "64sY7LsUjNE3ifONkftTXC",
    name: "ADOY",
    nameKo: "아도이",
    accent: "#fb7185",
    nebula: "#881337",
    nebula2: "#9f1239",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "5q9adPv91NFr8q2ZcKmX0V",
    name: "youra",
    nameKo: "유라",
    accent: "#38bdf8",
    nebula: "#082f49",
    nebula2: "#0c4a6e",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "7K1yj70w0ldP7bMDqiiHMo",
    name: "Aseul",
    nameKo: "아슬",
    accent: "#a78bfa",
    nebula: "#2e1065",
    nebula2: "#4c1d95",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "18r9qka1AKwgqzUzaLdxhm",
    name: "Lee Godo",
    nameKo: "이고도",
    accent: "#f472b6",
    nebula: "#831843",
    nebula2: "#be185d",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "2ncTglxMHKmCzBKckfzOEv",
    name: "ALEPH",
    nameKo: "알레프",
    accent: "#fb923c",
    nebula: "#7c2d12",
    nebula2: "#9a3412",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "4uU7KfTjcjyKUGWSaTzLu7",
    name: "015B",
    nameKo: "015B",
    accent: "#4ade80",
    nebula: "#14532d",
    nebula2: "#166534",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "71kRpwy6xTeG2OXXkRJdkA",
    name: "Guckkasten",
    nameKo: "국카스텐",
    accent: "#94a3b8",
    nebula: "#0f172a",
    nebula2: "#1e293b",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "0gqEtTORPrOqWJWElLvDQ3",
    name: "Car, the garden",
    nameKo: "카더가든",
    accent: "#facc15",
    nebula: "#713f12",
    nebula2: "#854d0e",
  },
  // ── Playlist Additions ──
  {
    spotifyId: "5xNWQgdUZS4YN7xAYItpKi",
    name: "Chamsom",
    nameKo: "참깨와 솜사탕",
    accent: "#fb7185",
    nebula: "#881337",
    nebula2: "#9f1239",
  },
];

/**
 * 시간대 기반으로 허브 아티스트 후보 풀을 좁히고, 하나를 반환.
 * - 하루 동안 시간대마다 다른 분위기를 연출
 * - 같은 시간대에서도 약간의 랜덤성 유지
 * - 인덱스 범위 초과 자동 방어
 */
export function pickHubArtist(hourOverride?: number): HubArtist {
  const hour = hourOverride ?? new Date().getHours();
  const n = HUB_ARTISTS.length;

  // 시간대별로 5~7명씩 다른 풀을 배정 (인덱스 기반)
  const poolByHour: number[][] = [
    [2, 19, 20, 22, 34],          // 0~3시  : 아이유, 한로로, 넬, 델리스파이스, 선우정아
    [2, 19, 20, 22, 34],
    [2, 19, 20, 22, 34],
    [2, 19, 20, 22, 34],
    [3, 4, 5, 16, 21, 35],        // 4~7시  : 지코, 박재범, 에픽하이, 가을방학, 라이너스, 리쌍
    [3, 4, 5, 16, 21, 35],
    [3, 4, 5, 16, 21, 35],
    [3, 4, 5, 16, 21, 35],
    [6, 7, 8, 15, 23, 25],        // 8~11시 : 혁오, 헤이즈, 검정치마, 백아, 슬로, 브로콜리
    [6, 7, 8, 15, 23, 25],
    [6, 7, 8, 15, 23, 25],
    [6, 7, 8, 15, 23, 25],
    [9, 10, 11, 12, 18, 27],      // 12~15시: NMIXX, 스키즈, 아이들, 뉴진스, 이박사, 빅뱅
    [9, 10, 11, 12, 18, 27],
    [9, 10, 11, 12, 18, 27],
    [9, 10, 11, 12, 18, 27],
    [13, 14, 24, 25, 26, 28],     // 16~19시: 비비, pH-1, 줄리아하트, 브로콜리, AKMU, 소녀시대
    [13, 14, 24, 25, 26, 28],
    [13, 14, 24, 25, 26, 28],
    [13, 14, 24, 25, 26, 28],
    [0, 1, 2, 3, 6, 29, 30],      // 20~23시: 혼합 하이라이트
    [1, 4, 7, 13, 17, 31, 32, 36],// 이적 추가
    [2, 5, 8, 14, 20, 33, 37],    // 듀스 추가
    [0, 6, 9, 12, 19, 26, 27, 34],// 선우정아 추가
  ];

  const raw = poolByHour[hour] ?? [0];
  const pool = raw.filter((i) => i < n);
  if (!pool.length) return HUB_ARTISTS[0];

  const idx = pool[Math.floor(Math.random() * pool.length)];
  return HUB_ARTISTS[idx];
}
