/**
 * 🔭 V5.3 Phase 1 — Task 1-2: Spotify 크레딧 기반 2촌 확장 크롤러
 *
 * 역할:
 *   Task 1-1에서 정제된 222명의 아티스트에 대해
 *   Spotify Albums → Tracks → Track Artists(피처링) 체인을 타고
 *   진짜 협업 관계(FEATURED)로 연결된 새로운 2촌 아티스트를 수집한다.
 *
 * 핵심 설계:
 *   ① 재개 가능 (Resume): 진행도를 .cache/crawl-progress.json에 기록.
 *      스크립트가 중간에 죽어도 죽은 지점부터 이어 달린다.
 *   ② 완전 캐시: 모든 API 응답을 .cache/spotify/로 영구 저장.
 *      같은 아티스트를 두 번 조회하지 않는다.
 *   ③ Rate Limit 방어: 요청 간 500ms 강제 지연.
 *   ④ API 호출 총량 상한: 10,000회 내에서 중단.
 *
 * 출력:
 *   scripts/.cache/featured-edges.json
 *   — 새로 발견된 FEATURED 엣지들
 *   scripts/.cache/new-artists.json
 *   — 새로 발견된 아티스트 메타데이터(id, name, image, genres, popularity)
 *
 * 실행:
 *   npx tsx scripts/crawl-featured-credits.ts
 *
 * DoD:
 *   ✅ FEATURED 엣지 100개 이상 발견
 *   ✅ 신규 유니크 아티스트 80명 이상
 *   ✅ FALLBACK 패턴 재발 없음 (BTS/BLACKPINK 전부 등장 패턴)
 */

import * as fs from "fs";
import * as path from "path";

require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

// ─── 경로 상수 ────────────────────────────────────────────────────
const HUB_DIR         = path.resolve(__dirname, "../public/data/hub");
const CACHE_DIR       = path.resolve(__dirname, ".cache/spotify");
const PROGRESS_FILE   = path.resolve(__dirname, ".cache/crawl-progress.json");
const EDGES_OUT       = path.resolve(__dirname, ".cache/featured-edges.json");
const ARTISTS_OUT     = path.resolve(__dirname, ".cache/new-artists.json");

const DELAY_MS        = 500;   // Rate Limit 방어
const MAX_API_CALLS   = 10_000;
const MAX_ALBUMS_PER_ARTIST = 5;  // 앨범 최대 5장만 (용량/속도 균형)
const MAX_TRACKS_PER_ALBUM  = 20; // 트랙 최대 20곡

// ─── 타입 ────────────────────────────────────────────────────────
interface SpotifyArtistSimple {
  id: string;
  name: string;
}

interface SpotifyArtist extends SpotifyArtistSimple {
  images?: { url: string; width: number; height: number }[];
  genres?: string[];
  popularity?: number;
}

interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: string;
  total_tracks: number;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtistSimple[];
}

interface FeaturedEdge {
  source: string;   // 허브/기존 아티스트 Spotify ID
  target: string;   // 새로 발견된 아티스트 Spotify ID
  targetName: string;
  songName: string; // 어떤 곡에서 발견했는지
  relation: "FEATURED";
  weight: number;   // 같이 나온 곡 수 / 10 (최대 1.0)
}

interface Progress {
  completedIds: string[];
  apiCallCount: number;
  lastUpdated: string;
}

// ─── 유틸 ────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readCache<T>(key: string): T | null {
  const file = path.join(CACHE_DIR, `${key}.json`);
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  }
  return null;
}

function writeCache(key: string, data: unknown) {
  ensureDir(CACHE_DIR);
  fs.writeFileSync(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(data), "utf-8");
}

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  }
  return { completedIds: [], apiCallCount: 0, lastUpdated: "" };
}

function saveProgress(progress: Progress) {
  ensureDir(path.dirname(PROGRESS_FILE));
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), "utf-8");
}

// ─── Spotify API 래퍼 (캐시 우선) ────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let apiCallCount = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken!;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET 미설정");
  const creds = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken!;
}

async function spotifyGet<T>(endpoint: string, cacheKey: string): Promise<T | null> {
  // 캐시 우선
  const cached = readCache<T>(cacheKey);
  if (cached !== null) return cached;

  if (apiCallCount >= MAX_API_CALLS) {
    console.log(`  ⚠️  API 호출 한도(${MAX_API_CALLS}회) 도달. 크롤링 중단.`);
    return null;
  }

  apiCallCount++;
  await sleep(DELAY_MS);

  const token = await getToken();
  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10);
    console.log(`  🚦 Rate limited. ${retryAfter}초 대기...`);
    await sleep(retryAfter * 1000);
    return spotifyGet<T>(endpoint, cacheKey);
  }

  if (!res.ok) {
    console.warn(`  ⚠️  API 에러: ${endpoint} → ${res.status}`);
    return null;
  }

  const data = await res.json() as T;
  writeCache(cacheKey, data);
  return data;
}

