import * as fs from "fs";
import * as path from "path";
import * as d3Force from "d3-force";

require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
import { HUB_ARTISTS } from "../src/data/hub-artists";

const HUB_DIR    = path.resolve(__dirname, "../public/data/hub");
const CACHE_DIR  = path.resolve(__dirname, ".cache");
const OUT_LAYOUT  = path.resolve(__dirname, "../public/data/v5-layout.json");
const OUT_EDGES   = path.resolve(__dirname, "../public/data/v5-edges.json");
const OUT_DETAILS = path.resolve(__dirname, "../public/data/v5-details.json");
const OUT_COMPAT  = path.resolve(__dirname, "../public/data/universe-graph-v5.json");

type NodeTier = 0 | 1 | 2;
type EdgeRelation = "SAME_GROUP" | "FEATURED" | "PRODUCER" | "WRITER" | "INDIRECT" | "GENRE_OVERLAP";

interface V5Node {
  id: string; name: string; nameKo: string;
  image: string | null; genres: string[]; popularity: number;
  previewUrl: string | null; previewTrackName: string | null;
  spotifyUrl: string | null; tier: NodeTier; accent?: string;
  x?: number; y?: number;
}

interface V5Edge {
  source: string; target: string; weight: number;
  relation: EdgeRelation; label: string;
}

function log(msg: string) { console.log("[V5.3] " + msg); }
function ensureDir(dir: string) { fs.mkdirSync(dir, { recursive: true }); }

function colorSimilarity(hex1: string, hex2: string): number {
  try {
    const h1 = hex1.replace("#", ""), h2 = hex2.replace("#", "");
    const r1 = parseInt(h1.slice(0,2),16), g1 = parseInt(h1.slice(2,4),16), b1 = parseInt(h1.slice(4,6),16);
    const r2 = parseInt(h2.slice(0,2),16), g2 = parseInt(h2.slice(2,4),16), b2 = parseInt(h2.slice(4,6),16);
    const dist = Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2);
    return Math.max(0, 1 - dist / 441.67);
  } catch { return 0; }
}

