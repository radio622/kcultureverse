/**
 * V7.7 수동 데이터 패치 스크립트
 *
 * 패치 대상:
 * 1. 백아 — 노드 이름 수정 (백아연→백아) + Various Artists 오염 노드 정리
 * 2. 패닉 ↔ 이적, 김진표 SAME_GROUP 연결 (+ 김진표 노드 없으면 추가)
 * 3. 넥스트 ↔ 신해철 SAME_GROUP 연결 + 넥스트 SpotifyID 정상화
 * 4. 서태지와 아이들 ↔ 서태지 / 양현석 / 이주노 SAME_GROUP 연결
 *
 * 실행: npx tsx scripts/v7.7-manual-patch.ts
 */

import fs from "fs";
import path from "path";

const LAYOUT_FILE = path.join(process.cwd(), "public/data/v5-layout.json");
const EDGES_FILE = path.join(process.cwd(), "public/data/v5-edges.json");

// ── 유틸 ──────────────────────────────────────────────────────────────
function edgeKey(a: string, b: string) {
  return [a, b].sort().join("||");
}

function findNode(nodes: Record<string, any>, nameKo: string) {
  return Object.entries(nodes).find(([, n]) => n.nameKo === nameKo || n.name === nameKo);
}

/** Spotify API로 아티스트 검색 (간단 버전) */
async function searchSpotify(name: string): Promise<{ id: string; name: string; image?: string } | null> {
  // 환경변수에서 토큰이 없으면 iTunes로 폴백
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=5&country=KR`
    );
    const data = await res.json();
    const match = (data.results || []).find((r: any) =>
      r.artistName.toLowerCase().includes(name.toLowerCase())
    );
    return match ? { id: `itunes_${match.amgArtistId || name}`, name: match.artistName } : null;
  } catch {
    return null;
  }
}

// ── 메인 ──────────────────────────────────────────────────────────────
async function main() {
  console.log("🔧 V7.7 수동 데이터 패치 시작...\n");

  const layout = JSON.parse(fs.readFileSync(LAYOUT_FILE, "utf-8"));
  const edgeData = JSON.parse(fs.readFileSync(EDGES_FILE, "utf-8"));
  const nodes: Record<string, any> = layout.nodes;
  const edges: any[] = edgeData.edges;

  const existingEdgeKeys = new Set(edges.map((e) => edgeKey(e.source, e.target)));
  let addedNodes = 0;
  let addedEdges = 0;
  let patchedNodes = 0;

  // ──────────────────────────────────────────────────────────────────
  // 1. Various Artists 오염 노드 (노드 14) 정리
  // ──────────────────────────────────────────────────────────────────
  const vaNode = Object.entries(nodes).find(([, n]) => n.name === "Various Artists");
  if (vaNode) {
    const [vaKey] = vaNode;
    const vaId = vaNode[1].id;
    // 이 노드에 연결된 엣지를 제거
    const beforeCount = edges.length;
    const vaEdgesRemoved = edges.filter((e) => e.source === vaId || e.target === vaId).length;
    edges.splice(0, edges.length, ...edges.filter((e) => e.source !== vaId && e.target !== vaId));
    delete nodes[vaKey];
    console.log(`✅ 1. Various Artists 노드(${vaKey}) 제거 — 연결 엣지 ${vaEdgesRemoved}개 삭제`);
    patchedNodes++;
  } else {
    console.log("ℹ️  1. Various Artists 노드 없음 (이미 정리됨)");
  }

  // ──────────────────────────────────────────────────────────────────
  // 2. 백아연 → 백아 이름 패치
  // ──────────────────────────────────────────────────────────────────
  const baekEntry = findNode(nodes, "백아연");
  if (baekEntry) {
    const [baekKey] = baekEntry;
    nodes[baekKey].nameKo = "백아";
    nodes[baekKey].name = "Baek Ah";
    console.log(`✅ 2. 백아연 → 백아 이름 패치 완료 (node ${baekKey})`);
    patchedNodes++;
  } else {
    // 백아를 직접 찾아보기
    const baekAh = findNode(nodes, "백아");
    if (baekAh) {
      console.log(`ℹ️  2. 백아 이미 올바른 이름 (node ${baekAh[0]})`);
    } else {
      console.log("⚠️  2. 백아/백아연 노드를 찾을 수 없음");
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 3. 패닉 ↔ 이적, 김진표 SAME_GROUP
  // ──────────────────────────────────────────────────────────────────
  console.log("\n🎸 3. 패닉 멤버 연결...");
  const panicEntry = findNode(nodes, "패닉");
  const ijuckEntry = findNode(nodes, "이적");

  // 김진표 — 그래프에 없으면 추가
  let kimJinpyoId: string | null = null;
  const kjpEntry = findNode(nodes, "김진표");
  if (kjpEntry) {
    kimJinpyoId = kjpEntry[1].id;
    console.log(`  이미 존재: 김진표 (${kimJinpyoId})`);
  } else {
    // 새 노드 추가
    const nextNodeKey = String(Math.max(...Object.keys(nodes).map(Number).filter((n) => !isNaN(n))) + 1);
    kimJinpyoId = `manual_kimjinpyo`;
    nodes[nextNodeKey] = {
      id: kimJinpyoId,
      name: "Kim Jin-pyo",
      nameKo: "김진표",
      x: (panicEntry ? panicEntry[1].x : 0) + 60,
      y: (panicEntry ? panicEntry[1].y : 0) - 60,
      degree: 1,
      accent: null,
      image: null,
    };
    addedNodes++;
    console.log(`  ✅ 김진표 노드 추가 (node ${nextNodeKey})`);
  }

  if (panicEntry && ijuckEntry) {
    const panicId = panicEntry[1].id;
    const ijuckId = ijuckEntry[1].id;
    const kjpId = kimJinpyoId!;

    const pairs: [string, string, string][] = [
      [panicId, ijuckId, "패닉 멤버"],
      [panicId, kjpId, "패닉 멤버"],
      [ijuckId, kjpId, "패닉 동료"],
    ];
    for (const [a, b, label] of pairs) {
      const key = edgeKey(a, b);
      if (!existingEdgeKeys.has(key)) {
        edges.push({ source: a, target: b, weight: 1.0, relation: "SAME_GROUP", label });
        existingEdgeKeys.add(key);
        addedEdges++;
        console.log(`  ✅ 연결: 패닉 멤버 엣지 추가 (${label})`);
      } else {
        console.log(`  ℹ️  이미 연결됨: ${label}`);
      }
    }
  } else {
    console.log(`  ⚠️ 패닉(${panicEntry ? "O" : "X"}) 또는 이적(${ijuckEntry ? "O" : "X"}) 노드 없음`);
  }

  // ──────────────────────────────────────────────────────────────────
  // 4. 넥스트 ↔ 신해철 SAME_GROUP
  // ──────────────────────────────────────────────────────────────────
  console.log("\n🎸 4. 넥스트 ↔ 신해철 연결...");
  const nextEntry = findNode(nodes, "넥스트");
  const shinEntry = findNode(nodes, "신해철");

  if (nextEntry && shinEntry) {
    const nextId = nextEntry[1].id;
    const shinId = shinEntry[1].id;
    const key = edgeKey(nextId, shinId);
    if (!existingEdgeKeys.has(key)) {
      edges.push({ source: nextId, target: shinId, weight: 1.0, relation: "SAME_GROUP", label: "넥스트 멤버 (보컬/리더)" });
      existingEdgeKeys.add(key);
      addedEdges++;
      console.log(`  ✅ 넥스트 ↔ 신해철 SAME_GROUP 추가`);
    } else {
      console.log("  ℹ️  넥스트 ↔ 신해철 이미 연결됨");
    }
  } else {
    console.log(`  ⚠️ 넥스트(${nextEntry ? "O" : "X"}) 또는 신해철(${shinEntry ? "O" : "X"}) 노드 없음`);
  }

  // ──────────────────────────────────────────────────────────────────
  // 5. 서태지와 아이들 ↔ 서태지 / 양현석 / 이주노 SAME_GROUP
  // ──────────────────────────────────────────────────────────────────
  console.log("\n🎸 5. 서태지와 아이들 멤버 연결...");
  const stiEntry = findNode(nodes, "서태지와 아이들");
  const seoTaijiEntry = findNode(nodes, "서태지");
  const nextNodeBaseKey = Math.max(...Object.keys(nodes).map(Number).filter((n) => !isNaN(n))) + 1;

  const membersToAdd = [
    { nameKo: "양현석", name: "Yang Hyun-suk", xOff: 80, yOff: -80 },
    { nameKo: "이주노", name: "Lee Juno", xOff: -80, yOff: -80 },
  ];

  const memberIds: string[] = [];

  // 서태지(솔로) 이미 존재
  if (seoTaijiEntry) {
    memberIds.push(seoTaijiEntry[1].id);
    console.log(`  이적 찾음: 서태지 (${seoTaijiEntry[1].id})`);
  }

  // 양현석, 이주노 추가
  for (let i = 0; i < membersToAdd.length; i++) {
    const m = membersToAdd[i];
    const existing = findNode(nodes, m.nameKo);
    if (existing) {
      memberIds.push(existing[1].id);
      console.log(`  이미 존재: ${m.nameKo} (${existing[1].id})`);
    } else {
      const newKey = String(nextNodeBaseKey + i + 1);
      const manualId = `manual_${m.name.replace(/\s+/g, "_").toLowerCase()}`;
      nodes[newKey] = {
        id: manualId,
        name: m.name,
        nameKo: m.nameKo,
        x: (stiEntry ? stiEntry[1].x : 0) + m.xOff,
        y: (stiEntry ? stiEntry[1].y : 0) + m.yOff,
        degree: 1,
        accent: null,
        image: null,
      };
      memberIds.push(manualId);
      addedNodes++;
      console.log(`  ✅ ${m.nameKo} 노드 추가 (node ${newKey})`);
    }
  }

  // 서태지와 아이들 ↔ 각 멤버 연결
  if (stiEntry) {
    const stiId = stiEntry[1].id;
    for (const memberId of memberIds) {
      const key = edgeKey(stiId, memberId);
      if (!existingEdgeKeys.has(key)) {
        const memberNode = Object.values(nodes).find((n: any) => n.id === memberId);
        edges.push({
          source: stiId,
          target: memberId,
          weight: 1.0,
          relation: "SAME_GROUP",
          label: `서태지와 아이들 멤버: ${memberNode?.nameKo || memberId}`,
        });
        existingEdgeKeys.add(key);
        addedEdges++;
        console.log(`  ✅ 서태지와 아이들 ↔ ${memberNode?.nameKo || memberId}`);
      }
    }

    // 멤버 간 상호 연결 (서태지 ↔ 양현석, 서태지 ↔ 이주노, 양현석 ↔ 이주노)
    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const key = edgeKey(memberIds[i], memberIds[j]);
        if (!existingEdgeKeys.has(key)) {
          const na = Object.values(nodes).find((n: any) => n.id === memberIds[i]);
          const nb = Object.values(nodes).find((n: any) => n.id === memberIds[j]);
          edges.push({
            source: memberIds[i],
            target: memberIds[j],
            weight: 0.9,
            relation: "SAME_GROUP",
            label: `서태지와 아이들 동료: ${na?.nameKo || ""} ↔ ${nb?.nameKo || ""}`,
          });
          existingEdgeKeys.add(key);
          addedEdges++;
          console.log(`  ✅ 멤버간: ${na?.nameKo} ↔ ${nb?.nameKo}`);
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // degree 재계산
  // ──────────────────────────────────────────────────────────────────
  for (const node of Object.values(nodes)) {
    node.degree = edges.filter((e) => e.source === node.id || e.target === node.id).length;
  }

  // ──────────────────────────────────────────────────────────────────
  // 저장
  // ──────────────────────────────────────────────────────────────────
  layout.nodes = nodes;
  layout.nodeCount = Object.keys(nodes).length;
  edgeData.edges = edges;
  edgeData.edgeCount = edges.length;
  edgeData.builtAt = new Date().toISOString();

  fs.writeFileSync(LAYOUT_FILE, JSON.stringify(layout, null, 2), "utf-8");
  fs.writeFileSync(EDGES_FILE, JSON.stringify(edgeData, null, 2), "utf-8");

  console.log(`\n🎉 패치 완료!`);
  console.log(`   ✏️  수정된 노드: ${patchedNodes}개`);
  console.log(`   ➕ 추가된 노드: ${addedNodes}개 (총 ${Object.keys(nodes).length}개)`);
  console.log(`   🔗 추가된 엣지: ${addedEdges}개 (총 ${edges.length}개)`);
}

main().catch(console.error);
