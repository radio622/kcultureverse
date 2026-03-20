/**
 * K-Culture Universe V5.4 — Spotify 데이터 인핸서(Enhancer)
 *
 * MusicBrainz 기반으로 크롤링된 organic-graph.json은 순수한 텍스트/이름 정보만 가집니다.
 * 이 정보를 기반으로 아직 Spotify ID가 발급되지 않은 노드들에 대해
 * Spotify Search API를 호출하여 고화질 이미지, 스트리밍 URL, 인기도(Popularity)를 채워 넣습니다.
 */

import fs from "fs";
import path from "path";
import { searchArtists } from "../src/lib/spotify";

const CACHE_DIR = path.join(process.cwd(), "scripts", ".cache", "v5.4");
const GRAPH_IN = path.join(CACHE_DIR, "organic-graph.json");

// 캐시 기반 딜레이
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!fs.existsSync(GRAPH_IN)) {
    console.error("❌ organic-graph.json 파일이 없습니다.");
    process.exit(1);
  }

  console.log("🔍 Spotify Data Enhancer Started...\n");
  const data = JSON.parse(fs.readFileSync(GRAPH_IN, "utf-8"));
  let updatedCount = 0;

  for (let i = 0; i < data.nodes.length; i++) {
    const node = data.nodes[i];
    
    // 이미 Spotify 정보가 있거나, 처리된 노드면 패스
    if (node.spotifyId && node.image) continue;

    console.log(`  [${i + 1}/${data.nodes.length}] Spotify 데이터 수집 중: ${node.name}`);
    
    try {
      const results = await searchArtists(node.name);
      
      const bestMatch = results.find(
        (artist) =>
          artist.name.toLowerCase() === node.name.toLowerCase()
      ) || results[0]; // 가장 정확한 일치 또는 첫 번째 결과 사용

      if (bestMatch) {
        node.spotifyId = bestMatch.spotifyId;
        node.image = bestMatch.imageUrl;
        node.popularity = bestMatch.popularity;
        node.genres = bestMatch.genres;
        updatedCount++;
        console.log(`    ✅ 매칭 성공! (팝빌: ${bestMatch.popularity})`);
      } else {
        console.log(`    ⚠️ 매칭 실패: 검색 결과 없음`);
        // 검색 실패 시 과도한 재시도를 막기 위해 더미 ID 할당
        node.spotifyId = "not_found_" + node.mbid;
      }
      
      // 검색 시 429 에러 방지를 위해 딜레이
      await sleep(250);
      
    } catch (e: any) {
      console.error(`    ❌ 오류 발생: ${e.message}`);
      await sleep(3000); // 429 에러 대응
    }

    // 중간 저장 (10개 마다)
    if (updatedCount > 0 && updatedCount % 10 === 0) {
      fs.writeFileSync(GRAPH_IN, JSON.stringify(data, null, 2), "utf-8");
      console.log(`  💾 중간 저장 완료`);
    }
  }

  // 최종 저장
  fs.writeFileSync(GRAPH_IN, JSON.stringify(data, null, 2), "utf-8");
  console.log(`\n🎉 Enhancer 완료! 업데이트된 아티스트 수: ${updatedCount}`);
}

main().catch(console.error);
