/**
 * Spotify Web API 클라이언트
 * Client Credentials Flow — 서버 사이드 전용 (토큰 절대 클라이언트 노출 금지)
 */

import type { CosmosArtist, CosmosData, SatelliteNode } from './types';
// Genius import 제거 — Vercel 서버 IP에서 CAPTCHA 차단 확정 (2026)
import { searchArtistMBID, getArtistRelations, getRecordingCredits } from './musicbrainz';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// ── 토큰 캐시 (모듈 레벨) ──────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getSpotifyToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify API credentials are not configured');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Spotify token error: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken!;
}

async function spotifyFetch<T>(path: string, retries = 1): Promise<T> {
  const token = await getSpotifyToken();
  
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store', // 완벽한 캐시 무효화. _t 인덱스는 Spotify 문법 위반이므로 제거
    signal: AbortSignal.timeout(5000),
  });

  if (res.status === 429 && retries > 0) {
    const retryAfter = res.headers.get('Retry-After');
    let waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
    
    // Spotify가 80000초(22시간) 등 비정상적으로 긴 대기시간을 요구하면 무한 로딩되므로 차단
    if (isNaN(waitTime) || waitTime > 3000) {
      console.warn(`[Spotify API] 차단 시간 너무 김 (${waitTime}ms). 강제 종료.`);
      throw new Error(`Spotify 429 Ban: ${waitTime}ms`);
    }

    console.warn(`[Spotify API] 429 Rate Limit Hit. Waiting ${waitTime}ms...`);
    await new Promise(r => setTimeout(r, waitTime));
    return spotifyFetch<T>(path, retries - 1);
  }

  if (!res.ok) {
    throw new Error(`Spotify API error ${res.status}: ${path}`);
  }

  return res.json();
}

// ── Spotify 응답 타입 ─────────────────────────────────────────────

interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string; width: number; height: number }[];
  genres: string[];
  popularity: number;
  external_urls: { spotify: string };
}

interface SpotifyTrack {
  id: string;
  name: string;
  preview_url: string | null;
}

// ── 변환 헬퍼 ────────────────────────────────────────────────────

function toCosmosArtist(
  artist: SpotifyArtist,
  previewUrl: string | null = null,
  previewTrackName: string | null = null
): CosmosArtist {
  // Spotify는 여러 해상도 이미지를 내림차순으로 제공. 640px(index 0) 사용
  const imageUrl = artist.images?.[0]?.url ?? null;

  return {
    spotifyId: artist.id,
    name: artist.name,
    imageUrl,
    genres: artist.genres ?? [],
    popularity: artist.popularity ?? 0,
    previewUrl,
    previewTrackName,
    spotifyUrl: artist.external_urls?.spotify ?? `https://open.spotify.com/artist/${artist.id}`,
  };
}

// ── 공개 API 함수 ────────────────────────────────────────────────

/**
 * 아티스트 검색 (홈 검색창용)
 */
export async function searchArtists(query: string): Promise<CosmosArtist[]> {
  if (!query.trim()) return [];

  const encoded = encodeURIComponent(query.trim());
  const data = await spotifyFetch<{ artists: { items: SpotifyArtist[] } }>(
    `/search?type=artist&q=${encoded}&limit=10&market=KR`
  );

  return (data.artists?.items ?? []).map((a) => toCosmosArtist(a));
}

/**
 * 아티스트 전체 데이터 조회 (From 페이지용)
 * - 위성 수집 레이어:
 *   Layer 1: MusicBrainz 아티스트 관계 (그룹 멤버, 콜라보)
 *   Layer 2: MusicBrainz 레코딩 크레딧 (프로듀서/작곡/작사 — Work 레벨 포함)
 *   Layer 3: Fallback K-POP 추천
 * [제거됨] Spotify top-tracks: 2024.11 이후 Development Mode에서 403 확정
 * [제거됨] Genius: Vercel 서버 IP에서 anti-bot CAPTCHA 차단 확정
 */
const FALLBACK_KPOP_IDS = [
  "3Nrfpe0tUJi4K4DXYWgMUX", // BTS
  "41MozSoPIsD1dJM0CLPjZF", // BLACKPINK
  "7n2Ycct7Beij7Dj7meI4X0", // TWICE
  "3HqSLMAZ3g3d5poNaI7GOU", // IU
  "1z4g3DjTBBZKhvAroFlhOM", // Red Velvet
  "4Kxlr1PRlDKEB0ekOCyHgX", // BIGBANG
  "3cjEqqelV9zb41pAfcwrPM", // EXO
];

