/**
 * 🔭 V5.3 Phase 1 — Task 1-2: MusicBrainz 크레딧 기반 2촌 확장 크롤러
 *
 * 변경 이유 (Spotify → MusicBrainz):
 *   - Spotify GET /artists/{id}/albums → 2024.11 이후 Dev Mode에서 403 차단 확정
 *   - MusicBrainz: 무료, 오픈소스, 음악 크레딧 DB로서 피처링/협업 정보 더욱 정확
 *   - 기존 scripts/.cache/mb/ 캐시 재사용 가능 → 대기 시간 단축
 *
 * 설계:
 *   ① 재개 가능 (Resume): .cache/crawl-progress.json으로 진행도 저장
 *   ② MusicBrainz 캐시 우선: scripts/.cache/mb/ 파일 재사용
 *   ③ Rate Limit 준수: 1.2초 간격
 *   ④ Spotify Search: MB 아티스트명 → Spotify ID/이미지 확보 시도
 *
 * 출력:
 *   scripts/.cache/featured-edges.json   — 새로 발견된 관계 엣지
 *   scripts/.cache/new-artists.json      — 신규 아티스트 메타
 *
 * 실행: npm run v5:crawl-credits
 *
 * DoD:
 *   ✅ 새 엣지 발견
 *   ✅ 신규 유니크 아티스트 발견
 *   ✅ FALLBACK 재발 없음 (단일 아티스트가 50% 이상 등장 안 함)
 */

import * as fs from "fs";
import * as path from "path";

require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

import { searchArtistMBID, getArtistRelations } from "../src/lib/musicbrainz";
import { HUB_ARTISTS } from "../src/data/hub-artists";

// ─── 경로 상수 ────────────────────────────────────────────────────
const MB_CACHE_DIR  = path.resolve(__dirname, ".cache/mb");
const PROGRESS_FILE = path.resolve(__dirname, ".cache/crawl-progress.json");
const EDGES_OUT     = path.resolve(__dirname, ".cache/featured-edges.json");
const ARTISTS_OUT   = path.resolve(__dirname, ".cache/new-artists.json");

// ─── 타입 ────────────────────────────────────────────────────────
interface NewArtist {
  mbid: string;
  name: string;
  spotifyId?: string;
  image?: string | null;
}

interface DiscoveredEdge {
  source: string;    // 허브 Spotify ID
  sourceName: string;
  target: string;    // 대상 MB ID (나중에 Spotify ID로 교체 가능)
  targetName: string;
  relation: "FEATURED" | "INDIRECT";
  weight: number;
}

interface Progress {
  completedIds: string[];
  lastUpdated: string;
}

// ─── 유틸 ────────────────────────────────────────────────────────
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function ensureDir(dir: string) { fs.mkdirSync(dir, { recursive: true }); }

