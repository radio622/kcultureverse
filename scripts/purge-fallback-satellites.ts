/**
 * 🧹 V5.3 Phase 1 — Task 1-1: FALLBACK 위성 숙청 스크립트
 *
 * 역할:
 *   public/data/hub/*.json 의 62개 허브 파일에서
 *   relationType: "FALLBACK" 위성을 전부 제거한다.
 *
 *   FALLBACK = Spotify Related Artists 인기순 추천 결과.
 *   BTS, BLACKPINK, TWICE 등이 38개 허브에 중복 삽입된 원인.
 *
 * 유지되는 관계 타입:
 *   SAME_GROUP  — 그룹 멤버 (예: BTS → RM, j-hope ...)
 *   PRODUCER    — 피처링/프로듀싱 (예: 아이유 → 지코)
 *   FEATURED    — 명시적 피처링 (현재 데이터 0건, 향후 추가 대비)
 *   WRITER      — 작사/작곡 (현재 데이터 0건, 향후 추가 대비)
 *
 * 실행:
 *   npx tsx scripts/purge-fallback-satellites.ts
 *   또는 npm run purge-fallback (package.json에 script 추가 권장)
 *
 * 검증 기준 (DoD — Definition of Done):
 *   ✅ FALLBACK 타입 위성 수 = 0
 *   ✅ 남은 순수 관계 수 = 160개 (SAME_GROUP 104 + PRODUCER 56)
 *   ✅ 유니크 아티스트 수 ≈ 222명
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const HUB_DIR = path.resolve(__dirname, "../public/data/hub");

// ─── 허용되는 관계 타입 (순혈 데이터) ──────────────────────────────
const PURE_RELATION_TYPES = new Set([
  "SAME_GROUP",
  "PRODUCER",
  "FEATURED",
  "WRITER",
]);

// ─── 타입 정의 ────────────────────────────────────────────────────
interface Satellite {
  spotifyId: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
  popularity: number;
  previewUrl: string | null;
  previewTrackName: string | null;
  spotifyUrl: string;
  relationType: string;
  relationKeyword: string;
}

interface HubFile {
  core: {
    spotifyId: string;
    name: string;
    [key: string]: unknown;
  };
  satellites: Satellite[];
}

// ─── 유틸: 확인 프롬프트 ─────────────────────────────────────────
function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

// ─── 메인 ────────────────────────────────────────────────────────
async function main() {
  const hubFiles = fs.readdirSync(HUB_DIR).filter((f) => f.endsWith(".json"));

  console.log("════════════════════════════════════════════════════");
  console.log("  🧹 V5.3 Task 1-1: FALLBACK 위성 숙청");
  console.log("════════════════════════════════════════════════════");
  console.log(`  대상 허브 파일: ${hubFiles.length}개`);
  console.log("");

  // ── 드라이 런: 실제 삭제 전 영향 범위 출력 ──────────────────────
  let totalBefore = 0;
  let totalFallback = 0;
  let totalPure = 0;
  const affectedHubs: string[] = [];
  const affectedArtists = new Set<string>();

  for (const file of hubFiles) {
    const filePath = path.join(HUB_DIR, file);
    const data: HubFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const fallbackSats = data.satellites.filter((s) => s.relationType === "FALLBACK");
    const pureSats = data.satellites.filter((s) => PURE_RELATION_TYPES.has(s.relationType));

    totalBefore += data.satellites.length;
    totalFallback += fallbackSats.length;
    totalPure += pureSats.length;

    if (fallbackSats.length > 0) {
      affectedHubs.push(data.core.name);
      fallbackSats.forEach((s) => affectedArtists.add(s.name));
    }
  }

  console.log("  [드라이 런 — 삭제 예정 결과]");
  console.log(`  총 위성 레코드:    ${totalBefore}개`);
  console.log(`  삭제될 FALLBACK:   ${totalFallback}개 ❌`);
  console.log(`  유지될 순수 관계:  ${totalPure}개 ✅`);
  console.log(`  영향받는 허브:     ${affectedHubs.length}개`);
  console.log(`  삭제되는 유니크 아티스트: ${affectedArtists.size}명`);
  console.log("");
  console.log("  삭제되는 가짜 위성들:");
  for (const name of [...affectedArtists].sort()) {
    console.log(`    - ${name}`);
  }
  console.log("");

  // ── 확인 프롬프트 ─────────────────────────────────────────────
  const ok = await confirm("  정말로 FALLBACK 위성을 모두 삭제하시겠습니까? (y/N): ");
  if (!ok) {
    console.log("  취소되었습니다.");
    process.exit(0);
  }

  // ── 실제 삭제 실행 ────────────────────────────────────────────
  console.log("\n  처리 중...\n");

  let processed = 0;
  const uniqueArtists = new Set<string>();

  for (const file of hubFiles) {
    const filePath = path.join(HUB_DIR, file);
    const data: HubFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    // 순수 관계만 필터링
    const before = data.satellites.length;
    data.satellites = data.satellites.filter((s) => PURE_RELATION_TYPES.has(s.relationType));
    const after = data.satellites.length;
    const removed = before - after;

    // 유니크 아티스트 수집
    uniqueArtists.add(data.core.spotifyId);
    data.satellites.forEach((s) => uniqueArtists.add(s.spotifyId));

    // 파일 저장 (들여쓰기 2칸 유지)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

    if (removed > 0) {
      console.log(`  ✅ ${data.core.name.padEnd(20)}: ${before}개 → ${after}개 (${removed}개 삭제)`);
    }
    processed++;
  }

  // ── 검증 ─────────────────────────────────────────────────────
  console.log("\n  검증 결과:");

  let verifyFallback = 0;
  let verifySameGroup = 0;
  let verifyProducer = 0;
  let verifyFeatured = 0;
  let verifyWriter = 0;

  for (const file of hubFiles) {
    const filePath = path.join(HUB_DIR, file);
    const data: HubFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    data.satellites.forEach((s) => {
      if (s.relationType === "FALLBACK") verifyFallback++;
      if (s.relationType === "SAME_GROUP") verifySameGroup++;
      if (s.relationType === "PRODUCER") verifyProducer++;
      if (s.relationType === "FEATURED") verifyFeatured++;
      if (s.relationType === "WRITER") verifyWriter++;
    });
  }

  const dod1 = verifyFallback === 0;
  const dod2 = verifySameGroup + verifyProducer === 160;
  const dod3 = uniqueArtists.size >= 200;

  console.log(`  FALLBACK 탕진 여부:          ${dod1 ? "✅ PASS" : "❌ FAIL"} (${verifyFallback}개 남음)`);
  console.log(`  SAME_GROUP 보존:             ${verifySameGroup}개`);
  console.log(`  PRODUCER 보존:               ${verifyProducer}개`);
  console.log(`  FEATURED:                    ${verifyFeatured}개`);
  console.log(`  WRITER:                      ${verifyWriter}개`);
  console.log(`  순수 관계 합계 = 160 검증:   ${dod2 ? "✅ PASS" : "❌ FAIL"} (실제 ${verifySameGroup + verifyProducer}개)`);
  console.log(`  유니크 아티스트 ≥ 200 검증:  ${dod3 ? "✅ PASS" : "❌ FAIL"} (${uniqueArtists.size}명)`);

  console.log("\n════════════════════════════════════════════════════");
  if (dod1 && dod2 && dod3) {
    console.log("  🎉 Task 1-1 완료! 모든 DoD 조건 충족.");
    console.log("  다음: Task 1-2 (Spotify 크레딧 기반 2촌 확장)");
  } else {
    console.log("  ⚠️  일부 DoD 조건 미충족. 위 결과를 확인하세요.");
  }
  console.log("════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("[purge-fallback] 치명적 에러:", err);
  process.exit(1);
});