import { HUB_ARTISTS } from "@/data/hub-artists";

/**
 * 코어 아티스트 기본 정보만 빠르게 반환 (서버 컴포넌트용, ~1초 이내)
 * Spotify 에러(429 밴 등) 발생 시 iTunes를 통해 자체적으로 가짜 Core를 합성해 반환(생존 모드).
 */
export async function getArtistCore(id: string): Promise<CosmosArtist> {

  try {
    const artistData = await spotifyFetch<SpotifyArtist>(`/artists/${id}`);
    const audio = await getArtistPreviewViaSearch(artistData.name).catch(() => ({ previewUrl: null, trackName: null }));
    return toCosmosArtist(artistData, audio.previewUrl, audio.trackName);
  } catch (err: any) {
    console.warn("[getArtistCore] Spotify API 차단! iTunes Fallback 작동", err.message);
    let fallbackName = HUB_ARTISTS.find(h => h.spotifyId === id)?.nameKo;
    
    // 만약 허브가 아닌 일반 위성 아티스트로 다이브한 경우, 캐시 파일들 안에서 이름을 스캔해옵니다. (선우정아 오염 방지!)
    if (!fallbackName) {
      try {
        const fs = require('fs');
        const path = require('path');
        const hubDir = path.join(process.cwd(), "public", "data", "hub");
        const files = fs.readdirSync(hubDir);
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          const raw = fs.readFileSync(path.join(hubDir, file), "utf-8");
          if (!raw.includes(id)) continue; // 빠른 스캐닝
          const data = JSON.parse(raw);
          const sat = data.satellites?.find((s: any) => s.spotifyId === id);
          if (sat) {
            fallbackName = sat.name;
            break;
          }
        }
      } catch (e) {
        console.error("[getArtistCore] 캐시 검색 실패", e);
      }
    }
    fallbackName = fallbackName || "Unknown Artist";
    
    // 생존 모드: iTunes API 로 코어 프로필 이미지와 음악 강제 추출
    const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(fallbackName)}&entity=song&limit=1&country=KR`);
    if (!itunesRes.ok) throw new Error("Complete API Failure");
    
    const data = await itunesRes.json();
    const result = data.results?.[0];
    
    return {
      spotifyId: id,
      name: result?.artistName || fallbackName,
      imageUrl: result?.artworkUrl100?.replace('100x100bb', '600x600bb') || null,
      genres: [],
      popularity: 80,
      previewUrl: result?.previewUrl || null,
      previewTrackName: result?.trackName || null,
      spotifyUrl: `https://open.spotify.com/artist/${id}`
    };
  }
}