async function main() {
  log("Universe V5.3 Builder Start");
  log("Hubs: " + HUB_ARTISTS.length);

  const nodes: Record<string, V5Node> = {};
  const edges: V5Edge[] = [];
  const edgeSet = new Set<string>();
  const hubAccentMap = new Map(HUB_ARTISTS.map((h) => [h.spotifyId, h.accent]));

  function addEdge(e: V5Edge) {
    if (e.source === e.target) return;
    const key = [e.source, e.target].sort().join("||") + "||" + e.relation;
    if (edgeSet.has(key)) return;
    edgeSet.add(key); edges.push(e);
  }

  // PASS 1: hub JSON
  log("PASS 1: Hub JSON...");
  const PURE = new Set(["SAME_GROUP","FEATURED","PRODUCER","WRITER"]);
  const relMap: Record<string, EdgeRelation> = { SAME_GROUP:"SAME_GROUP", PRODUCER:"PRODUCER", FEATURED:"FEATURED", WRITER:"WRITER" };

  for (const hub of HUB_ARTISTS) {
    const fp = path.join(HUB_DIR, hub.spotifyId + ".json");
    if (!fs.existsSync(fp)) continue;
    const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
    const core = data.core;
    nodes[hub.spotifyId] = {
      id: hub.spotifyId, name: core.name, nameKo: hub.nameKo,
      image: core.imageUrl, genres: core.genres ?? [], popularity: core.popularity ?? 0,
      previewUrl: core.previewUrl, previewTrackName: core.previewTrackName,
      spotifyUrl: core.spotifyUrl, tier: 0, accent: hub.accent,
    };
    for (const sat of data.satellites) {
      if (!PURE.has(sat.relationType)) continue;
      if (!nodes[sat.spotifyId]) {
        nodes[sat.spotifyId] = {
          id: sat.spotifyId, name: sat.name, nameKo: sat.name,
          image: sat.imageUrl, genres: sat.genres ?? [], popularity: sat.popularity ?? 0,
          previewUrl: sat.previewUrl, previewTrackName: sat.previewTrackName,
          spotifyUrl: sat.spotifyUrl, tier: 1,
        };
      }
      addEdge({ source: hub.spotifyId, target: sat.spotifyId, weight: 0.8, relation: relMap[sat.relationType] || "FEATURED", label: sat.relationKeyword || sat.relationType });
    }
  }
  log("  Hubs: " + Object.values(nodes).filter(n=>n.tier===0).length + ", Sats: " + Object.values(nodes).filter(n=>n.tier===1).length + ", Edges: " + edges.length);

  // PASS 2: MB crawl
  log("PASS 2: MB crawl merge...");
  const edgesPath = path.join(CACHE_DIR, "featured-edges.json");
  const artistsPath = path.join(CACHE_DIR, "new-artists.json");
  if (fs.existsSync(edgesPath)) {
    const crawledEdges = JSON.parse(fs.readFileSync(edgesPath, "utf-8")) as any[];
    const crawledArtists = fs.existsSync(artistsPath) ? JSON.parse(fs.readFileSync(artistsPath, "utf-8")) as any[] : [];
    const mbMap = new Map(crawledArtists.map((a: any) => [a.mbid, a]));
    let nc=0, ec=0;
    for (const ce of crawledEdges) {
      if (!nodes[ce.target]) {
        const mb = mbMap.get(ce.target) as any;
        nodes[ce.target] = { id: ce.target, name: ce.targetName, nameKo: ce.targetName, image: mb?.image??null, genres: [], popularity: 0, previewUrl: null, previewTrackName: null, spotifyUrl: null, tier: 2 };
        nc++;
      }
      const pl = edges.length;
      addEdge({ source: ce.source, target: ce.target, weight: ce.weight, relation: (ce.relation as EdgeRelation)||"FEATURED", label: "협업/멤버" });
      if (edges.length > pl) ec++;
    }
    log("  tier-2 nodes: " + nc + ", edges: " + ec);
  }

  // PASS 3: mb_ note
  log("PASS 3: mb_ nodes (name-only, no Spotify — 403 blocked)");
  log("  mb_ count: " + Object.values(nodes).filter(n=>n.id.startsWith("mb_")).length);
  log("  total nodes: " + Object.keys(nodes).length + ", edges: " + edges.length);

  // PASS 4: color cross-edges
  log("PASS 4: Hub accent-color cross-edges...");
  const hubList = Object.values(nodes).filter(n=>n.tier===0);
  let cc=0;
  for (let i=0;i<hubList.length;i++) for (let j=i+1;j<hubList.length;j++) {
    const a=hubList[i], b=hubList[j];
    const sim = colorSimilarity(hubAccentMap.get(a.id)??"#888", hubAccentMap.get(b.id)??"#888");
    if (sim >= 0.95) { const pl=edges.length; addEdge({ source:a.id, target:b.id, weight:sim*0.3, relation:"GENRE_OVERLAP", label:"genre-similar" }); if(edges.length>pl) cc++; }
  }
  log("  cross-edges: " + cc);

  // PASS 5: d3-force 3000 ticks
  log("PASS 5: d3-force simulation 3000 ticks...");
  const nodeArr = Object.values(nodes) as (V5Node & d3Force.SimulationNodeDatum)[];
  const linkArr = edges.filter(e=>nodes[e.source]&&nodes[e.target]).map(e=>({ source:e.source, target:e.target, weight:e.weight }));
  const charge = (n: d3Force.SimulationNodeDatum) => { const nd=n as V5Node; return nd.tier===0?-3000:nd.tier===1?-1200:-500; };
  const sim = d3Force.forceSimulation(nodeArr)
    .force("link", d3Force.forceLink(linkArr).id((d)=>(d as V5Node).id).distance((l: any)=>300-((l.weight??0.5)*150)).strength(0.5))
    .force("charge", d3Force.forceManyBody().strength(charge))
    .force("center", d3Force.forceCenter(0,0).strength(0.01))
    .force("collide", d3Force.forceCollide().radius((d)=>{ const nd=d as V5Node; return nd.tier===0?100:nd.tier===1?55:28; }))
    .stop();
  for (let i=0;i<3000;i++) { sim.tick(); if((i+1)%500===0) log("  tick "+(i+1)+"/3000"); }
  for (const n of nodeArr) { nodes[n.id].x=Math.round((n as any).x??0); nodes[n.id].y=Math.round((n as any).y??0); }
  const xs=Object.values(nodes).map(n=>n.x??0), ys=Object.values(nodes).map(n=>n.y??0);
  const w=Math.max(...xs)-Math.min(...xs), h=Math.max(...ys)-Math.min(...ys);
  log("  size: " + Math.round(w) + " x " + Math.round(h));

  // PASS 6: save JSON
  log("PASS 6: Save 3-split JSON...");
  const nv = Object.values(nodes);
  const ve = edges.filter(e=>nodes[e.source]&&nodes[e.target]);
  const layout  = { version:"5.3", builtAt: new Date().toISOString(), nodeCount:nv.length, nodes: nv.map(n=>({ id:n.id, name:n.name, nameKo:n.nameKo, x:n.x??0, y:n.y??0, tier:n.tier, accent:n.accent })) };
  const edgeOut = { version:"5.3", builtAt: new Date().toISOString(), edgeCount:ve.length, edges:ve };
  const detOut  = { version:"5.3", builtAt: new Date().toISOString(), nodes: Object.fromEntries(nv.map(n=>[n.id,{ image:n.image, genres:n.genres, popularity:n.popularity, previewUrl:n.previewUrl, previewTrackName:n.previewTrackName, spotifyUrl:n.spotifyUrl }])) };
  const compat  = { version:5, builtAt: new Date().toISOString(), nodeCount:nv.length, edgeCount:ve.length, nodes:Object.fromEntries(nv.map(n=>[n.id,n])), edges:ve };
  ensureDir(path.dirname(OUT_LAYOUT));
  fs.writeFileSync(OUT_LAYOUT,  JSON.stringify(layout),   "utf-8");
  fs.writeFileSync(OUT_EDGES,   JSON.stringify(edgeOut),  "utf-8");
  fs.writeFileSync(OUT_DETAILS, JSON.stringify(detOut),   "utf-8");
  fs.writeFileSync(OUT_COMPAT,  JSON.stringify(compat),   "utf-8");

  const lkb  = Math.round(Buffer.byteLength(JSON.stringify(layout),"utf-8")/1024);
  const ekb  = Math.round(Buffer.byteLength(JSON.stringify(edgeOut),"utf-8")/1024);
  const dkb  = Math.round(Buffer.byteLength(JSON.stringify(detOut),"utf-8")/1024);
  const ckb  = Math.round(Buffer.byteLength(JSON.stringify(compat),"utf-8")/1024);

  log("=== DoD Verification ===");
  log("Nodes>=300:    " + (nv.length>=300?"PASS":"FAIL") + " (" + nv.length + ")");
  log("Edges>=200:    " + (ve.length>=200?"PASS":"FAIL") + " (" + ve.length + ")");
  log("All coords:    " + (nv.every(n=>n.x!==undefined)?"PASS":"FAIL"));
  log("Size>=8000px:  " + (w>=8000&&h>=8000?"PASS":"FAIL") + " (" + Math.round(w) + "x" + Math.round(h) + ")");
  log("layout<=500KB: " + (lkb<=500?"PASS":"FAIL") + " (" + lkb + "KB)");
  log("Files: layout=" + lkb + "KB, edges=" + ekb + "KB, details=" + dkb + "KB, compat=" + ckb + "KB");
  if(nv.length>=300&&ve.length>=200&&nv.every(n=>n.x!==undefined)&&w>=8000&&h>=8000&&lkb<=500) {
    log("ALL PASS - Task 2-1 & 2-2 DONE");
  } else { log("SOME FAIL - check params"); }
}

main().catch(e=>{ console.error(e); process.exit(1); });
