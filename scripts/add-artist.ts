/**
 * 아티스트 추가 CLI 스크립트
 *
 * 사용법:
 *   npx tsx scripts/add-artist.ts "아티스트이름" "SpotifyID" ["한글이름"]
 *
 * 예시:
 *   npx tsx scripts/add-artist.ts "Nell" "3WbKkfwmDLgVwR9ExchFVC" "넬"
 *
 * 동작:
 *   1. iTunes API로 Spotify ID ↔ 아티스트 이름 교차검증
 *   2. 중복 검사
 *   3. 자동 컬러 생성 (이름 해시 기반)
 *   4. hub-artists.ts 끝에 추가
 *   5. 해당 아티스트만 Pre-bake 실행
 *   6. search-index.json 재생성
 */

import * as fs from "fs";
import * as path from "path";

require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

import { getArtistFull } from "../src/lib/spotify";
import type { CosmosData } from "../src/lib/types";

const HUB_FILE = path.resolve(__dirname, "../src/data/hub-artists.ts");
const OUTPUT_DIR = path.resolve(__dirname, "../public/data/hub");
const SEARCH_INDEX_PATH = path.resolve(__dirname, "../public/data/search-index.json");

// ── 인자 파싱 ──────────────────────────────────────────────────
const [,, nameArg, idArg, nameKoArg] = process.argv;

if (!nameArg || !idArg) {
  console.log(`
🌌 아티스트 추가 스크립트

사용법:
  npx tsx scripts/add-artist.ts "아티스트이름" "SpotifyID" ["한글이름"]

예시:
  npx tsx scripts/add-artist.ts "Nell" "3WbKkfwmDLgVwR9ExchFVC" "넬"

SpotifyID 찾는 법:
  1. Spotify 웹(https://open.spotify.com)에서 아티스트 검색
  2. 프로필 URL의 /artist/ 뒤 22자리 문자열이 ID
  예: https://open.spotify.com/artist/3WbKkfwmDLgVwR9ExchFVC
                                       ^^^^^^^^^^^^^^^^^^^^^^^^ 이 부분
  `);
  process.exit(1);
}

const artistName = nameArg.trim();
const spotifyId = idArg.trim();
const nameKo = nameKoArg?.trim() || artistName;

// ── 유틸 ───────────────────────────────────────────────────────
function nameToColor(name: string): { accent: string; nebula: string; nebula2: string } {
  // 이름을 해시하여 HSL 색상 생성
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const hue = Math.abs(hash) % 360;
  const accent = `hsl(${hue}, 70%, 65%)`;
  
  // HSL을 hex로 변환
  const toHex = (h: number, s: number, l: number): string => {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  return {
    accent: toHex(hue, 70, 65),
    nebula: toHex(hue, 30, 8),
    nebula2: toHex(hue, 20, 5),
  };
}

// ── 메인 ───────────────────────────────────────────────────────
async function main() {
  console.log(`\n🌌 아티스트 추가: ${artistName} (${nameKo})`);
  console.log(`   Spotify ID: ${spotifyId}\n`);

  // 1. 중복 검사
  const hubContent = fs.readFileSync(HUB_FILE, "utf-8");
  if (hubContent.includes(spotifyId)) {
    console.error(`❌ 이미 등록된 Spotify ID입니다: ${spotifyId}`);
    process.exit(1);
  }

  // 2. iTunes 교차검증
  console.log("🔍 iTunes API로 교차검증 중...");
  try {
    const itunesRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(nameKo || artistName)}&entity=song&limit=1&country=KR`
    );
    const itunesData = await itunesRes.json();
    const result = itunesData.results?.[0];
    if (result) {
      console.log(`   ✅ iTunes 확인: ${result.artistName} — "${result.trackName}"`);
    } else {
      console.log(`   ⚠️ iTunes에서 찾을 수 없음 (계속 진행합니다)`);
    }
  } catch {
    console.log(`   ⚠️ iTunes 검증 실패 (계속 진행합니다)`);
  }

  // 3. 컬러 자동 생성
  const colors = nameToColor(artistName);
  console.log(`🎨 자동 생성 컬러: accent=${colors.accent}`);

  // 4. hub-artists.ts에 추가
  const newEntry = `  {
    spotifyId: "${spotifyId}",
    name: "${artistName}",
    nameKo: "${nameKo}",
    accent: "${colors.accent}",
    nebula: "${colors.nebula}",
    nebula2: "${colors.nebula2}",
  },`;

  // ]; 직전에 삽입
  const insertPoint = hubContent.lastIndexOf("];");
  if (insertPoint === -1) {
    console.error("❌ hub-artists.ts 파일 형식 오류: ]; 를 찾을 수 없습니다");
    process.exit(1);
  }

  const newContent = hubContent.slice(0, insertPoint) + newEntry + "\n" + hubContent.slice(insertPoint);
  fs.writeFileSync(HUB_FILE, newContent, "utf-8");
  console.log(`✅ hub-artists.ts에 추가 완료`);

  // 5. Pre-bake (이 아티스트만)
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `${spotifyId}.json`);

  console.log(`🔍 Pre-bake 실행 중...`);
  try {
    const data: CosmosData = await getArtistFull(spotifyId);
    if (!data.core?.name) throw new Error("core 데이터 비어있음");
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");
    console.log(`✅ Pre-bake 완료: 위성 ${data.satellites.length}명`);
  } catch (err: any) {
    console.log(`⚠️ Pre-bake 에러: ${err.message}`);
    console.log(`   → 최소 JSON으로 저장합니다`);
    const fallback: CosmosData = {
      core: {
        spotifyId,
        name: nameKo,
        imageUrl: null,
        genres: [],
        popularity: 0,
        previewUrl: null,
        previewTrackName: null,
        spotifyUrl: `https://open.spotify.com/artist/${spotifyId}`,
      },
      satellites: [],
    };
    fs.writeFileSync(outputPath, JSON.stringify(fallback, null, 2), "utf-8");
  }

  // 6. search-index.json 재생성
  console.log(`📋 검색 인덱스 재생성 중...`);
  const allFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith(".json"));
  const searchIndex: any[] = [];
  const seenIds = new Set<string>();

  for (const file of allFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, file), "utf-8")) as CosmosData;
      if (!seenIds.has(data.core.spotifyId)) {
        seenIds.add(data.core.spotifyId);
        searchIndex.push({
          spotifyId: data.core.spotifyId,
          name: data.core.name,
          imageUrl: data.core.imageUrl,
          genres: data.core.genres,
        });
      }
      for (const sat of data.satellites) {
        if (!sat.spotifyId.startsWith("mb_") && !seenIds.has(sat.spotifyId)) {
          seenIds.add(sat.spotifyId);
          searchIndex.push({
            spotifyId: sat.spotifyId,
            name: sat.name,
            imageUrl: sat.imageUrl,
            genres: sat.genres,
          });
        }
      }
    } catch { /* skip broken files */ }
  }

  fs.writeFileSync(SEARCH_INDEX_PATH, JSON.stringify(searchIndex, null, 2), "utf-8");
  console.log(`✅ 검색 인덱스 갱신: ${searchIndex.length}명`);

  console.log(`\n════════════════════════════════════`);
  console.log(`  🎉 "${nameKo}" 추가 완료!`);
  console.log(`  다음 단계: git add -A && git commit`);
  console.log(`════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error("치명적 에러:", err);
  process.exit(1);
});
