/**
 * K-Culture Universe — Safe Pre-bake 스크립트
 *
 * 허브 아티스트 15명의 CosmosData를 JSON으로 구워 public/data/hub/ 에 저장합니다.
 *
 * 핵심 안전 규칙:
 *  1) 절대 병렬(Promise.all) 처리 없음 — 항상 직렬(순차) 처리
 *  2) 아티스트 1명 완료 후 8초 대기 (MusicBrainz 1req/s + 넉넉한 마진)
 *  3) 이미 성공한 JSON이 존재하면 SKIP (재시작 가능)
 *  4) 에러 발생 시 빈 satellites로 최소 JSON 저장 후 계속 진행
 *  5) 스크립트 중단 시 다음 실행에서 이어붓기 가능
 *
 * 실행 방법:
 *   npx tsx scripts/prebake.ts
 */

import * as fs from "fs";
import * as path from "path";

// dotenv 로드 (SPOTIFY_, GENIUS_ 환경변수)
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

import { HUB_ARTISTS } from "../src/data/hub-artists";
import { getArtistFull } from "../src/lib/spotify";
import type { CosmosData } from "../src/lib/types";

// ── 설정 ─────────────────────────────────────────────────────────────
const OUTPUT_DIR = path.resolve(__dirname, "../public/data/hub");
const SEARCH_INDEX_PATH = path.resolve(__dirname, "../public/data/search-index.json");
const DELAY_BETWEEN_ARTISTS_MS = 8000; // 8초 대기 (MusicBrainz Rate Limit 방어)

// ── 유틸 ─────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function progress(current: number, total: number, name: string, msg: string) {
  const pct = Math.round((current / total) * 100);
  console.log(`[${current}/${total}] (${pct}%) ${name} — ${msg}`);
}

// ── 메인 ─────────────────────────────────────────────────────────────
async function main() {
  console.log("🌌 K-Culture Universe Pre-bake 스크립트 시작");
  console.log(`   출력 경로: ${OUTPUT_DIR}`);
  console.log(`   대상 아티스트: ${HUB_ARTISTS.length}명`);
  console.log(`   아티스트 간 대기시간: ${DELAY_BETWEEN_ARTISTS_MS / 1000}초\n`);

  // 출력 디렉토리 생성
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const results: { name: string; success: boolean; satelliteCount: number }[] = [];

  for (let i = 0; i < HUB_ARTISTS.length; i++) {
    const hub = HUB_ARTISTS[i];
    const outputPath = path.join(OUTPUT_DIR, `${hub.spotifyId}.json`);

    // [안전 규칙 3] 이미 성공한 JSON이 있으면 SKIP
    if (fs.existsSync(outputPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as CosmosData;
        if (existing.core && existing.core.name) {
          progress(i + 1, HUB_ARTISTS.length, hub.name, `✅ SKIP (이미 존재, 위성 ${existing.satellites.length}명)`);
          results.push({ name: hub.name, success: true, satelliteCount: existing.satellites.length });
          continue;
        }
      } catch {
        // 파일이 깨진 경우 재시도
        progress(i + 1, HUB_ARTISTS.length, hub.name, "⚠️ 기존 파일 손상 — 재시도");
      }
    }

    progress(i + 1, HUB_ARTISTS.length, hub.name, "🔍 데이터 수집 중...");

    try {
      const data: CosmosData = await getArtistFull(hub.spotifyId);

      // 최소 유효성 검사
      if (!data.core || !data.core.name) {
        throw new Error("core 데이터가 비어 있습니다");
      }

      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");
      progress(i + 1, HUB_ARTISTS.length, hub.name, `✅ 완료 (위성 ${data.satellites.length}명)`);
      results.push({ name: hub.name, success: true, satelliteCount: data.satellites.length });

    } catch (err: any) {
      // [안전 규칙 4] 에러가 나도 최소 JSON 저장 후 계속 진행
      progress(i + 1, HUB_ARTISTS.length, hub.name, `❌ 에러 — ${err.message}`);
      console.log(`   → 빈 satellites로 최소 JSON 저장 후 계속 진행합니다.`);

      const fallbackData: CosmosData = {
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

      fs.writeFileSync(outputPath, JSON.stringify(fallbackData, null, 2), "utf-8");
      results.push({ name: hub.name, success: false, satelliteCount: 0 });
    }

    // [안전 규칙 1+2] 마지막 아티스트가 아니면 대기
    if (i < HUB_ARTISTS.length - 1) {
      progress(i + 1, HUB_ARTISTS.length, hub.name, `⏳ ${DELAY_BETWEEN_ARTISTS_MS / 1000}초 대기 중...`);
      await sleep(DELAY_BETWEEN_ARTISTS_MS);
    }
  }

  // ── 검색 인덱스 생성 ─────────────────────────────────────────────
  console.log("\n📋 검색 인덱스(search-index.json) 생성 중...");
  const searchIndex: { spotifyId: string; name: string; nameKo?: string; imageUrl: string | null; genres: string[] }[] = [];
  const seenIds = new Set<string>();

  for (const hub of HUB_ARTISTS) {
    const filePath = path.join(OUTPUT_DIR, `${hub.spotifyId}.json`);
    if (!fs.existsSync(filePath)) continue;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as CosmosData;

      // 허브 아티스트 자신 추가
      if (!seenIds.has(data.core.spotifyId)) {
        seenIds.add(data.core.spotifyId);
        searchIndex.push({
          spotifyId: data.core.spotifyId,
          name: data.core.name,
          nameKo: hub.nameKo,
          imageUrl: data.core.imageUrl,
          genres: data.core.genres,
        });
      }

      // 위성 아티스트 추가 (실제 Spotify ID 가진 것만 — mb_ 접두사 제외)
      for (const satellite of data.satellites) {
        if (!satellite.spotifyId.startsWith("mb_") && !seenIds.has(satellite.spotifyId)) {
          seenIds.add(satellite.spotifyId);
          searchIndex.push({
            spotifyId: satellite.spotifyId,
            name: satellite.name,
            imageUrl: satellite.imageUrl,
            genres: satellite.genres,
          });
        }
      }
    } catch {
      // 파일 파싱 실패 시 스킵
    }
  }

  fs.writeFileSync(SEARCH_INDEX_PATH, JSON.stringify(searchIndex, null, 2), "utf-8");
  console.log(`✅ 검색 인덱스 생성 완료 — ${searchIndex.length}명 등록\n`);

  // ── 최종 리포트 ────────────────────────────────────────────────
  console.log("═══════════════════════════════════════");
  console.log("         Pre-bake 완료 리포트");
  console.log("═══════════════════════════════════════");
  for (const r of results) {
    const icon = r.success ? "✅" : "❌";
    console.log(`  ${icon} ${r.name.padEnd(15)} 위성 ${r.satelliteCount}명`);
  }
  const successCount = results.filter((r) => r.success).length;
  console.log("───────────────────────────────────────");
  console.log(`  성공: ${successCount}/${HUB_ARTISTS.length}명`);
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error("Pre-bake 스크립트 치명적 에러:", err);
  process.exit(1);
});