// ─── 메인 ────────────────────────────────────────────────────────
async function main() {
  ensureDir(CACHE_DIR);

  console.log("════════════════════════════════════════════════════");
  console.log("  🔭 V5.3 Task 1-2: Spotify 크레딧 2촌 확장 크롤러");
  console.log("════════════════════════════════════════════════════");

  // ── 1. 현재 모든 알려진 아티스트 ID 수집 (허브 + 위성) ──────────
  const hubFiles = fs.readdirSync(HUB_DIR).filter((f) => f.endsWith(".json"));
  const knownArtists = new Map<string, string>(); // id → name

  for (const file of hubFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(HUB_DIR, file), "utf-8"));
    knownArtists.set(data.core.spotifyId, data.core.name);
    for (const sat of data.satellites) {
      if (!sat.spotifyId.startsWith("mb_")) {
        knownArtists.set(sat.spotifyId, sat.name);
      }
    }
  }

  // mb_ 가짜 ID를 가진 위성들도 크롤 대상에서 제외하고 이름만 수집
  const crawlTargets: { id: string; name: string }[] = [];
  for (const [id, name] of knownArtists) {
    if (!id.startsWith("mb_")) {
      crawlTargets.push({ id, name });
    }
  }

  console.log(`  알려진 아티스트: ${knownArtists.size}명`);
  console.log(`  크롤 대상 (실제 Spotify ID): ${crawlTargets.length}명`);

  // ── 2. 진행도 로드 ────────────────────────────────────────────
  const progress = loadProgress();
  apiCallCount = progress.apiCallCount;
  const completedSet = new Set(progress.completedIds);
  const remaining = crawlTargets.filter((a) => !completedSet.has(a.id));

  console.log(`  이미 완료된 아티스트: ${completedSet.size}명`);
  console.log(`  남은 크롤 대상: ${remaining.length}명`);
  console.log(`  누적 API 호출: ${apiCallCount}/${MAX_API_CALLS}회`);
  console.log("");

  // ── 3. 기존 결과 로드 ─────────────────────────────────────────
  const featuredEdges: FeaturedEdge[] = fs.existsSync(EDGES_OUT)
    ? JSON.parse(fs.readFileSync(EDGES_OUT, "utf-8"))
    : [];

  const newArtists = new Map<string, SpotifyArtist>(
    fs.existsSync(ARTISTS_OUT)
      ? JSON.parse(fs.readFileSync(ARTISTS_OUT, "utf-8")).map((a: SpotifyArtist) => [a.id, a])
      : []
  );

  // 아티스트별 몇 개의 곡에 피처링되었는지 추적 (weight 계산용)
  const coAppearanceCount: Record<string, Record<string, number>> = {}; // source → target → count

  // ── 4. 크롤링 ─────────────────────────────────────────────────
  for (const { id: artistId, name: artistName } of remaining) {
    if (apiCallCount >= MAX_API_CALLS) break;

    console.log(`  🔍 [${completedSet.size + 1}/${crawlTargets.length}] ${artistName} (${artistId})`);

    // 앨범 목록 가져오기
    const albumsData = await spotifyGet<{ items: SpotifyAlbum[] }>(
      `/artists/${artistId}/albums?include_groups=album,single&market=KR&limit=${MAX_ALBUMS_PER_ARTIST}`,
      `albums_${artistId}`
    );

    if (!albumsData || !albumsData.items) {
      completedSet.add(artistId);
      progress.completedIds = [...completedSet];
      saveProgress(progress);
      continue;
    }

    const albums = albumsData.items.slice(0, MAX_ALBUMS_PER_ARTIST);

    for (const album of albums) {
      if (apiCallCount >= MAX_API_CALLS) break;

      // 앨범 트랙 가져오기
      const tracksData = await spotifyGet<{ items: SpotifyTrack[] }>(
        `/albums/${album.id}/tracks?limit=${MAX_TRACKS_PER_ALBUM}`,
        `tracks_${album.id}`
      );

      if (!tracksData || !tracksData.items) continue;

      for (const track of tracksData.items) {
        // 이 트랙에서 아티스트Id와 함께 나온 다른 아티스트들 = 피처링
        const coArtists = track.artists.filter((a) => a.id !== artistId && !a.id.startsWith("mb_"));

        for (const coArtist of coArtists) {
          if (!coArtist.id) continue;

          // coAppearance 카운트 증가
          if (!coAppearanceCount[artistId]) coAppearanceCount[artistId] = {};
          coAppearanceCount[artistId][coArtist.id] = (coAppearanceCount[artistId][coArtist.id] || 0) + 1;

          // 기존에 모르던 아티스트라면 메타데이터 수집
          if (!knownArtists.has(coArtist.id) && !newArtists.has(coArtist.id)) {
            const artistMeta = await spotifyGet<SpotifyArtist>(
              `/artists/${coArtist.id}`,
              `artist_meta_${coArtist.id}`
            );
            if (artistMeta) {
              newArtists.set(coArtist.id, artistMeta);
              console.log(`    ✨ 신규 발견: ${coArtist.name} (${coArtist.id})`);
            }
          }
        }
      }
    }

    // 이 아티스트의 coAppearance → FEATURED 엣지로 변환
    for (const [targetId, count] of Object.entries(coAppearanceCount[artistId] || {})) {
      const targetName = newArtists.get(targetId)?.name || knownArtists.get(targetId) || "Unknown";

      // 이미 동일한 source→target 엣지가 없을 때만 추가
      const existingEdge = featuredEdges.find((e) => e.source === artistId && e.target === targetId);
      if (!existingEdge) {
        featuredEdges.push({
          source: artistId,
          target: targetId,
          targetName,
          songName: "앨범 트랙 크레딧", // 개별 곡명 추적은 Phase 5로 이동
          relation: "FEATURED",
          weight: Math.min(count / 10, 1.0),
        });
      }
    }

    // 진행도 저장 (아티스트 1명 완료마다)
    completedSet.add(artistId);
    progress.completedIds = [...completedSet];
    progress.apiCallCount = apiCallCount;
    saveProgress(progress);

    // 중간 결과 저장 (스크립트 죽어도 보존)
    fs.writeFileSync(EDGES_OUT, JSON.stringify(featuredEdges, null, 2), "utf-8");
    fs.writeFileSync(ARTISTS_OUT, JSON.stringify([...newArtists.values()], null, 2), "utf-8");
  }

  // ── 5. 최종 결과 및 DoD 검증 ─────────────────────────────────
  console.log("\n════════════════════════════════════════════════════");
  console.log("  📊 크롤링 완료 — DoD 검증");
  console.log("════════════════════════════════════════════════════");

  const dod1 = featuredEdges.length >= 100;
  const dod2 = newArtists.size >= 80;

  // Fallback 재발 감지: 하나의 아티스트가 전체 엣지의 50% 이상에 등장하면 의심
  const targetCount: Record<string, number> = {};
  featuredEdges.forEach((e) => { targetCount[e.target] = (targetCount[e.target] || 0) + 1; });
  const topTarget = Object.entries(targetCount).sort((a, b) => b[1] - a[1])[0];
  const fallbackRatio = topTarget ? topTarget[1] / featuredEdges.length : 0;
  const dod3 = fallbackRatio < 0.5;

  console.log(`  FEATURED 엣지 ≥ 100:   ${dod1 ? "✅ PASS" : "❌ FAIL"} (${featuredEdges.length}개)`);
  console.log(`  신규 아티스트 ≥ 80:    ${dod2 ? "✅ PASS" : "❌ FAIL"} (${newArtists.size}명)`);
  console.log(`  Fallback 재발 없음:    ${dod3 ? "✅ PASS" : "❌ FAIL"} (최다 등장: ${topTarget?.[0]} ${(fallbackRatio * 100).toFixed(1)}%)`);
  console.log(`  총 API 호출 수:        ${apiCallCount}/${MAX_API_CALLS}회`);
  console.log(`  완료된 아티스트:       ${completedSet.size}/${crawlTargets.length}명`);
  console.log(`  결과 파일:`);
  console.log(`    - ${EDGES_OUT}`);
  console.log(`    - ${ARTISTS_OUT}`);

  if (dod1 && dod2 && dod3) {
    console.log("\n  🎉 Task 1-2 완료! 다음: Task 2-1 (빌드 스크립트 재작성)");
  } else if (completedSet.size < crawlTargets.length) {
    console.log("\n  ⏸  API 한도 도달로 중단. 스크립트를 다시 실행하면 이어서 진행됩니다.");
  } else {
    console.log("\n  ⚠️  일부 DoD 조건 미충족. 데이터를 검토하세요.");
  }
  console.log("════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("[crawl-featured-credits] 치명적 에러:", err);
  process.exit(1);
});
