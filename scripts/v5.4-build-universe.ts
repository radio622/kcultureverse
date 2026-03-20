/**
 * K-Culture Universe V5.5 - Egalitarian Network Builder
 * 모든 아티스트는 평등하다. 계급(tier) 없음.
 * degree(연결 수)에 비례하는 연속적 스케일로만 자연 결정.
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

// relation 매핑 (MB raw role -> V5 표준)
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
    PRODUCER: "프로듀서", FEATURED: "피처링", INDIRECT: "협업",
  };
  return m[relation] || "관련";
}

async function main() {
  if (!fs.existsSync(GRAPH_IN)) {
    console.error("organic-graph.json 없음. npm run v5:crawl-bfs 먼저 실행.");
    process.exit(1);
  }

  log("PASS 1: 그래프 데이터 로드 및 정제");
  const rawData = JSON.parse(fs.readFileSync(GRAPH_IN, "utf-8"));

  const nodes = new Map<string, any>();
  for (const n of rawData.nodes) {
    nodes.set(n.mbid, {
      id: n.mbid, name: n.name, nameKo: n.name,
      image: n.image, genres: n.genres || [], popularity: n.popularity || 0,
      previewUrl: null, previewTrackName: null,
      spotifyUrl: n.spotifyId ? `https://open.spotify.com/artist/${n.spotifyId}` : null,
      degree: 0, accent: null,
    });
  }

  const validEdges: any[] = [];
  for (const e of rawData.edges) {
    if (nodes.has(e.source) && nodes.has(e.target)) {
      const rel = mapRelation(e.relation);
      validEdges.push({
        source: e.source, target: e.target, weight: e.weight,
        relation: rel, label: e.label || autoLabel(rel),
      });
      nodes.get(e.source).degree += 1;
      nodes.get(e.target).degree += 1;
    }
  }

  log(`  로드: 노드 ${nodes.size}개, 엣지 ${validEdges.length}개`);

  // degree 기반 accent (연결 15+ 별만)
  for (const n of nodes.values()) {
    if (n.degree >= 15) n.accent = n.accent || "#a78bfa";
  }
  const majorCount = Array.from(nodes.values()).filter(n => n.degree >= 15).length;
  log(`  거대별(15+): ${majorCount}개 / 전체: ${nodes.size}개`);

  // PASS 2: d3-force 오프라인 좌표 베이킹
  log("PASS 2: d3-force Simulation");
  const nodeArr = Array.from(nodes.values());
  const charge = (n: any) => -200 * Math.sqrt((n.degree ?? 0) + 1);
  const linkArr = validEdges.map((e: any) => ({ source: e.source, target: e.target, weight: e.weight }));

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

  // PASS 3: JSON 3분할 저장
  log("PASS 3: JSON 저장");
  const layoutOut = { version: "5.5", builtAt: new Date().toISOString(), nodeCount: nodeArr.length,
    nodes: nodeArr.map(n => ({ id: n.id, name: n.name, nameKo: n.nameKo, x: n.x, y: n.y, degree: n.degree, accent: n.accent })) };
  const edgesOut = { version: "5.5", builtAt: new Date().toISOString(), edgeCount: validEdges.length, edges: validEdges };
  const detailsOut = { version: "5.5", builtAt: new Date().toISOString(),
    nodes: Object.fromEntries(nodeArr.map(n => [n.id, { image: n.image, genres: n.genres, popularity: n.popularity, previewUrl: n.previewUrl, previewTrackName: n.previewTrackName, spotifyUrl: n.spotifyUrl }])) };
  const compatOut = { version: 5, builtAt: new Date().toISOString(), nodeCount: nodeArr.length, edgeCount: validEdges.length,
    nodes: Object.fromEntries(nodeArr.map(n => [n.id, n])), edges: validEdges };

  fs.writeFileSync(OUT_LAYOUT, JSON.stringify(layoutOut), "utf-8");
  fs.writeFileSync(OUT_EDGES, JSON.stringify(edgesOut), "utf-8");
  fs.writeFileSync(OUT_DETAILS, JSON.stringify(detailsOut), "utf-8");
  fs.writeFileSync(OUT_COMPAT, JSON.stringify(compatOut), "utf-8");

  const lkb = Math.round(Buffer.byteLength(JSON.stringify(layoutOut), "utf-8") / 1024);
  const ekb = Math.round(Buffer.byteLength(JSON.stringify(edgesOut), "utf-8") / 1024);
  const dkb = Math.round(Buffer.byteLength(JSON.stringify(detailsOut), "utf-8") / 1024);

  log("=== V5.5 Build Complete ===");
  log(`Files: layout=${lkb}KB, edges=${ekb}KB, details=${dkb}KB`);
  log("V5.5 EGALITARIAN GRAPH BUILT!");
}

main().catch(console.error);
