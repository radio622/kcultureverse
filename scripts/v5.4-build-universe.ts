/**
 * K-Culture Universe V6.1 — Egalitarian Network Builder
 *
 * V6.1 빌드 파이프라인:
 *   PASS 1: 원본 그래프 로드 + degree 계산
 *   PASS 2: K-Culture 필터링 (해외 아티스트 제거)
 *   PASS 3: 하이브리드 노드 필터 (degree < 3 제거 + 매개 엣지 생성)
 *   PASS 4: d3-force 좌표 베이킹
 *   PASS 5: JSON 3분할 저장
 */

import fs from "fs";
import path from "path";
import * as d3Force from "d3-force";

const CACHE_DIR = path.join(process.cwd(), "scripts", ".cache", "v5.4");
const GRAPH_IN = path.join(CACHE_DIR, "organic-graph.json");

const OUT_DIR = path.join(process.cwd(), "public", "data");
const OUT_LAYOUT = path.join(OUT_DIR, "v5-layout.json");
const OUT_EDGES = path.join(OUT_DIR, "v5-edges.json");
const OUT_DETAILS = path.join(OUT_DIR, "v5-details.json");
const OUT_COMPAT = path.join(OUT_DIR, "universe-graph-v5.json");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function log(msg: string) { console.log(`[BUILD] ${msg}`); }

// ── 유틸리티 ────────────────────────────────────────────

// relation 매핑 (MB raw role -> V6 표준)
function mapRelation(raw: string): string {
  const r = (raw || "").toUpperCase();
  if (r === "MEMBER" || r === "GROUP") return "SAME_GROUP";
  if (r === "COMPOSER" || r === "LYRICIST" || r === "WRITER") return "WRITER";
  if (r === "PRODUCER" || r === "CO-PRODUCER") return "PRODUCER";
  if (r === "FEATURED" || r === "VOCAL" || r === "GUEST") return "FEATURED";
  return "INDIRECT";
}

// label 자동 생성
function autoLabel(relation: string): string {
  const m: Record<string, string> = {
    SAME_GROUP: "그룹 멤버", WRITER: "작곡/작사",
    PRODUCER: "프로듀서", FEATURED: "피처링",
    SHARED_WRITER: "공유 작사/작곡가", SHARED_PRODUCER: "공유 프로듀서",
    INDIRECT: "협업",
  };
  return m[relation] || "관련";
}

// seed-artists.ts의 Spotify ID 목록 (K-Culture 핵심 아티스트)
// 이들의 MusicBrainz MBID와 매칭하여 K-Culture 판정의 기준점으로 사용
const SEED_MBIDS = new Set<string>(); // PASS 1에서 depth=0 노드로 채워짐
// 명백히 K-Culture와 무관한 해외 아티스트 블랙리스트
// (MusicBrainz 크레딧 체인에서 우연히 연결된 클래식/재즈/팝 시대 인물)
const NON_KCULTURE_BLOCKLIST = new Set([
  "Nat King Cole", "Louis Armstrong", "Duke Ellington", "Doris Day",
  "Irving Berlin", "Sammy Cahn", "Sammy Fain", "Nelson Riddle",
  "Johnny Mercer", "Oscar Moore", "Victor Herbert", "Leonard Feather",
  "Paul Francis Webster", "Al Dubin", "Jimmy Kennedy", "Nat Simon",
  "David Guetta", "Ariana Grande", "Selena Gomez", "Cardi B",
  "Diplo", "Fred again..", "Rakim",
]);

