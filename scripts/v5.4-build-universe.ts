/**
 * K-Culture Universe V5.4 — 평등형 유기적 네트워크 빌더
 *
 * 역할을 수동으로 부여했던 과거(Tier 0,1,2)를 폐지하고,
 * BFS 크롤러가 수집한 순수 노드/엣지 데이터(organic-graph.json)를 기반으로
 * 1. 노드의 위상(Degree, 엣지 수)을 계산하여 자연스러운 크기를 결정.
 *    (작업을 많이 한 아티스트일수록 거대한 별이 됨 🌟)
 * 2. d3-force를 통해 브라우저 로드를 막는 오프라인 좌표(x,y) 베이킹(Baking) 수행.
 * 3. 클라이언트 최적화를 위한 JSON 3분할(layout, edges, details) 생성.
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

// Ensure directories
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function log(msg: string) {
  console.log(`[BUILD] ${msg}`);
}

async function main() {
  if (!fs.existsSync(GRAPH_IN)) {
    console.error("❌ organic-graph.json이 없습니다. npm run v5:crawl-bfs (혹은 v5.4-bfs-crawler.ts)를 먼저 실행하세요.");
    process.exit(1);
  }

  log("PASS 1: 그래프 데이터 로드 및 정제");
  const rawData = JSON.parse(fs.readFileSync(GRAPH_IN, "utf-8"));
  
  const nodes = new Map<string, any>();
  for (const n of rawData.nodes) {
    nodes.set(n.mbid, {
      id: n.mbid,
      name: n.name,
      nameKo: n.name, // 아직 영문명일 수 있으나 향후 Spotify 연동 시 한국어 병합
      image: n.image,
      genres: n.genres || [],
      popularity: n.popularity || 0,
      previewUrl: null,
      previewTrackName: null,
      spotifyUrl: n.spotifyId ? `https://open.spotify.com/artist/${n.spotifyId}` : null,
      degree: 0, // 초기 위상 값
      accent: null,
    });
  }

  const validEdges = [];
  for (const e of rawData.edges) {
    if (nodes.has(e.source) && nodes.has(e.target)) {
      validEdges.push(e);
      // 간선 수(Degree) 증가
      nodes.get(e.source).degree += 1;
      nodes.get(e.target).degree += 1;
    }
  }

  log(`  로드 완료: 노드 ${nodes.size}개, 엣지 ${validEdges.length}개`);

  // ── 자연스러운 계급 파괴: 위상(Degree)에 따른 크기 산정 ──
  // 기존의 강제 Tier(0, 1, 2)를 제거하고, 오직 연결된 엣지 수로 별의 크기를 정함.
  // 단, UI 컴포넌트 호환성을 위해 tier 속성을 degree 기반으로 동적 부여 (0: 거대, 1: 중간, 2: 작음)
  for (const n of nodes.values()) {
    if (n.degree >= 25) {
      n.tier = 0; // 작업량이 폭발적인 거물급 프로듀서/아티스트
      n.accent = "#a78bfa"; // 기본 악센트 (추후 클러스터 색상으로 다각화 가능)
    } else if (n.degree >= 5) {
      n.tier = 1; // 활발한 협업자
    } else {
      n.tier = 2; // 가끔 작업하는 관계
    }
  }
  
  const t0 = Array.from(nodes.values()).filter(n=>n.tier===0).length;
  const t1 = Array.from(nodes.values()).filter(n=>n.tier===1).length;
  const t2 = Array.from(nodes.values()).filter(n=>n.tier===2).length;
  log(`  위상 분석 완료: 거대별 ${t0}개 / 중간별 ${t1}개 / 작은별 ${t2}개`);

  // PASS 2: 오프라인 D3 좌표 ベ이킹 (Zero Physics)
  log("PASS 2: d3-force Simulation (오프라인 좌표 생성)");
  const nodeArr = Array.from(nodes.values());
  
  // 반발력: 큰 별일수록 주변을 강하게 밀어냄 (Hairball 방지)
  const charge = (n: any) => { return n.tier === 0 ? -4000 : n.tier === 1 ? -1500 : -600; };
  
  // 연결력: weight가 높을수록 가깝게
  const linkArr = validEdges.map((e: any) => ({ source: e.source, target: e.target, weight: e.weight }));

  const sim = d3Force.forceSimulation(nodeArr)
    .force("link", d3Force.forceLink(linkArr).id((d: any) => d.id).distance((l: any) => 300 - ((l.weight ?? 0.5) * 150)).strength(0.4))
    .force("charge", d3Force.forceManyBody().strength(charge).distanceMax(4000))
    // 중앙집중력은 약하게 하여 우주 전체로 고르게 퍼지도록 유도
    .force("center", d3Force.forceCenter(0, 0).strength(0.015))
    .force("collide", d3Force.forceCollide().radius((d: any) => d.tier === 0 ? 120 : d.tier === 1 ? 60 : 30))
    .stop();

  log("  시뮬레이션 시작 (3000 Ticks)...");
  for (let i = 0; i < 3000; i++) {
    sim.tick();
    if ((i + 1) % 500 === 0) log(`    tick ${i + 1}/3000`);
  }

  // 좌표 반올림
  for (const n of nodeArr) {
    n.x = Math.round(n.x ?? 0);
    n.y = Math.round(n.y ?? 0);
  }

  const xs = nodeArr.map(n => n.x);
  const ys = nodeArr.map(n => n.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  log(`  우주 크기: ${Math.round(w)} x ${Math.round(h)} px`);

  // PASS 3: 3분할 JSON 저장 (V5 렌더링 파이프라인)
  log("PASS 3: JSON 3분할 저장");
  
  const layoutOut = {
    version: "5.4", 
    builtAt: new Date().toISOString(),
    nodeCount: nodeArr.length,
    nodes: nodeArr.map(n => ({ id: n.id, name: n.name, nameKo: n.nameKo, x: n.x, y: n.y, tier: n.tier, accent: n.accent }))
  };

  const edgesOut = {
    version: "5.4",
    builtAt: new Date().toISOString(),
    edgeCount: validEdges.length,
    edges: validEdges
  };

  const detailsOut = {
    version: "5.4",
    builtAt: new Date().toISOString(),
    nodes: Object.fromEntries(nodeArr.map(n => [
      n.id,
      { image: n.image, genres: n.genres, popularity: n.popularity, previewUrl: n.previewUrl, previewTrackName: n.previewTrackName, spotifyUrl: n.spotifyUrl }
    ]))
  };

  fs.writeFileSync(OUT_LAYOUT, JSON.stringify(layoutOut), "utf-8");
  fs.writeFileSync(OUT_EDGES, JSON.stringify(edgesOut), "utf-8");
  fs.writeFileSync(OUT_DETAILS, JSON.stringify(detailsOut), "utf-8");
  
  // 기존 앱(Page.tsx) 구동을 위한 Compat 파일 저장
  const compatOut = {
    version: 5, builtAt: new Date().toISOString(), nodeCount: nodeArr.length, edgeCount: validEdges.length,
    nodes: Object.fromEntries(nodeArr.map(n => [n.id, n])), edges: validEdges
  };
  fs.writeFileSync(OUT_COMPAT, JSON.stringify(compatOut), "utf-8");

  const lkb = Math.round(Buffer.byteLength(JSON.stringify(layoutOut), "utf-8") / 1024);
  const ekb = Math.round(Buffer.byteLength(JSON.stringify(edgesOut), "utf-8") / 1024);
  const dkb = Math.round(Buffer.byteLength(JSON.stringify(detailsOut), "utf-8") / 1024);

  log("=== V5.4 Build Verification ===");
  log(`Files: layout=${lkb}KB, edges=${ekb}KB, details=${dkb}KB`);
  log("V5.4 ORGANIC GRAPH BUILT SUCCESSFULLY! 🚀");
}

main().catch(console.error);
