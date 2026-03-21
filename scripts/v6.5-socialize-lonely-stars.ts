import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "scripts", ".cache", "v5.4");
const GRAPH_FILE = path.join(CACHE_DIR, "organic-graph.json");

function main() {
  console.log("🌌 V6.5 Socialize Lonely Stars (우주 소개팅 대작전) 시작...\n");

  const graph = JSON.parse(fs.readFileSync(GRAPH_FILE, "utf-8"));
  let addedEdges = 0;

  // 모든 노드의 Degree(연결선 수) 계산 및 빠른 맵핑
  const degreeMap = new Map<string, number>();
  for (const n of graph.nodes) degreeMap.set(n.mbid, 0);
  
  const existingEdgeKeys = new Set<string>();
  for (const e of graph.edges) {
    const key = [e.source, e.target].sort().join("::");
    existingEdgeKeys.add(key);
    degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
  }

  // 연결선이 1개 이하인 외로운 별들 수집 (구조 대상)
  const lonelyNodes = graph.nodes.filter((n: any) => (degreeMap.get(n.mbid) || 0) <= 1);
  console.log(`📌 1. 타겟 확보: 총 ${graph.nodes.length}명 중 외로운 별 ${lonelyNodes.length}명 물색 완료.\n`);

  // 매칭용 풀(Pool) 세팅
  const majorNodes = graph.nodes.filter((n: any) => n.popularity >= 60 || (degreeMap.get(n.mbid) || 0) >= 3);

  // 소개팅 셔플
  for (const lonely of lonelyNodes) {
    const targetCount = 1 + Math.floor(Math.random() * 2); // 1~2개 엣지 생성
    let matchedCount = 0;
    
    // 외로운 노드의 장르 추출 (대소문자 무시)
    const lonelyGenres = (lonely.genres || []).map((g: string) => g.toLowerCase());

    // 전체 노드를 돌면서 매칭 시도 (랜덤 피를 위해 섞기)
    const shuffledPool = [...graph.nodes].sort(() => 0.5 - Math.random());
    
    for (const partner of shuffledPool) {
      if (partner.mbid === lonely.mbid) continue;
      
      const partnerGenres = (partner.genres || []).map((g: string) => g.toLowerCase());
      
      // 1. 장르 교집합 여부
      const hasOverlap = lonelyGenres.some((g: string) => partnerGenres.includes(g));
      
      // 2. 장르 정보가 없으면, 인기 있는 K-Pop/거대별 풀을 랜덤 선택
      const isFallback = lonelyGenres.length === 0 && majorNodes.some((m: any) => m.mbid === partner.mbid) && Math.random() < 0.1;

      if (hasOverlap || isFallback) {
        const edgeKey = [lonely.mbid, partner.mbid].sort().join("::");
        if (!existingEdgeKeys.has(edgeKey)) {
          graph.edges.push({
            source: lonely.mbid,
            target: partner.mbid,
            relation: hasOverlap ? "GENRE_OVERLAP" : "INDIRECT",
            weight: 0.4,
            label: hasOverlap ? "장르가 비슷한 파동" : "우연한 마주침"
          });
          existingEdgeKeys.add(edgeKey);
          degreeMap.set(lonely.mbid, (degreeMap.get(lonely.mbid) || 0) + 1);
          degreeMap.set(partner.mbid, (degreeMap.get(partner.mbid) || 0) + 1);
          addedEdges++;
          matchedCount++;

          if (matchedCount >= targetCount) break;
        }
      }
    }
  }

  // 소개팅 후 남은 고아 확인
  const remainingLonely = graph.nodes.filter((n: any) => (degreeMap.get(n.mbid) || 0) <= 1).length;

  fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2), "utf-8");

  console.log(`🎉 2. 소개팅 대성공!`);
  console.log(`   - 새롭게 연결된 운명의 실타래(Edge): ${addedEdges}개`);
  console.log(`   - 이제 남은 '진짜 외로운 별': ${remainingLonely}명 (목표: 0명)`);
  console.log(`   - organic-graph 업데이트 완료\n`);
}

main();
