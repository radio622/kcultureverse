/**
 * 🎼 V5.3 Gap 보강 — 전곡 크레딧 크롤러 (WRITER/PRODUCER 엣지)
 *
 * 문제: 현재 crawl-featured-credits.ts는 getArtistRelations()만 사용
 *       → WRITER 엣지가 0개 (작곡/작사 관계 미수집)
 *
 * 해결: getComprehensiveCredits()를 사용하여
 *   Release Group → Release → Track → Recording rels + Work rels (작곡/작사)
 *   파이프라인으로 앨범당 최대 5트랙씩 스캔
 *
 * 처리량: 허브 62명 × 3분 = 약 3시간 (1req/s 준수)
 * 재개 가능: .cache/writer-progress.json으로 진행 상태 저장
 *
 * 출력:
 *   scripts/.cache/writer-edges.json   — WRITER/PRODUCER 엣지
 *   scripts/.cache/writer-artists.json — 신규 아티스트
 *
 * 실행: npx tsx scripts/crawl-writer-credits.ts
 */

import * as fs from "fs";
import * as path from "path";

require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

import { searchArtistMBID, getComprehensiveCredits } from "../src/lib/musicbrainz";
import { HUB_ARTISTS } from "../src/data/hub-artists";

// ─── 경로 상수 ────────────────────────────────────────────────────
const MB_CACHE_DIR    = path.resolve(__dirname, ".cache/mb");
const PROGRESS_FILE   = path.resolve(__dirname, ".cache/writer-progress.json");
const EDGES_OUT       = path.resolve(__dirname, ".cache/writer-edges.json");
const ARTISTS_OUT     = path.resolve(__dirname, ".cache/writer-artists.json");

// ─── 타입 ────────────────────────────────────────────────────────
interface WriterEdge {
  source: string;       // 허브 Spotify ID
  sourceName: string;
  targetMbid: string;   // 크레딧 아티스트 MB ID
  targetName: string;
  relation: "WRITER" | "PRODUCER";
  role: string;         // "composer" | "lyricist" | "producer" | "arranger"
  count: number;        // 몇 곡에 참여했는지
  weight: number;       // 0.1 ~ 1.0
}

