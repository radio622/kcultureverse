/**
 * K-Culture Universe — 초기 그래프 생성 스크립트
 *
 * 기존 public/data/hub/*.json 파일들을 읽어
 * 관계 그래프(graph.json)를 자동 생성합니다.
 *
 * 실행: npx tsx scripts/build-graph.ts
 */

import * as fs from "fs";
import * as path from "path";

require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

import { HUB_ARTISTS } from "../src/data/hub-artists";
import { buildInitialGraph } from "../src/lib/graph";
import type { CosmosData } from "../src/lib/types";

const HUB_DIR = path.resolve(__dirname, "../public/data/hub");
const GRAPH_PATH = path.resolve(__dirname, "../public/data/graph.json");

async function main() {
  console.log("🌌 관계 그래프 생성 시작\n");

  const hubData: Parameters<typeof buildInitialGraph>[0] = [];

  for (const hub of HUB_ARTISTS) {
    const jsonPath = path.join(HUB_DIR, `${hub.spotifyId}.json`);
    if (!fs.existsSync(jsonPath)) {
      console.log(`  ⏭ ${hub.nameKo} — JSON 없음, 건너뜀`);
      continue;
    }

    try {
      const raw = fs.readFileSync(jsonPath, "utf-8");
      const data = JSON.parse(raw) as CosmosData;

      hubData.push({
        spotifyId: hub.spotifyId,
        name: hub.name,
        nameKo: hub.nameKo,
        accent: hub.accent,
        core: {
          imageUrl: data.core.imageUrl,
          genres: data.core.genres,
          popularity: data.core.popularity,
          previewUrl: data.core.previewUrl,
          spotifyUrl: data.core.spotifyUrl,
        },
        satellites: data.satellites.map((s) => ({
          spotifyId: s.spotifyId,
          name: s.name,
          imageUrl: s.imageUrl,
          genres: s.genres,
          popularity: s.popularity,
          previewUrl: s.previewUrl,
          spotifyUrl: s.spotifyUrl,
        })),
      });

      console.log(`  ✅ ${hub.nameKo} — 코어 + 위성 ${data.satellites.length}명`);
    } catch (err: any) {
      console.log(`  ❌ ${hub.nameKo} — ${err.message}`);
    }
  }

  console.log(`\n📊 허브 데이터 ${hubData.length}명 로드 완료`);

  // 그래프 빌드
  const graph = buildInitialGraph(hubData);

  const nodeCount = Object.keys(graph.nodes).length;
  const edgeCount = graph.edges.length;

  console.log(`\n🔗 그래프 생성 완료:`);
  console.log(`   노드: ${nodeCount}개`);
  console.log(`   엣지: ${edgeCount}개`);

  // 저장
  fs.mkdirSync(path.dirname(GRAPH_PATH), { recursive: true });
  fs.writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2), "utf-8");
  console.log(`\n💾 저장: ${GRAPH_PATH}`);
  console.log(`   크기: ${(fs.statSync(GRAPH_PATH).size / 1024).toFixed(1)}KB`);
}

main().catch((err) => {
  console.error("치명적 에러:", err);
  process.exit(1);
});
