/**
 * V6.2 Phase 3 — 발매일 MusicBrainz 재조사
 *
 * CSV의 Release Date가 리마스터/컴필레이션 날짜인 경우가 있어
 * MusicBrainz Release Group API로 정확한 최초 발매일을 검증합니다.
 *
 * 처리 흐름:
 * 1. organic-graph.json에서 MBID가 있는 노드 추출
 * 2. MusicBrainz Release Group 조회 → 최초 발매일 추출
 * 3. releaseDate 필드 업데이트 + 불일치 리포트 생성
 */

import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "scripts", ".cache", "v5.4");
const GRAPH_FILE = path.join(CACHE_DIR, "organic-graph.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MB_API = "https://musicbrainz.org/ws/2";
const MB_UA = "KCultureUniverse/6.2 (kcultureverse@gmail.com)";

interface ReleaseGroup {
  id: string;
  title: string;
  "primary-type"?: string;
  "first-release-date"?: string;
}

async function getArtistReleases(mbid: string): Promise<{firstAlbumDate: string | null; firstSingleDate: string | null}> {
  try {
    const url = `${MB_API}/release-group?artist=${mbid}&type=album|single&limit=100&fmt=json`;
    const res = await fetch(url, { headers: { "User-Agent": MB_UA } });
    if (!res.ok) return { firstAlbumDate: null, firstSingleDate: null };
    const data = await res.json();
    const groups: ReleaseGroup[] = data["release-groups"] || [];

    let firstAlbumDate: string | null = null;
    let firstSingleDate: string | null = null;

    for (const rg of groups) {
      const dateStr = rg["first-release-date"];
      if (!dateStr) continue;
      
      if (rg["primary-type"] === "Album") {
        if (!firstAlbumDate || dateStr < firstAlbumDate) {
          firstAlbumDate = dateStr;
        }
      } else if (rg["primary-type"] === "Single") {
        if (!firstSingleDate || dateStr < firstSingleDate) {
          firstSingleDate = dateStr;
        }
      }
    }

    return { firstAlbumDate, firstSingleDate };
  } catch {
    return { firstAlbumDate: null, firstSingleDate: null };
  }
}

async function main() {
  console.log("📅 V6.2 Phase 3: 발매일 MusicBrainz 재조사\n");

  const graph = JSON.parse(fs.readFileSync(GRAPH_FILE, "utf-8"));
  
  // MBID가 indie100_로 시작하지 않는 (= 실제 MB MBID가 있는) 노드만 대상
  const targets = graph.nodes.filter((n: any) => 
    n.mbid && !n.mbid.startsWith("indie100_") && !n.mbid.startsWith("k90s00s_")
  );
  
  console.log(`  대상 아티스트: ${targets.length}명 (실제 MBID 보유)\n`);

  let updated = 0;
  const report: string[] = [];

  for (let i = 0; i < targets.length; i++) {
    const node = targets[i];
    console.log(`  [${i + 1}/${targets.length}] ${node.nameKo || node.name}...`);

    const { firstAlbumDate, firstSingleDate } = await getArtistReleases(node.mbid);
    await sleep(1100); // MB rate limit

    const earliestDate = firstAlbumDate || firstSingleDate;
    
    if (earliestDate) {
      const oldDate = node.debutDate || null;
      node.debutDate = earliestDate;
      node.firstAlbumDate = firstAlbumDate;
      
      if (oldDate !== earliestDate) {
        const status = oldDate ? `${oldDate} → ${earliestDate}` : `(없음) → ${earliestDate}`;
        report.push(`${node.nameKo || node.name}: ${status}`);
        updated++;
      }
      console.log(`    📅 ${earliestDate} (Album: ${firstAlbumDate || "N/A"}, Single: ${firstSingleDate || "N/A"})`);
    } else {
      console.log(`    ⚠️ 발매일 못 찾음`);
    }

    // 중간 저장
    if ((i + 1) % 20 === 0) {
      fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2), "utf-8");
      console.log(`    💾 중간 저장 (${updated}명 업데이트)\n`);
    }
  }

  // 최종 저장
  fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2), "utf-8");

  // 리포트 출력
  console.log(`\n🎉 완료! ${updated}명 발매일 업데이트`);
  if (report.length > 0) {
    console.log("\n📋 변경 리포트:");
    for (const line of report) {
      console.log(`  ${line}`);
    }
  }
}

main().catch(console.error);
