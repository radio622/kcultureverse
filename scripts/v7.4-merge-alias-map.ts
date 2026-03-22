/**
 * v7.4-merge-alias-map.ts
 * Phase 1 Step 1-3: ALIAS_MAP 병합
 *
 * 기존 FloatingSearch.tsx의 수동 ALIAS_MAP(110쌍)을
 * MB aliases 자동 수집 결과와 병합합니다.
 *
 * ⚠️ 절대 기존 수동 데이터를 덮어쓰지 않습니다!
 *   - 기존 수동 데이터 보존 (방탄, 블핑, 악뮤, Agust D 등 닉네임)
 *   - MB 자동 데이터는 기존에 없는 것만 추가(append)
 *   - 최종 결과를 FloatingSearch.tsx의 ALIAS_MAP에 반영
 *
 * 결과: src/components/FloatingSearch.tsx ALIAS_MAP 업데이트
 *
 * 참고: DATA_QUALITY_GUIDE.md 규칙 2 — ALIAS_MAP 병합 전략
 */

import fs from "fs";
import path from "path";

const ALIASES_PATH = path.resolve("public/data/artist-aliases.json");
const REPORT_PATH = path.resolve("public/data/name-determination-report.json");
const FLOATING_SEARCH_PATH = path.resolve("src/components/FloatingSearch.tsx");

// ──────────────────────────────────────────────────────────────
// 기존 FloatingSearch.tsx의 ALIAS_MAP을 파싱
// ──────────────────────────────────────────────────────────────
function parseExistingAliasMap(source: string): Record<string, string[]> {
  const mapMatch = source.match(
    /const ALIAS_MAP:\s*Record<string,\s*string\[\]>\s*=\s*\{([\s\S]*?)\};/
  );
  if (!mapMatch) {
    console.error("❌ ALIAS_MAP을 FloatingSearch.tsx에서 찾지 못했습니다.");
    process.exit(1);
  }

  const mapBody = mapMatch[1];
  const result: Record<string, string[]> = {};

  // 각 줄에서 "Key": ["v1", "v2", ...] 패턴 추출
  const lineRegex = /"([^"]+)":\s*\[([^\]]*)\]/g;
  let match;
  while ((match = lineRegex.exec(mapBody)) !== null) {
    const key = match[1];
    const values = match[2]
      .split(",")
      .map((v) => v.trim().replace(/^"/, "").replace(/"$/, ""))
      .filter(Boolean);
    result[key] = values;
  }

  return result;
}

// ──────────────────────────────────────────────────────────────
// ALIAS_MAP을 TypeScript 코드 문자열로 직렬화
// ──────────────────────────────────────────────────────────────
function serializeAliasMap(map: Record<string, string[]>): string {
  const lines: string[] = [];

  // 그룹 주석 유지를 위해 영문 키 먼저 → 한글 키 순서 유지
  const entries = Object.entries(map).sort(([a], [b]) => {
    const aIsKo = /[가-힣]/.test(a);
    const bIsKo = /[가-힣]/.test(b);
    if (aIsKo !== bIsKo) return aIsKo ? 1 : -1;
    return a.localeCompare(b, "ko");
  });

  for (const [key, values] of entries) {
    const valStr = values.map((v) => `"${v}"`).join(", ");
    lines.push(`  "${key}": [${valStr}],`);
  }

  return lines.join("\n");
}

// ──────────────────────────────────────────────────────────────
// 메인
// ──────────────────────────────────────────────────────────────
async function main() {
  console.log("🔄 ALIAS_MAP 병합 시작\n");

  // 1. 파일 존재 확인
  if (!fs.existsSync(ALIASES_PATH)) {
    console.error("❌ artist-aliases.json 없음! v7.4-collect-aliases.py 먼저 실행 필요");
    process.exit(1);
  }
  if (!fs.existsSync(REPORT_PATH)) {
    console.error("❌ name-determination-report.json 없음! v7.4-determine-names.py 먼저 실행 필요");
    process.exit(1);
  }

  // 2. 데이터 로드
  const aliasesData: Record<string, { primaryName: string; aliases: Array<{ name: string; locale: string | null }> }> =
    JSON.parse(fs.readFileSync(ALIASES_PATH, "utf-8"));

  const report: { pending_alias_map: Record<string, string[]> } =
    JSON.parse(fs.readFileSync(REPORT_PATH, "utf-8"));

  const floatingSource = fs.readFileSync(FLOATING_SEARCH_PATH, "utf-8");

  // 3. 기존 ALIAS_MAP 파싱
  const existingMap = parseExistingAliasMap(floatingSource);
  console.log(`📌 기존 수동 ALIAS_MAP: ${Object.keys(existingMap).length}쌍`);

  // 4. MB aliases에서 추가 후보 수집
  let mbNewCount = 0;
  for (const [, mbData] of Object.entries(aliasesData)) {
    const primary = mbData.primaryName;
    if (!primary) continue;

    const koAliases = mbData.aliases
      .filter((a) => a.locale === "ko")
      .map((a) => a.name);

    for (const koAlias of koAliases) {
      // 영문 primary → 한글 alias를 영문 키에 추가
      if (!existingMap[primary]) {
        existingMap[primary] = [];
        mbNewCount++;
      }
      if (!existingMap[primary].includes(koAlias)) {
        existingMap[primary].push(koAlias);
      }

      // 역방향: 한글 alias → 영문을 검색 가능하게
      if (!existingMap[koAlias]) {
        existingMap[koAlias] = [];
      }
      if (!existingMap[koAlias].includes(primary)) {
        existingMap[koAlias].push(primary);
      }
    }
  }

  // 5. name-determination-report의 pending도 병합
  const pending = report.pending_alias_map || {};
  for (const [key, values] of Object.entries(pending)) {
    if (!existingMap[key]) existingMap[key] = [];
    for (const v of values) {
      if (!existingMap[key].includes(v)) {
        existingMap[key].push(v);
      }
    }
  }

  console.log(`📥 MB aliases 신규 추가: ~${mbNewCount}개 키`);
  console.log(`📊 최종 ALIAS_MAP: ${Object.keys(existingMap).length}쌍\n`);

  // 6. FloatingSearch.tsx에 새 ALIAS_MAP 주입
  const newMapBody = serializeAliasMap(existingMap);
  const newMapBlock = `const ALIAS_MAP: Record<string, string[]> = {\n${newMapBody}\n};`;

  const updatedSource = floatingSource.replace(
    /const ALIAS_MAP:\s*Record<string,\s*string\[\]>\s*=\s*\{[\s\S]*?\};/,
    newMapBlock
  );

  if (updatedSource === floatingSource) {
    console.error("❌ ALIAS_MAP 교체 실패 — 패턴 미매칭");
    process.exit(1);
  }

  fs.writeFileSync(FLOATING_SEARCH_PATH, updatedSource, "utf-8");

  // 7. 결과 요약
  console.log("✅ 병합 완료!");
  console.log(`\n⚠️  검증 사항:`);
  console.log(`   1. "방탄", "블핑", "악뮤" 같은 닉네임이 유지되는지 확인`);
  console.log(`   2. "Agust D", "슈가" 같은 솔로명도 유지 확인`);
  console.log(`   3. FloatingSearch.tsx에서 TypeScript 오류 없는지 확인`);
  console.log(`\n다음 단계: npx tsx scripts/v7.4-fix-collab-nodes.ts 실행`);
}

main().catch(console.error);
