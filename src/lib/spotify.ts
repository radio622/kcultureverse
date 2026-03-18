/**
 * Spotify Web API 클라이언트
 * Client Credentials Flow — 서버 사이드 전용 (토큰 절대 클라이언트 노출 금지)
 */

import type { CosmosArtist, CosmosData, SatelliteNode } from './types';
import { searchSongId, getSongCredits } from './genius';
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
 * - 아티스트 상세 + top-tracks (preview_url) + related-artists 병렬 호출
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

/**
 * 코어 아티스트 기본 정보만 빠르게 반환 (서버 컴포넌트용, ~1초 이내)
 * Spotify 에러(429 밴 등) 발생 시 iTunes를 통해 자체적으로 가짜 Core를 합성해 반환(생존 모드).
 */
export async function getArtistCore(id: string): Promise<CosmosArtist> {
  const FALLBACKS: Record<string, string> = {
    "3Nrfpe0tUJi4K4DXYWgMUX": "BTS",
    "41MozSoPIsD1dJM0CLPjZF": "BLACKPINK",
    "28ot3wh4oNmoFOdVajibBl": "NMIXX",
    "4Kxlr1PRlDKEB0ekOCyHgX": "검정치마",
    "5rm0sBnflaCLmMMlS1cNMr": "백아",
    "1Ur5YlAlza6E69KPH88Fti": "이박사",
  };

  try {
    const artistData = await spotifyFetch<SpotifyArtist>(`/artists/${id}`);
    const audio = await getArtistPreviewViaSearch(artistData.name).catch(() => ({ previewUrl: null, trackName: null }));
    return toCosmosArtist(artistData, audio.previewUrl, audio.trackName);
  } catch (err: any) {
    console.warn("[getArtistCore] Spotify API 차단! iTunes Fallback 작동", err.message);
    const fallbackName = FALLBACKS[id] || "Unknown Artist";
    
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

  // ═══════════════════════════════════════════════════════════════
  // LAYER 1: Spotify 피처링 (곡에 함께 크레딧된 아티스트)
  // ═══════════════════════════════════════════════════════════════
  const tracksData = await spotifyFetch<{ tracks: { items: (SpotifyTrack & { artists?: { id: string; name: string }[] })[] } }>(
    `/search?type=track&q=${encodeURIComponent(core.name)}&limit=20&market=KR`,
    0
  ).catch(() => ({ tracks: { items: [] } }));
  const validTracks = tracksData.tracks?.items ?? [];

  // 피처링 트랙별로 곡 이름을 기록하여 관계 설명에 활용
  const featuredTrackMap = new Map<string, string[]>(); // artistId → [곡 이름들]
  for (const track of validTracks) {
    if (!track.artists) continue;
    const hasCore = track.artists.some(a => a.id === id);
    if (!hasCore) continue;

    for (const a of track.artists) {
      if (a.id !== id) {
        const prevTracks = featuredTrackMap.get(a.id) || [];
        if (!prevTracks.includes(track.name)) {
          prevTracks.push(track.name);
          featuredTrackMap.set(a.id, prevTracks);
        }
      }
    }
  }

  // 피처링 가중치(곡 수) 기준 정렬
  const sortedFeatured = Array.from(featuredTrackMap.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6); // 최대 6명

  for (const [artistId, tracks] of sortedFeatured) {
    const trackNames = tracks.slice(0, 3).join(", ");
    const keyword = tracks.length >= 2
      ? `피처링 ${tracks.length}곡: ${trackNames}`
      : `피처링: ${trackNames}`;

    satelliteMap.set(artistId, {
      spotifyId: artistId,
      name: "...",
      imageUrl: null,
      genres: [],
      popularity: 0,
      previewUrl: null,
      previewTrackName: null,
      spotifyUrl: `https://open.spotify.com/artist/${artistId}`,
      relationType: "FEATURED",
      relationKeyword: keyword,
    });
  }

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
      }
    }

    // 2b. 레코딩 크레딧 (프로듀서, 작곡가 등 — 빈도 기반 랭킹)
    if (satelliteMap.size < 12) {
      const recCredits = await getRecordingCredits(core.name, mbid);
      const topCredits = recCredits.slice(0, 4); // 상위 4명

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

  // ═══════════════════════════════════════════════════════════════
  // LAYER 3: Genius 보조 (MusicBrainz로도 부족할 경우)
  // ═══════════════════════════════════════════════════════════════
  if (satelliteMap.size < 5 && validTracks.length > 0) {
    const tracksToCheck = validTracks.slice(0, 3);
    const writerCounts = new Map<string, { count: number; imageUrl: string | null }>();
    const producerCounts = new Map<string, { count: number; imageUrl: string | null }>();

    await Promise.all(tracksToCheck.map(async (track) => {
      const songId = await searchSongId(track.name, core.name);
      if (songId) {
        const credits = await getSongCredits(songId);
        credits?.writers?.forEach(w => {
          if (w.name.toLowerCase() === core.name.toLowerCase()) return;
          const prev = writerCounts.get(w.name) || { count: 0, imageUrl: w.image_url ?? null };
          writerCounts.set(w.name, { count: prev.count + 1, imageUrl: w.image_url ?? prev.imageUrl });
        });
        credits?.producers?.forEach(p => {
          if (p.name.toLowerCase() === core.name.toLowerCase()) return;
          const prev = producerCounts.get(p.name) || { count: 0, imageUrl: p.image_url ?? null };
          producerCounts.set(p.name, { count: prev.count + 1, imageUrl: p.image_url ?? prev.imageUrl });
        });
      }
    }));

    const allGenius = [
      ...Array.from(producerCounts.entries()).map(([n, d]) => ({ name: n, count: d.count, img: d.imageUrl, type: "PRODUCER" as const, label: "프로듀서" })),
      ...Array.from(writerCounts.entries()).map(([n, d]) => ({ name: n, count: d.count, img: d.imageUrl, type: "WRITER" as const, label: "작곡/작사" })),
    ].sort((a, b) => b.count - a.count).slice(0, 3);

    for (const g of allGenius) {
      if (satelliteMap.size >= 15) break;
      const searchRes = await spotifyFetch<{ artists: { items: SpotifyArtist[] } }>(
        `/search?type=artist&q=${encodeURIComponent(g.name)}&limit=1&market=KR`,
        0 // 429 Fast-fail
      ).catch(() => null);

      const found = searchRes?.artists?.items?.[0];
      if (found && found.id !== id && !satelliteMap.has(found.id)) {
        satelliteMap.set(found.id, {
          spotifyId: found.id,
          name: found.name,
          imageUrl: found.images?.[0]?.url ?? g.img ?? null,
          genres: found.genres ?? [],
          popularity: found.popularity ?? 0,
          previewUrl: null,
          previewTrackName: null,
          spotifyUrl: found.external_urls?.spotify ?? `https://open.spotify.com/artist/${found.id}`,
          relationType: g.type,
          relationKeyword: g.count >= 2 ? `${g.label} (${g.count}곡)` : g.label,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER 4: Fallback (여전히 부족하면 대표 K-POP 위성으로 채움)
  // ═══════════════════════════════════════════════════════════════
  if (satelliteMap.size < 3) {
    for (const fallbackId of FALLBACK_KPOP_IDS) {
      if (satelliteMap.size >= 8) break;
      if (fallbackId === id || satelliteMap.has(fallbackId)) continue;
      satelliteMap.set(fallbackId, {
        spotifyId: fallbackId,
        name: "...",
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
  const finalIds = Array.from(satelliteMap.keys());
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
    producer: "프로듀서",
    composer: "작곡",
    lyricist: "작사",
    arranger: "편곡",
    featured: "피처링",
    performer: "연주 참여",
    mixer: "믹싱",
    remixer: "리믹서",
    musician: "세션",
    engineer: "엔지니어",
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

