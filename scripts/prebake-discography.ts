/**
 * 📅 V5.3 Gap 보강 — 앨범 발매일 Prebake (Gap 1)
 *
 * 문제: getArtistDiscography() 함수는 있지만 실행 안 됨
 *       → public/data/releases/ 디렉토리 미존재
 *
 * 해결: 허브 62명 + 위성 아티스트(Spotify ID 보유)에 대해
 *       MusicBrainz Release Group 기반 앨범 발매일 수집
 *
 * 출력: public/data/releases/{spotifyId}.json
 *       (ArtistDiscography 인터페이스와 일치)
 *
 * 재개 가능: 이미 파일이 있으면 SKIP
 *
 * 실행: npx tsx scripts/prebake-discography.ts
 */

import * as fs from "fs";
import * as path from "path";

require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

import { searchArtistMBID, getArtistDiscography } from "../src/lib/musicbrainz";
import { HUB_ARTISTS } from "../src/data/hub-artists";

// ─── 경로 상수 ────────────────────────────────────────────────────
const MB_CACHE_DIR  = path.resolve(__dirname, ".cache/mb");
const OUT_DIR       = path.resolve(__dirname, "../public/data/releases");
const LAYOUT_PATH   = path.resolve(__dirname, "../public/data/v5-layout.json");

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

function log(idx: number, total: number, name: string, msg: string) {
  const pct = Math.round((idx / total) * 100);
  console.log(`  [${idx}/${total}] (${pct}%) ${name} — ${msg}`);
}

// ─── 메인 ────────────────────────────────────────────────────────
async function main() {
  ensureDir(OUT_DIR);
  ensureDir(MB_CACHE_DIR);

  console.log("════════════════════════════════════════════════════");
  console.log("  📅 V5.3 Gap 보강: 앨범 발매일 Prebake");
  console.log("════════════════════════════════════════════════════\n");

  // 대상 아티스트 수집
  // 1) 허브 아티스트 62명
  // 2) v5-layout.json의 위성 중 Spotify ID 있는 것 (mb_ 제외)
  type Target = { spotifyId: string; name: string };
  const targets: Target[] = [];
  const seen = new Set<string>();

  // 허브 우선
  for (const h of HUB_ARTISTS) {
    if (!seen.has(h.spotifyId)) {
      targets.push({ spotifyId: h.spotifyId, name: h.name });
      seen.add(h.spotifyId);
    }
  }

  // v5-layout.json에서 위성 아티스트
  if (fs.existsSync(LAYOUT_PATH)) {
    const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, "utf-8"));
    for (const node of layout.nodes ?? []) {
      if (!node.id.startsWith("mb_") && !seen.has(node.id)) {
        targets.push({ spotifyId: node.id, name: node.name });
        seen.add(node.id);
      }
    }
  }

  console.log(`  총 대상: ${targets.length}명 (허브 ${HUB_ARTISTS.length}명 + 위성 ${targets.length - HUB_ARTISTS.length}명)`);
  const alreadyDone = targets.filter((t) => fs.existsSync(path.join(OUT_DIR, `${t.spotifyId}.json`))).length;
  console.log(`  이미 완료: ${alreadyDone}명 (SKIP 예정)`);
  console.log(`  예상 시간: ${targets.length - alreadyDone}명 × ~5초 ≈ ${Math.ceil((targets.length - alreadyDone) * 5 / 60)}분\n`);

  let success = 0, skipped = 0, failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const { spotifyId, name } = targets[i];
    const outPath = path.join(OUT_DIR, `${spotifyId}.json`);

    // SKIP: 이미 파일 있으면
    if (fs.existsSync(outPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(outPath, "utf-8"));
        if (existing.albums) {
          log(i + 1, targets.length, name, `✅ SKIP (${existing.albums.length}개 앨범)`);
          skipped++;
          continue;
        }
      } catch { /* 파일 손상 → 재시도 */ }
    }

    log(i + 1, targets.length, name, "앨범 발매일 수집 중...");

    // MBID 검색 (캐시 우선)
    const mbidKey = "mbid_" + name.replace(/[^a-zA-Z0-9가-힣]/g, "_");
    let mbid = mbCacheGet<string | null>(mbidKey);
    if (mbid === null) {
      mbid = await searchArtistMBID(name);
      mbCacheSet(mbidKey, mbid);
      await sleep(1200);
    }

    if (!mbid) {
      log(i + 1, targets.length, name, "⚠️ MBID 없음 — 빈 파일 저장");
      fs.writeFileSync(outPath, JSON.stringify({
        spotifyId, name, mbid: null, albums: [],
        lastUpdated: new Date().toISOString()
      }, null, 2), "utf-8");
      failed++;
      continue;
    }

    try {
      // 앨범 발매일 캐시 키
      const discoKey = "disco_" + mbid;
      let discography = mbCacheGet<any>(discoKey);

      if (!discography) {
        discography = await getArtistDiscography(spotifyId, name, mbid);
        mbCacheSet(discoKey, discography);
        await sleep(1200);
      }

      fs.writeFileSync(outPath, JSON.stringify(discography, null, 2), "utf-8");
      log(i + 1, targets.length, name, `✅ 완료 (${discography.albums?.length ?? 0}개 앨범)`);
      success++;
    } catch (err: any) {
      log(i + 1, targets.length, name, `❌ 에러 — ${err.message}`);
      // 빈 파일 저장하여 재시도 막기
      fs.writeFileSync(outPath, JSON.stringify({
        spotifyId, name, mbid, albums: [],
        lastUpdated: new Date().toISOString()
      }, null, 2), "utf-8");
      failed++;
    }

    // 마지막 아티스트가 아니면 대기
    if (i < targets.length - 1 && !fs.existsSync(path.join(OUT_DIR, `${targets[i+1].spotifyId}.json`))) {
      await sleep(1500);
    }
  }

  // ── 최종 리포트 ────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════════");
  console.log("  📊 Prebake 완료 — 리포트");
  console.log(`  ✅ 성공: ${success}명`);
  console.log(`  ⏭  스킵: ${skipped}명 (이미 존재)`);
  console.log(`  ❌ 실패: ${failed}명 (MBID 없음 or API 에러)`);
  console.log(`  📁 저장 위치: public/data/releases/`);

  // 총 앨범 수 집계
  const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".json"));
  let totalAlbums = 0;
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), "utf-8"));
      totalAlbums += d.albums?.length ?? 0;
    } catch { /* ignore */ }
  }
  console.log(`  🎵 총 수집 앨범: ${totalAlbums}개 (${files.length}명)`);
  console.log("════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("[prebake-discography] 치명적 에러:", err);
  process.exit(1);
});