// ── 메인 ────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(GRAPH_IN)) {
    console.error("organic-graph.json 없음. npm run v5:crawl-bfs 먼저 실행.");
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(GRAPH_IN, "utf-8"));

  // ══════════════════════════════════════════════════════
  // PASS 1: 원본 그래프 로드 + 기초 degree 계산
  // ══════════════════════════════════════════════════════
  log("PASS 1: 원본 그래프 로드");

  // 원본 노드 맵 (mbid -> raw node)
  const rawNodes = new Map<string, any>();
  for (const n of rawData.nodes) {
    rawNodes.set(n.mbid, n);
    if (n.depth === 0) SEED_MBIDS.add(n.mbid);
  }

  // 원본 degree 계산 (필터링 전)
  const rawDegree = new Map<string, number>();
  for (const e of rawData.edges) {
    rawDegree.set(e.source, (rawDegree.get(e.source) || 0) + 1);
    rawDegree.set(e.target, (rawDegree.get(e.target) || 0) + 1);
  }

  log(`  원본: 노드 ${rawNodes.size}개, 엣지 ${rawData.edges.length}개`);
  log(`  Seed (Depth 0): ${SEED_MBIDS.size}명`);

  // ══════════════════════════════════════════════════════
  // PASS 2: K-Culture 필터링
  // ══════════════════════════════════════════════════════
  log("PASS 2: K-Culture 필터링");

  // Seed의 직접 1촌 MBID 수집 (국적 무관 포함)
  const seedHop1 = new Set<string>();
  for (const e of rawData.edges) {
    if (SEED_MBIDS.has(e.source)) seedHop1.add(e.target);
    if (SEED_MBIDS.has(e.target)) seedHop1.add(e.source);
  }

  // K-Culture 통과 조건:
  //   (a) Seed 아티스트 (depth 0) → 무조건 통과
  //   (b) Seed의 직접 1촌 → 1차 통과 후 K-proximity 2차 검증
  //   (c) 2촌 이상 → 통과한 노드와 직접 연결 + degree ≥ 3
  //
  // K-proximity 2차 검증 (1촌 대상):
  //   1촌이라도 "Seed 1개와만 연결된 순수 해외 아티스트"는 제거
  //   예: Ariana Grande → BLACKPINK 곡 크레딧 1건만 → K-Culture 핵심이 아님
  //   반면: Teddy → BTS, 2NE1, BLACKPINK 다수 작업 → K-Culture 핵심
  const kCulturePass = new Set<string>();

  // (a) Seed: 무조건 통과
  for (const [mbid, n] of rawNodes) {
    if ((n.depth ?? 99) === 0) kCulturePass.add(mbid);
  }

  // (b) 1촌: 2단계 K-proximity 검증
  //   1차: Seed 2개 이상과 작업 → 즉시 통과
  //   2차: Seed 1개지만, 이미 통과한 다른 이웃이 2명 이상 → 추가 통과
  
  // 1차 패스
  const hop1Candidates = new Map<string, number>(); // mbid -> connectedSeedCount
  for (const mbid of seedHop1) {
    if (SEED_MBIDS.has(mbid)) continue;
    const connectedSeeds = new Set<string>();
    for (const e of rawData.edges) {
      if (e.source === mbid && SEED_MBIDS.has(e.target)) connectedSeeds.add(e.target);
      if (e.target === mbid && SEED_MBIDS.has(e.source)) connectedSeeds.add(e.source);
    }
    hop1Candidates.set(mbid, connectedSeeds.size);
    if (connectedSeeds.size >= 2) {
      kCulturePass.add(mbid); // Seed 2개+ → 즉시 통과
    }
  }
  
  // 2차 패스: Seed 1개만이지만, 이웃 중 이미 통과한 노드가 2명 이상
  for (const [mbid, seedCount] of hop1Candidates) {
    if (kCulturePass.has(mbid)) continue; // 이미 통과
    if (seedCount < 1) continue;
    
    let passedNeighbors = 0;
    for (const e of rawData.edges) {
      if (e.source === mbid && kCulturePass.has(e.target)) passedNeighbors++;
      if (e.target === mbid && kCulturePass.has(e.source)) passedNeighbors++;
    }
    
    if (passedNeighbors >= 2) {
      kCulturePass.add(mbid);
    }
  }

  // 블랙리스트 적용: 이름 기반으로 명백한 해외 아티스트 제거
  for (const [mbid, n] of rawNodes) {
    if (NON_KCULTURE_BLOCKLIST.has(n.name)) {
      kCulturePass.delete(mbid);
    }
  }

  // (c) 2촌: 이미 통과한 노드와 직접 연결 + degree ≥ 3
  for (const e of rawData.edges) {
    if (kCulturePass.has(e.source) && !kCulturePass.has(e.target)) {
      const target = rawNodes.get(e.target);
      const targetDeg = rawDegree.get(e.target) || 0;
      if (target && (target.depth ?? 99) >= 2 && targetDeg >= 1) {
        kCulturePass.add(e.target);
      }
    }
    if (kCulturePass.has(e.target) && !kCulturePass.has(e.source)) {
      const source = rawNodes.get(e.source);
      const sourceDeg = rawDegree.get(e.source) || 0;
      if (source && (source.depth ?? 99) >= 2 && sourceDeg >= 1) {
        kCulturePass.add(e.source);
      }
    }
  }

  log(`  K-Culture 통과: ${kCulturePass.size}명 (${rawNodes.size} → ${kCulturePass.size}, ${Math.round((1 - kCulturePass.size / rawNodes.size) * 100)}% 감소)`);

  // ══════════════════════════════════════════════════════
  // PASS 3: 하이브리드 노드 필터 + 매개 엣지 생성
  // ══════════════════════════════════════════════════════
  log("PASS 3: 하이브리드 노드 필터 + 매개 엣지");

  // K-Culture 통과한 노드들 사이의 엣지만 남김
  const filteredEdges: any[] = [];
  for (const e of rawData.edges) {
    if (kCulturePass.has(e.source) && kCulturePass.has(e.target)) {
      filteredEdges.push(e);
    }
  }

  // 필터링 후 degree 재계산
  const filteredDegree = new Map<string, number>();
  for (const e of filteredEdges) {
    filteredDegree.set(e.source, (filteredDegree.get(e.source) || 0) + 1);
    filteredDegree.set(e.target, (filteredDegree.get(e.target) || 0) + 1);
  }

  // 인접 리스트 구축 (매개 엣지 생성용)
  const adjacency = new Map<string, Set<string>>();
  const edgeRelation = new Map<string, string>(); // "a::b" -> relation
  for (const e of filteredEdges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, new Set());
    if (!adjacency.has(e.target)) adjacency.set(e.target, new Set());
    adjacency.get(e.source)!.add(e.target);
    adjacency.get(e.target)!.add(e.source);
    const key = [e.source, e.target].sort().join("::");
    edgeRelation.set(key, e.relation);
  }

  // 하이브리드 필터: degree < 1인 노드를 "보이지 않는 매개자"로 처리 (기존 3에서 1로 완화)
  const MIN_DEGREE = 1;
  const keepNodes = new Set<string>();
  const removeNodes = new Set<string>();

  for (const mbid of kCulturePass) {
    const deg = filteredDegree.get(mbid) || 0;
    if (deg >= MIN_DEGREE || SEED_MBIDS.has(mbid)) {
      keepNodes.add(mbid);
    } else {
      removeNodes.add(mbid);
    }
  }

  // 매개 엣지 생성: 제거되는 노드가 연결하던 양쪽을 직접 연결
  const mediatedEdges: any[] = [];
  for (const removedMbid of removeNodes) {
    const neighbors = adjacency.get(removedMbid);
    if (!neighbors || neighbors.size < 2) continue;

    // 이 매개자의 이웃 중 keepNodes에 있는 것들끼리 직접 연결
    const keptNeighbors = Array.from(neighbors).filter(n => keepNodes.has(n));
    if (keptNeighbors.length < 2) continue;

    // 매개자의 관계 유형 파악
    const removedName = rawNodes.get(removedMbid)?.name || "알 수 없음";
    const sampleKey = [removedMbid, keptNeighbors[0]].sort().join("::");
    const sampleRel = edgeRelation.get(sampleKey) || "INDIRECT";
    const mediatedRelation = sampleRel === "COMPOSER" || sampleRel === "LYRICIST" || sampleRel === "WRITER"
      ? "SHARED_WRITER"
      : sampleRel === "PRODUCER"
      ? "SHARED_PRODUCER"
      : "INDIRECT";

    // 모든 이웃 쌍에 매개 엣지 (단, 이미 직접 연결이 없는 경우만)
    for (let i = 0; i < keptNeighbors.length; i++) {
      for (let j = i + 1; j < keptNeighbors.length; j++) {
        const a = keptNeighbors[i], b = keptNeighbors[j];
        const directKey = [a, b].sort().join("::");
        if (!edgeRelation.has(directKey)) {
          mediatedEdges.push({
            source: a, target: b, weight: 0.3,
            relation: mediatedRelation,
            label: `${autoLabel(mediatedRelation)}: ${removedName}`,
            via: removedName,
          });
          edgeRelation.set(directKey, mediatedRelation); // 중복 방지
        }
      }
    }
  }

  log(`  유지 노드: ${keepNodes.size}명, 제거 노드: ${removeNodes.size}명`);
  log(`  매개 엣지 생성: ${mediatedEdges.length}개`);

  // 최종 노드/엣지 구성
  const nodes = new Map<string, any>();
  for (const mbid of keepNodes) {
    const raw = rawNodes.get(mbid)!;
    nodes.set(mbid, {
      id: mbid, name: raw.name, nameKo: raw.nameKo || raw.name,
      image: raw.image, genres: raw.genres || [], popularity: raw.popularity || 0,
      previewUrl: raw.previewUrl || null, previewTrackName: raw.previewTrackName || null,
      spotifyUrl: raw.spotifyId ? `https://open.spotify.com/artist/${raw.spotifyId}` : null,
      degree: 0, accent: null,
    });
  }

  const finalEdges: any[] = [];
  // 직접 엣지 (keepNodes끼리만)
  for (const e of filteredEdges) {
    if (keepNodes.has(e.source) && keepNodes.has(e.target)) {
      const rel = mapRelation(e.relation);
      finalEdges.push({
        source: e.source, target: e.target, weight: e.weight,
        relation: rel, label: e.label || autoLabel(rel),
      });
    }
  }
  // 매개 엣지 추가
  for (const me of mediatedEdges) {
    finalEdges.push(me);
  }

  // 최종 degree 계산
  for (const e of finalEdges) {
    if (nodes.has(e.source)) nodes.get(e.source).degree += 1;
    if (nodes.has(e.target)) nodes.get(e.target).degree += 1;
  }

  // degree 0 고립 노드 제거
  const isolated: string[] = [];
  for (const [mbid, n] of nodes) {
    if (n.degree === 0 && !SEED_MBIDS.has(mbid)) isolated.push(mbid);
  }
  for (const mbid of isolated) nodes.delete(mbid);
  if (isolated.length > 0) log(`  고립 노드 ${isolated.length}개 제거`);

  // degree 기반 accent (V6.1: degree 8+ 로 기준 낮춤)
  for (const n of nodes.values()) {
    if (n.degree >= 8) n.accent = n.accent || "#a78bfa";
  }

  const majorCount = Array.from(nodes.values()).filter(n => n.degree >= 8).length;
  log(`  최종: 노드 ${nodes.size}개, 엣지 ${finalEdges.length}개`);
  log(`  거대별(8+): ${majorCount}개`);

  // ══════════════════════════════════════════════════════
  // PASS 4: d3-force 좌표 베이킹
  // ══════════════════════════════════════════════════════
  log("PASS 4: d3-force Simulation");
  const nodeArr = Array.from(nodes.values());
  const charge = (n: any) => -200 * Math.sqrt((n.degree ?? 0) + 1);
  const linkArr = finalEdges.map((e: any) => ({ source: e.source, target: e.target, weight: e.weight }));

  const sim = d3Force.forceSimulation(nodeArr)
    .force("link", d3Force.forceLink(linkArr).id((d: any) => d.id)
      .distance((l: any) => 300 - ((l.weight ?? 0.5) * 150)).strength(0.4))
    .force("charge", d3Force.forceManyBody().strength(charge).distanceMax(4000))
    .force("center", d3Force.forceCenter(0, 0).strength(0.015))
    .force("collide", d3Force.forceCollide().radius((d: any) => 15 + Math.sqrt(d.degree ?? 0) * 8))
    .stop();

  for (let i = 0; i < 3000; i++) {
    sim.tick();
    if ((i + 1) % 500 === 0) log(`  tick ${i + 1}/3000`);
  }
  for (const n of nodeArr) { n.x = Math.round(n.x ?? 0); n.y = Math.round(n.y ?? 0); }

  const xs = nodeArr.map(n => n.x), ys = nodeArr.map(n => n.y);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  log(`  우주 크기: ${Math.round(w)} x ${Math.round(h)} px`);

  // ══════════════════════════════════════════════════════
  // PASS 5: JSON 3분할 저장
  // ══════════════════════════════════════════════════════
  log("PASS 5: JSON 저장");
  const layoutOut = {
    version: "6.1", builtAt: new Date().toISOString(), nodeCount: nodeArr.length,
    nodes: nodeArr.map(n => ({
      id: n.id, name: n.name, nameKo: n.nameKo,
      x: n.x, y: n.y, degree: n.degree, accent: n.accent,
    })),
  };
  const edgesOut = {
    version: "6.1", builtAt: new Date().toISOString(),
    edgeCount: finalEdges.length, edges: finalEdges,
  };
  const detailsOut = {
    version: "6.1", builtAt: new Date().toISOString(),
    nodes: Object.fromEntries(nodeArr.map(n => [n.id, {
      image: n.image, genres: n.genres, popularity: n.popularity,
      previewUrl: n.previewUrl, previewTrackName: n.previewTrackName,
      spotifyUrl: n.spotifyUrl,
    }])),
  };
  const compatOut = {
    version: 5, builtAt: new Date().toISOString(),
    nodeCount: nodeArr.length, edgeCount: finalEdges.length,
    nodes: Object.fromEntries(nodeArr.map(n => [n.id, n])),
    edges: finalEdges,
  };

  fs.writeFileSync(OUT_LAYOUT, JSON.stringify(layoutOut), "utf-8");
  fs.writeFileSync(OUT_EDGES, JSON.stringify(edgesOut), "utf-8");
  fs.writeFileSync(OUT_DETAILS, JSON.stringify(detailsOut), "utf-8");
  fs.writeFileSync(OUT_COMPAT, JSON.stringify(compatOut), "utf-8");

  const lkb = Math.round(Buffer.byteLength(JSON.stringify(layoutOut), "utf-8") / 1024);
  const ekb = Math.round(Buffer.byteLength(JSON.stringify(edgesOut), "utf-8") / 1024);
  const dkb = Math.round(Buffer.byteLength(JSON.stringify(detailsOut), "utf-8") / 1024);

  log("=== V6.1 Build Complete ===");
  log(`Files: layout=${lkb}KB, edges=${ekb}KB, details=${dkb}KB`);
  log("V6.1 EGALITARIAN GRAPH BUILT!");
}

main().catch(console.error);