function mbCacheGet<T>(key: string): T | null {
  const p = path.join(MB_CACHE_DIR, `${key}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function mbCacheSet(key: string, data: unknown) {
  ensureDir(MB_CACHE_DIR);
  fs.writeFileSync(path.join(MB_CACHE_DIR, `${key}.json`), JSON.stringify(data), "utf-8");
}

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  return { completedIds: [], lastUpdated: "" };
}

function saveProgress(p: Progress) {
  ensureDir(path.dirname(PROGRESS_FILE));
  p.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2), "utf-8");
}

// Spotify Search로 아티스트명 → ID/이미지 매핑 시도 (실패해도 OK)
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

async function trySpotifySearch(name: string): Promise<{ id: string; image: string | null } | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    if (!_cachedToken || Date.now() > _tokenExpiresAt - 60_000) {
      const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
      });
      const td = await tokenRes.json();
      _cachedToken = td.access_token;
      _tokenExpiresAt = Date.now() + td.expires_in * 1000;
    }

    const q = encodeURIComponent(name);
    const res = await fetch(`https://api.spotify.com/v1/search?type=artist&q=${q}&limit=3&market=KR`, {
      headers: { Authorization: `Bearer ${_cachedToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const artist = data.artists?.items?.[0];
    if (!artist) return null;
    return { id: artist.id, image: artist.images?.[0]?.url ?? null };
  } catch {
    return null;
  }
}

// ─── 메인 ────────────────────────────────────────────────────────
async function main() {
  ensureDir(MB_CACHE_DIR);

  console.log("════════════════════════════════════════════════════");
  console.log("  🔭 V5.3 Task 1-2: MusicBrainz 크레딧 2촌 크롤러");
  console.log("════════════════════════════════════════════════════");

  // 기존 결과 로드
  const discoveredEdges: DiscoveredEdge[] = fs.existsSync(EDGES_OUT)
    ? JSON.parse(fs.readFileSync(EDGES_OUT, "utf-8")) : [];
  const newArtists = new Map<string, NewArtist>(
    fs.existsSync(ARTISTS_OUT)
      ? JSON.parse(fs.readFileSync(ARTISTS_OUT, "utf-8")).map((a: NewArtist) => [a.mbid, a])
      : []
  );

  const progress = loadProgress();
  const completedSet = new Set(progress.completedIds);
  const knownHubNames = new Set(HUB_ARTISTS.map((h) => h.name.toLowerCase()));
  const targets = HUB_ARTISTS.filter((h) => !completedSet.has(h.spotifyId));

  console.log(`  허브 아티스트: ${HUB_ARTISTS.length}명`);
  console.log(`  이미 완료: ${completedSet.size}명`);
  console.log(`  남은 크롤 대상: ${targets.length}명`);
  console.log(`  기존 발견 엣지: ${discoveredEdges.length}개`);
  console.log(`  기존 신규 아티스트: ${newArtists.size}명\n`);

  let processed = 0;

  for (const hub of targets) {
    processed++;
    const totalDone = completedSet.size + processed;
    console.log(`\n  🔍 [${totalDone}/${HUB_ARTISTS.length}] ${hub.name}`);

    // MBID 검색 (캐시 우선)
    const mbidKey = "mbid_" + hub.name.replace(/[^a-zA-Z0-9가-힣]/g, "_");
    let mbid = mbCacheGet<string | null>(mbidKey);
    if (mbid === null) {
      // 캐시 미스: 실제 검색
      console.log(`    MBID 검색 중...`);
      mbid = await searchArtistMBID(hub.name);
      mbCacheSet(mbidKey, mbid);
      await sleep(1200);
    }

    if (!mbid) {
      console.log(`    ⚠️  MBID 없음 — 건너뜀`);
      completedSet.add(hub.spotifyId);
      progress.completedIds = [...completedSet];
      saveProgress(progress);
      continue;
    }

    console.log(`    MB ID: ${mbid}`);

    // 아티스트 관계 조회 (캐시 우선)
    const relsKey = "rels_" + mbid;
    let rels = mbCacheGet<{ name: string; mbid: string; role: string; count: number }[]>(relsKey);
    if (!rels) {
      console.log(`    관계 조회 중...`);
      rels = await getArtistRelations(mbid);
      mbCacheSet(relsKey, rels);
      await sleep(1200);
    }

    console.log(`    MB 관계: ${rels.length}개`);

    // 관계 → 엣지 변환
    for (const rel of rels) {
      if (knownHubNames.has(rel.name.toLowerCase())) continue; // 허브↔허브는 build 스크립트가 처리

      const existing = discoveredEdges.find(
        (e) => e.source === hub.spotifyId && e.target === rel.mbid
      );
      if (existing) continue;

      const relation = rel.role === "member" || rel.role === "group" ? "FEATURED" : "INDIRECT";

      discoveredEdges.push({
        source: hub.spotifyId,
        sourceName: hub.name,
        target: rel.mbid,
        targetName: rel.name,
        relation,
        weight: Math.min(rel.count / 5, 1.0),
      });

      // 신규 아티스트 등록
      if (!newArtists.has(rel.mbid)) {
        console.log(`    ✨ 신규: ${rel.name}`);
        const sp = await trySpotifySearch(rel.name);
        await sleep(300);
        newArtists.set(rel.mbid, {
          mbid: rel.mbid,
          name: rel.name,
          spotifyId: sp?.id,
          image: sp?.image ?? null,
        });
      }
    }

    // 중간 저장
    completedSet.add(hub.spotifyId);
    progress.completedIds = [...completedSet];
    saveProgress(progress);
    fs.writeFileSync(EDGES_OUT, JSON.stringify(discoveredEdges, null, 2), "utf-8");
    fs.writeFileSync(ARTISTS_OUT, JSON.stringify([...newArtists.values()], null, 2), "utf-8");
    console.log(`    ✅ 완료 (누적 엣지: ${discoveredEdges.length}, 신규: ${newArtists.size}명)`);
  }

  // ── DoD 검증 ─────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════════");
  console.log("  📊 크롤링 완료 — DoD 검증");

  const targetCount: Record<string, number> = {};
  discoveredEdges.forEach((e) => { targetCount[e.targetName] = (targetCount[e.targetName] || 0) + 1; });
  const top5 = Object.entries(targetCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const ratio = top5[0] ? top5[0][1] / Math.max(discoveredEdges.length, 1) : 0;

  console.log(`  새 엣지: ${discoveredEdges.length}개  ${discoveredEdges.length > 0 ? "✅" : "❌"}`);
  console.log(`  신규 아티스트: ${newArtists.size}명  ${newArtists.size > 0 ? "✅" : "❌"}`);
  console.log(`  Fallback 재발 없음: ${ratio < 0.5 ? "✅" : "❌"} (최다: ${top5[0]?.[0]} ${(ratio * 100).toFixed(1)}%)`);
  console.log(`  완료율: ${completedSet.size}/${HUB_ARTISTS.length}명`);

  if (completedSet.size < HUB_ARTISTS.length) {
    console.log("\n  ⏸  API 한도 또는 중단. 재실행 시 이어서 진행됩니다.");
  } else {
    console.log("\n  🎉 Task 1-2 완료! 다음: Task 2-1 (빌드 스크립트 재작성)");
  }
  console.log("════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("[crawl] 치명적 에러:", err);
  process.exit(1);
});
