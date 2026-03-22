/**
 * v7.4-fix-collab-nodes.ts
 * Phase 1 Step 1-4: 콜라보 노드 자동 분리
 *
 * 우주에서 "Crush;태연", "로맨틱펀치;이혁" 같은
 * 세미콜론(;) 포함 노드를 개별 아티스트 노드로 분리하고
 * FEATURED 엣지를 생성합니다.
 *
 * ⚠️ 반드시 실행 전 백업이 있어야 합니다!
 *   cp public/data/v5-layout.json public/data/v5-layout.json.bak
 *   cp public/data/v5-edges.json public/data/v5-edges.json.bak
 *
 * 로직:
 *  1. layout.json에서 ';' 포함 노드 탐지 (85건 예상)
 *  2. 각 콜라보 노드:
 *     a. 세미콜론 분리 → 개별 아티스트 이름 목록
 *     b. 기존 노드 존재 여부 확인 (name, nameKo 모두로)
 *     c. 없으면 → 콜라보 노드 좌표 ±80 오프셋에 새 노드 생성
 *     d. 쌍 엣지 생성:
 *        - ≤4명: 모든 쌍 FEATURED (0.7)
 *        - ≥5명: star topology (첫 번째 → 나머지, 0.5)
 *     e. 콜라보 노드에 연결된 기존 엣지 → 첫 번째 아티스트에게 이관
 *     f. 콜라보 노드 삭제
 *  3. collab_fix_logs 기록
 *
 * 참고: DATA_QUALITY_GUIDE.md 규칙 1
 */

import fs from "fs";
import path from "path";

const LAYOUT_PATH = path.resolve("public/data/v5-layout.json");
const EDGES_PATH  = path.resolve("public/data/v5-edges.json");
const LOG_PATH    = path.resolve("public/data/collab-fix-log.json");

interface LayoutNode {
  id: string;
  name: string;
  nameKo: string;
  x: number;
  y: number;
  degree: number;
  accent?: string;
}

interface EdgeEntry {
  source: string;
  target: string;
  weight: number;
  relation: string;
  label?: string;
}

// 이름으로 기존 노드 찾기 (name 또는 nameKo로 검색)
function findNode(nodes: LayoutNode[], searchName: string): LayoutNode | undefined {
  const lower = searchName.toLowerCase().trim();
  return nodes.find(
    (n) =>
      n.name.toLowerCase().trim() === lower ||
      (n.nameKo && n.nameKo.toLowerCase().trim() === lower)
  );
}

// 엣지 중복 확인
function edgeExists(edges: EdgeEntry[], src: string, tgt: string): boolean {
  return edges.some(
    (e) =>
      (e.source === src && e.target === tgt) ||
      (e.source === tgt && e.target === src)
  );
}

// 간단한 ID 생성 (이름 기반)
function makeNodeId(name: string): string {
  return `collab_split_${Buffer.from(name).toString("base64").replace(/[^a-zA-Z0-9]/g, "").substring(0, 12)}`;
}