export async function getArtistFull(id: string): Promise<CosmosData> {
  let core: CosmosArtist;
  try {
    core = await getArtistCore(id);
  } catch (e) {
    return { core: {} as CosmosArtist, satellites: [] }; // 심각한 에러 방어
  }

  const satelliteMap = new Map<string, SatelliteNode>(); // spotifyId → node (중복 방지)

  // [Layer 1 제거] Spotify top-tracks — 2024.11 이후 Development Mode 403 확정
  // MusicBrainz Layer 2에서 피처링(vocal/guest) 크레딧을 포함하여 수집합니다.

  // ═══════════════════════════════════════════════════════════════
  // LAYER 2: MusicBrainz 관계 (멤버, 프로듀서, 작곡가 등)
  // ═══════════════════════════════════════════════════════════════
  const mbid = await searchArtistMBID(core.name);

  if (mbid) {
    // 2a. 아티스트 직접 관계 (멤버, 콜라보 등)
    const artistRels = await getArtistRelations(mbid);
    for (const rel of artistRels) {
      if (satelliteMap.size >= 15) break;

      const roleLabel = mbRoleToKorean(rel.role);
      if (!roleLabel) continue;

      // MusicBrainz 이름으로 Spotify 검색하여 ID 매핑
      const searchRes = await spotifyFetch<{ artists: { items: SpotifyArtist[] } }>(
        `/search?type=artist&q=${encodeURIComponent(rel.name)}&limit=1&market=KR`,
        0 // 429 Fast-fail
      ).catch(() => null);

      const found = searchRes?.artists?.items?.[0];
      if (found && found.id !== id && !satelliteMap.has(found.id)) {
        satelliteMap.set(found.id, {
          spotifyId: found.id,
          name: found.name,
          imageUrl: found.images?.[0]?.url ?? null,
          genres: found.genres ?? [],
          popularity: found.popularity ?? 0,
          previewUrl: null,
          previewTrackName: null,
          spotifyUrl: found.external_urls?.spotify ?? `https://open.spotify.com/artist/${found.id}`,
          relationType: rel.role === "member" || rel.role === "group" ? "SAME_GROUP" : "PRODUCER",
          relationKeyword: roleLabel,
        });
      } else if (!found) {
        const mockId = `mb_${Date.now()}_${Math.random()}`;
        satelliteMap.set(mockId, {
          spotifyId: mockId,
          name: rel.name,
          imageUrl: null,
          genres: [],
          popularity: 0,
          previewUrl: null,
          previewTrackName: null,
          spotifyUrl: '#',
          relationType: rel.role === "member" || rel.role === "group" ? "SAME_GROUP" : "PRODUCER",
          relationKeyword: roleLabel,
        });
      }
    }

    // 2b. 레코딩 크레딧 (프로듀서, 작곡가 등 — 빈도 기반 랭킹)
    if (satelliteMap.size < 12) {
      const recCredits = await getRecordingCredits(core.name, mbid);
      // 🚨 필터링 임계값: 피처링은 1곡도 인정하지만, 그 외(프로듀서, 작곡/편곡)는 최소 2곡 이상(강한 협업)만 노출
      const filteredCredits = recCredits.filter(c => c.role === "featured" || c.count >= 2);
      const topCredits = filteredCredits.slice(0, 4); // 상위 4명

      for (const credit of topCredits) {
        if (satelliteMap.size >= 15) break;

        const roleLabel = mbRoleToKorean(credit.role);
        if (!roleLabel) continue;

        const searchRes = await spotifyFetch<{ artists: { items: SpotifyArtist[] } }>(
          `/search?type=artist&q=${encodeURIComponent(credit.name)}&limit=1&market=KR`,
          0 // 429 Fast-fail
        ).catch(() => null);

        const found = searchRes?.artists?.items?.[0];
        if (found && found.id !== id && !satelliteMap.has(found.id)) {
          const keyword = credit.count >= 2
            ? `${roleLabel} (${credit.count}곡 참여)`
            : roleLabel;

          satelliteMap.set(found.id, {
            spotifyId: found.id,
            name: found.name,
            imageUrl: found.images?.[0]?.url ?? null,
            genres: found.genres ?? [],
            popularity: found.popularity ?? 0,
            previewUrl: null,
            previewTrackName: null,
            spotifyUrl: found.external_urls?.spotify ?? `https://open.spotify.com/artist/${found.id}`,
            relationType: credit.role === "composer" || credit.role === "lyricist" ? "WRITER" : "PRODUCER",
            relationKeyword: keyword,
          });
        } else if (!found) {
          // Spotify 차단 시 생존 모드 (이미지는 이니셜 표시)
          const keyword = credit.count >= 2
            ? `${roleLabel} (${credit.count}곡 참여)`
            : roleLabel;
          const mockId = `mb_${Date.now()}_${Math.random()}`;
          satelliteMap.set(mockId, {
            spotifyId: mockId,
            name: credit.name,
            imageUrl: null,
            genres: [],
            popularity: 0,
            previewUrl: null,
            previewTrackName: null,
            spotifyUrl: '#',
            relationType: credit.role === "composer" || credit.role === "lyricist" ? "WRITER" : "PRODUCER",
            relationKeyword: keyword,
          });
        }
      }
    }
  }

  // [Layer 3 제거] Genius API — Vercel 서버 IP에서 anti-bot CAPTCHA 차단 확정 (2026)
  // 대신 MusicBrainz Phase 2 업그레이드에서 Work 레벨(작곡/작사) 크레딧으로 완전 대체됩니다.

  // ═══════════════════════════════════════════════════════════════
  // LAYER 4: Fallback (여전히 부족하면 대표 K-POP 위성으로 채움)
  // ═══════════════════════════════════════════════════════════════
  if (satelliteMap.size < 3) {
    const FALLBACK_NAMES: Record<string, string> = {
      "3Nrfpe0tUJi4K4DXYWgMUX": "BTS",
      "41MozSoPIsD1dJM0CLPjZF": "BLACKPINK",
      "7n2Ycct7Beij7Dj7meI4X0": "TWICE",
      "3HqSLMAZ3g3d5poNaI7GOU": "IU",
      "1z4g3DjTBBZKhvAroFlhOM": "Red Velvet",
      "4Kxlr1PRlDKEB0ekOCyHgX": "검정치마",
      "3cjEqqelV9zb41pAfcwrPM": "EXO",
    };
    
    for (const fallbackId of FALLBACK_KPOP_IDS) {
      if (satelliteMap.size >= 8) break;
      if (fallbackId === id || satelliteMap.has(fallbackId)) continue;
      satelliteMap.set(fallbackId, {
        spotifyId: fallbackId,
        name: FALLBACK_NAMES[fallbackId] || "K-POP Artist",
        imageUrl: null,
        genres: [],
        popularity: 0,
        previewUrl: null,
        previewTrackName: null,
        spotifyUrl: `https://open.spotify.com/artist/${fallbackId}`,
        relationType: "FALLBACK",
        relationKeyword: "K-Culture 추천",
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FINAL: Spotify 일괄 데이터 로드 (429 에러 원천 차단: 1번만 호출)
  // ═══════════════════════════════════════════════════════════════
  const finalIds = Array.from(satelliteMap.keys()).filter(id => !id.startsWith("mb_"));
  // Spotify 제한 /artists?ids=...는 최대 50개지만 15개로 캡을 씌우고 있으니 안심
  if (finalIds.length > 0) {
    try {
      const data = await spotifyFetch<{ artists: SpotifyArtist[] }>(
        `/artists?ids=${finalIds.join(",")}`
      );

      for (const a of data.artists) {
        if (!a || !satelliteMap.has(a.id)) continue;
        const node = satelliteMap.get(a.id)!;
        node.name = a.name;
        node.imageUrl = a.images?.[0]?.url ?? node.imageUrl;
        node.genres = a.genres ?? [];
        node.popularity = a.popularity ?? 0;
        satelliteMap.set(a.id, node);
      }
    } catch (e: any) {
      console.error("[Spotify API] 일괄 로드 실패:", e.message);
      // 실패 시 화면 빈 공간 방지를 위해 최소한의 이름은 계속 표시함 (fallback or search name)
    }
  }

  return { core, satellites: Array.from(satelliteMap.values()) };
}

/**
 * MusicBrainz 역할 → 한글 라벨
 */
function mbRoleToKorean(role: string): string | null {
  const map: Record<string, string> = {
    member: "그룹 멤버",
    group: "소속 그룹",
    collaboration: "공식 콜라보",
    producer: "전담 프로듀서",
    composer: "작곡",
    lyricist: "작사",
    arranger: "편곡",
    featured: "피처링",
    // 🚨 스태프 노이즈 필터링 (엔지니어, 세션, 믹싱 등은 라벨 매핑에서 제외하여 표시 안함)
  };
  return map[role] ?? null;
}

/**
 * 403 에러 우회용: Search API를 통해 아티스트의 첫 번째 유효한 preview_url 트랙 찾기
 */
export async function getArtistPreviewViaSearch(
  artistName: string
): Promise<{ previewUrl: string | null; trackName: string | null }> {
  try {
    // 2026년 기준, Spotify 대신 Apple iTunes API를 활용하여 무료 30초 미리듣기 추출
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=song&limit=5&country=KR`,
      { cache: 'no-store', signal: AbortSignal.timeout(4000) }
    );
    const data = await res.json();
    
    // previewUrl이 존재하는 트랙 찾기
    const validTrack = data.results?.find((t: any) => t.previewUrl) ?? null;
    
    return {
      previewUrl: validTrack?.previewUrl ?? null,
      trackName: validTrack?.trackName ?? null,
    };
  } catch (err) {
    console.error("iTunes API fetch error:", err);
    return { previewUrl: null, trackName: null };
  }
}