interface WriterArtist {
  mbid: string;
  name: string;
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

function calcWeight(count: number, role: string): number {
  // 역할별 기본 가중치 × 참여곡수 스케일
  const base = role === "composer" || role === "lyricist" ? 0.7 : 0.6;
  return Math.min(base + (count - 1) * 0.05, 1.0);
}

// ─── 메인 ────────────────────────────────────────────────────────
async function main() {
  ensureDir(MB_CACHE_DIR);

  console.log("════════════════════════════════════════════════════");
  console.log("  🎼 V5.3 Gap 보강: 전곡 크레딧 크롤러 (WRITER 엣지)");
  console.log("════════════════════════════════════════════════════");

  // 기존 결과 로드
  const edges: WriterEdge[] = fs.existsSync(EDGES_OUT)
    ? JSON.parse(fs.readFileSync(EDGES_OUT, "utf-8"))
    : [];
  const artistMap = new Map<string, WriterArtist>(
    fs.existsSync(ARTISTS_OUT)
      ? JSON.parse(fs.readFileSync(ARTISTS_OUT, "utf-8")).map((a: WriterArtist) => [a.mbid, a])
      : []
  );

  const progress = loadProgress();
  const completedSet = new Set(progress.completedIds);
  const targets = HUB_ARTISTS.filter((h) => !completedSet.has(h.spotifyId));

  console.log(`  허브 아티스트: ${HUB_ARTISTS.length}명`);
  console.log(`  이미 완료: ${completedSet.size}명`);
  console.log(`  남은 크롤 대상: ${targets.length}명`);
  console.log(`  기존 발견 엣지: ${edges.length}개`);
  console.log(`  기존 신규 아티스트: ${artistMap.size}명\n`);
  console.log(`  ⏱  예상 시간: 아티스트당 약 3분 (MusicBrainz 1req/s)`);
  console.log(`  ⏱  총 예상: ${targets.length}명 × 3분 ≈ ${Math.ceil(targets.length * 3)}분\n`);

  let processed = 0;

  for (const hub of targets) {
    processed++;
    const totalDone = completedSet.size + processed;
    const startTime = Date.now();
    console.log(`\n  🔍 [${totalDone}/${HUB_ARTISTS.length}] ${hub.name} (${hub.nameKo})`);

    // MBID 검색 (캐시 우선)
    const mbidKey = "mbid_" + hub.name.replace(/[^a-zA-Z0-9가-힣]/g, "_");
    let mbid = mbCacheGet<string | null>(mbidKey);
    if (mbid === null) {
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

    // 전곡 크레딧 (캐시 키: writer_comprehensive_{mbid})
    const credKey = "writer_comprehensive_" + mbid;
    let credits = mbCacheGet<{ name: string; mbid: string; role: string; count: number }[]>(credKey);
    if (!credits) {
      console.log(`    전곡 크레딧 스캔 중... (앨범 최대 10개 × 5트랙 = 50곡)`);
      credits = await getComprehensiveCredits(hub.name, mbid);
      mbCacheSet(credKey, credits);
      // 이미 getComprehensiveCredits 내부에서 충분한 딜레이 적용됨
    }

    console.log(`    크레딧 아티스트: ${credits.length}명`);

    // WRITER / PRODUCER 엣지 변환
    const knownHubSpotifyIds = new Set(HUB_ARTISTS.map((h) => h.spotifyId));
    const knownHubNames = new Set(HUB_ARTISTS.map((h) => h.name.toLowerCase()));
    let newEdges = 0;

    for (const credit of credits) {
      // 자기 자신 제외
      if (credit.mbid === mbid) continue;

      // 최소 참여곡 수 필터: 작곡/작사 2곡+, 프로듀서/편곡 2곡+
      const minCount = 2;
      if (credit.count < minCount && credit.role !== "featured") continue;

      // 허브 아티스트 본인은 이미 다른 관계로 처리됨
      if (knownHubNames.has(credit.name.toLowerCase())) continue;

      const relation: "WRITER" | "PRODUCER" =
        credit.role === "composer" || credit.role === "lyricist"
          ? "WRITER"
          : "PRODUCER";

      // 중복 엣지 방지
      const existing = edges.find(
        (e) => e.source === hub.spotifyId && e.targetMbid === credit.mbid && e.role === credit.role
      );
      if (existing) {
        // count 업데이트
        if (credit.count > existing.count) {
          existing.count = credit.count;
          existing.weight = calcWeight(credit.count, credit.role);
        }
        continue;
      }

      edges.push({
        source: hub.spotifyId,
        sourceName: hub.name,
        targetMbid: credit.mbid,
        targetName: credit.name,
        relation,
        role: credit.role,
        count: credit.count,
        weight: calcWeight(credit.count, credit.role),
      });
      newEdges++;

      // 신규 아티스트 등록
      if (!artistMap.has(credit.mbid)) {
        artistMap.set(credit.mbid, { mbid: credit.mbid, name: credit.name });
        console.log(`    ✨ 신규: ${credit.name} [${credit.role}] ${credit.count}곡`);
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`    ✅ 완료 (신규엣지 +${newEdges}, 총 ${edges.length}개, ${elapsed}초 소요)`);

    // 중간 저장
    completedSet.add(hub.spotifyId);
    progress.completedIds = [...completedSet];
    saveProgress(progress);
    fs.writeFileSync(EDGES_OUT, JSON.stringify(edges, null, 2), "utf-8");
    fs.writeFileSync(ARTISTS_OUT, JSON.stringify([...artistMap.values()], null, 2), "utf-8");
  }

  // ── DoD 검증 ─────────────────────────────────────────────────
  const writerEdges = edges.filter((e) => e.relation === "WRITER");
  const producerEdges = edges.filter((e) => e.relation === "PRODUCER");

  console.log("\n════════════════════════════════════════════════════");
  console.log("  📊 크롤링 완료 — DoD 검증");
  console.log(`  WRITER 엣지: ${writerEdges.length}개`);
  console.log(`  PRODUCER 엣지: ${producerEdges.length}개`);
  console.log(`  신규 아티스트: ${artistMap.size}명`);
  console.log(`  완료율: ${completedSet.size}/${HUB_ARTISTS.length}명`);

  if (completedSet.size < HUB_ARTISTS.length) {
    console.log("\n  ⏸  중단됨. 재실행 시 이어서 진행됩니다.");
  } else {
    console.log("\n  🎉 완료! 다음: npx tsx scripts/build-universe-v5.ts 재실행");
  }
  console.log("════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("[crawl-writer-credits] 치명적 에러:", err);
  process.exit(1);
});