async function main() {
  console.log("🔧 V7.4 콜라보 노드 분리 시작\n");

  // ── 백업 확인 ──────────────────────────────────────────────
  const bakExists =
    fs.existsSync(LAYOUT_PATH + ".bak") && fs.existsSync(EDGES_PATH + ".bak");
  if (!bakExists) {
    console.log("⚠️  백업 파일이 없습니다. 지금 생성합니다...");
    fs.copyFileSync(LAYOUT_PATH, LAYOUT_PATH + ".bak");
    fs.copyFileSync(EDGES_PATH, EDGES_PATH + ".bak");
    console.log("✅ 백업 완료:");
    console.log(`   ${LAYOUT_PATH}.bak`);
    console.log(`   ${EDGES_PATH}.bak\n`);
  } else {
    console.log("✅ 백업 확인됨\n");
  }

  // ── 데이터 로드 ────────────────────────────────────────────
  const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, "utf-8"));
  const edgesFile = JSON.parse(fs.readFileSync(EDGES_PATH, "utf-8"));

  let nodes: LayoutNode[] = layout.nodes;
  let edges: EdgeEntry[] = edgesFile.edges;

  // ── 콜라보 노드 탐지 ───────────────────────────────────────
  const collabNodes = nodes.filter((n) => n.name.includes(";"));
  console.log(`🎯 콜라보 노드 탐지: ${collabNodes.length}건\n`);

  const fixLogs: any[] = [];
  let totalNewNodes = 0;
  let totalNewEdges = 0;
  let totalRedirectedEdges = 0;

  // ── 처리 ───────────────────────────────────────────────────
  for (const collabNode of collabNodes) {
    const parts = collabNode.name.split(";").map((p) => p.trim()).filter(Boolean);
    console.log(`\n[콜라보] "${collabNode.name}" (${parts.length}명)`);
    console.log(`  분리: ${parts.join(", ")}`);

    const partNodeIds: string[] = [];
    const newNodesCreated: string[] = [];
    const newEdgesCreated: string[] = [];

    // Step A/B/C: 개별 노드 확인/생성
    for (let i = 0; i < parts.length; i++) {
      const artistName = parts[i];
      let existingNode = findNode(nodes, artistName);

      if (existingNode) {
        partNodeIds.push(existingNode.id);
        console.log(`  ✓ 기존 노드: "${artistName}" (${existingNode.id.substring(0, 12)}...)`);
      } else {
        // 새 노드 생성: 콜라보 노드 좌표 근처에 배치 (±80 오프셋)
        const angle = (i / parts.length) * 2 * Math.PI;
        const newX = collabNode.x + Math.cos(angle) * 80;
        const newY = collabNode.y + Math.sin(angle) * 80;
        const newId = makeNodeId(artistName);

        const newNode: LayoutNode = {
          id: newId,
          name: artistName,
          nameKo: artistName,  // 이름 판정은 이후 v7.4-determine-names.py에서
          x: newX,
          y: newY,
          degree: 0,
        };

        nodes.push(newNode);
        partNodeIds.push(newId);
        newNodesCreated.push(artistName);
        totalNewNodes++;
        console.log(`  ✨ 신규 노드 생성: "${artistName}" → ${newId.substring(0, 20)}...`);
      }
    }

    // Step D: FEATURED 엣지 생성
    if (parts.length <= 4) {
      // ≤4명: 모든 쌍
      for (let i = 0; i < partNodeIds.length; i++) {
        for (let j = i + 1; j < partNodeIds.length; j++) {
          const src = partNodeIds[i];
          const tgt = partNodeIds[j];
          if (!edgeExists(edges, src, tgt)) {
            edges.push({
              source: src,
              target: tgt,
              weight: 0.7,
              relation: "FEATURED",
              label: `정식 협업 (분리: ${collabNode.name})`,
            });
            newEdgesCreated.push(`${parts[i]} ↔ ${parts[j]}`);
            totalNewEdges++;
          }
        }
      }
    } else {
      // ≥5명: star topology (첫 번째가 허브)
      const hubId = partNodeIds[0];
      const hubName = parts[0];
      for (let i = 1; i < partNodeIds.length; i++) {
        const spokId = partNodeIds[i];
        if (!edgeExists(edges, hubId, spokId)) {
          edges.push({
            source: hubId,
            target: spokId,
            weight: 0.5,
            relation: "FEATURED",
            label: `정식 협업 star (분리: ${collabNode.name})`,
          });
          newEdgesCreated.push(`${hubName} ↔ ${parts[i]} (star)`);
          totalNewEdges++;
        }
      }
    }
    console.log(`  🔗 엣지 생성: ${newEdgesCreated.length}개`);

    // Step E: 기존 엣지 이관 (첫 번째 아티스트에게)
    const firstPartId = partNodeIds[0];
    const redirectedEdges: string[] = [];

    edges = edges.map((e) => {
      if (e.source === collabNode.id) {
        totalRedirectedEdges++;
        redirectedEdges.push(`→ ${e.target}`);
        return { ...e, source: firstPartId };
      }
      if (e.target === collabNode.id) {
        totalRedirectedEdges++;
        redirectedEdges.push(`← ${e.source}`);
        return { ...e, target: firstPartId };
      }
      return e;
    });

    if (redirectedEdges.length > 0) {
      console.log(`  🔀 기존 엣지 이관: ${redirectedEdges.length}개 → "${parts[0]}"`);
    }

    // Step F: 콜라보 노드 삭제
    nodes = nodes.filter((n) => n.id !== collabNode.id);

    // 로그 기록
    fixLogs.push({
      original_id: collabNode.id,
      original_name: collabNode.name,
      parts,
      new_nodes_created: newNodesCreated,
      edges_created: newEdgesCreated,
      edges_redirected: redirectedEdges.length,
      first_artist_id: firstPartId,
    });
  }

  // ── degree 재계산 ───────────────────────────────────────────
  const degreeMap: Record<string, number> = {};
  for (const node of nodes) degreeMap[node.id] = 0;
  for (const edge of edges) {
    if (degreeMap[edge.source] !== undefined) degreeMap[edge.source]++;
    if (degreeMap[edge.target] !== undefined) degreeMap[edge.target]++;
  }
  for (const node of nodes) node.degree = degreeMap[node.id] ?? node.degree;

  // ── 저장 ───────────────────────────────────────────────────
  layout.nodes = nodes;
  layout.nodeCount = nodes.length;
  edgesFile.edges = edges;
  edgesFile.edgeCount = edges.length;

  fs.writeFileSync(LAYOUT_PATH, JSON.stringify(layout, null, 2), "utf-8");
  fs.writeFileSync(EDGES_PATH, JSON.stringify(edgesFile, null, 2), "utf-8");
  fs.writeFileSync(LOG_PATH, JSON.stringify({
    fixedAt: new Date().toISOString(),
    totalCollab: collabNodes.length,
    totalNewNodes,
    totalNewEdges,
    totalRedirectedEdges,
    logs: fixLogs,
  }, null, 2), "utf-8");

  // ── 검증 ───────────────────────────────────────────────────
  const remaining = nodes.filter((n) => n.name.includes(";"));
  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ 콜라보 노드 분리 완료!`);
  console.log(`\n📊 결과:`);
  console.log(`   처리: ${collabNodes.length}건`);
  console.log(`   신규 노드: ${totalNewNodes}개`);
  console.log(`   신규 엣지: ${totalNewEdges}개 (FEATURED)`);
  console.log(`   이관된 엣지: ${totalRedirectedEdges}개`);
  console.log(`\n🔍 검증:`);
  console.log(`   콜라보 잔존: ${remaining.length}건 ${remaining.length === 0 ? "✅" : "❌"}`);
  if (remaining.length > 0) {
    remaining.slice(0, 5).forEach((n) => console.log(`   남은 콜라보: [${n.name}]`));
  }
  console.log(`   최종 노드: ${nodes.length}명`);
  console.log(`   최종 엣지: ${edges.length}개`);
  console.log(`\n💾 저장:`);
  console.log(`   ${LAYOUT_PATH}`);
  console.log(`   ${EDGES_PATH}`);
  console.log(`   ${LOG_PATH} (수정 로그)`);
  console.log(`\n♻️  복구 방법 (문제 시):`);
  console.log(`   cp public/data/v5-layout.json.bak public/data/v5-layout.json`);
  console.log(`   cp public/data/v5-edges.json.bak  public/data/v5-edges.json`);
  console.log(`\n다음 단계: python3 scripts/v7.4-determine-names.py 실행`);
}

main().catch(console.error);
