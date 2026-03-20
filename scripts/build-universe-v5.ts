/**
 * 🌌 K-Culture Universe V5 — Universe Graph Builder
 *
 * 역할:
 *   1) 기존 public/data/hub/*.json (허브 62개)에서 1-hop 노드/엣지 추출
 *   2) 위성이 6명 미만인 허브에 대해 MusicBrainz 2-hop 간접 관계 수집
 *   3) 노드 간 장르 유사도 기반 크로스 엣지 생성 (허브 간)
 *   4) d3-force 시뮬레이션으로 전체 노드 x/y 좌표 사전 계산
 *   5) public/data/universe-graph-v5.json 저장
 *
 * 안전 규칙:
 *   - MusicBrainz: scripts/.cache/mb/ 에 응답 영구 캐시 (재호출 방지)
 *   - 증분 빌드: 캐시 있으면 API 호출 없음 (Rate Limit 방어)
 *   - 2-hop 수집은 위성 6명 미만인 허브에 한정 (과잉 호출 방지)
 *   - tier 2 노드는 허브당 최대 10명까지만 (그래프 비대화 방지)
 *
 * 실행:
 *   npx tsx scripts/build-universe-v5.ts
 *   또는 npm run build-universe-v5
 */

import * as fs from "fs";
import * as path from "path";
import * as d3Force from "d3-force";

require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

import { HUB_ARTISTS } from "../src/data/hub-artists";
import { searchArtistMBID, getArtistRelations } from "../src/lib/musicbrainz";
import type { CosmosData } from "../src/lib/types";

// ── 경로 상수 ──────────────────────────────────────────────────────
const HUB_DIR      = path.resolve(__dirname, "../public/data/hub");
const OUTPUT_PATH  = path.resolve(__dirname, "../public/data/universe-graph-v5.json");
const MB_CACHE_DIR = path.resolve(__dirname, ".cache/mb");

// ── 타입 정의 ──────────────────────────────────────────────────────

export interface V5Node {
  id: string;           // Spotify ID
  name: string;
  nameKo: string;
  image: string | null;
  genres: string[];
  popularity: number;
  previewUrl: string | null;
  previewTrackName: string | null;
  spotifyUrl: string | null;
  tier: 0 | 1 | 2;     // 0=허브, 1=직접위성, 2=간접위성
  accent?: string;      // 허브 전용 강조색
  x?: number;           // Force-layout 결과 좌표
  y?: number;
}

export type V5EdgeRelation =
  | "SAME_GROUP"
  | "FEATURED"
  | "PRODUCER"
  | "WRITER"
  | "INDIRECT"
  | "GENRE_OVERLAP";

export interface V5Edge {
  source: string;
  target: string;
  weight: number;   // 0.1 ~ 1.0
  relation: V5EdgeRelation;
  label: string;    // 예: "피처링: APT.", "프로듀서 (7곡)"
}

export interface UniverseGraphV5 {
  version: 5;
  builtAt: string;          // ISO timestamp
  nodeCount: number;
  edgeCount: number;
  nodes: Record<string, V5Node>;
  edges: V5Edge[];
}

// ── 유틸 ──────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function log(msg: string) {
  console.log(`[V5] ${msg}`);
}

// MB 캐시 읽기/쓰기
function mbCacheGet<T>(key: string): T | null {
  const p = path.join(MB_CACHE_DIR, `${key}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function mbCacheSet(key: string, data: unknown) {
  fs.mkdirSync(MB_CACHE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(MB_CACHE_DIR, `${key}.json`),
    JSON.stringify(data),
    "utf-8"
  );
}

// SatelliteNode relationType → V5EdgeRelation 변환
function toV5Relation(relationType: string): V5EdgeRelation {
  switch (relationType) {
    case "SAME_GROUP": return "SAME_GROUP";
    case "FEATURED":   return "FEATURED";
    case "PRODUCER":   return "PRODUCER";
    case "WRITER":     return "WRITER";
    case "INDIRECT":   return "INDIRECT";
    default:           return "FEATURED";
  }
}

// 장르 코사인 유사도 (0~1)
function genreSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const all = new Set([...a, ...b]);
  let dot = 0, magA = 0, magB = 0;
  for (const g of all) {
    const va = a.includes(g) ? 1 : 0;
    const vb = b.includes(g) ? 1 : 0;
    dot += va * vb; magA += va * va; magB += vb * vb;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// MusicBrainz MBID 검색 (캐시 우선)
async function cachedSearchMBID(name: string): Promise<string | null> {
  const key = "mbid_" + name.replace(/[^a-zA-Z0-9가-힣]/g, "_");
  const cached = mbCacheGet<string | null>(key);
  if (cached !== null) return cached;   // null도 캐시 (검색 실패도 저장)

  const mbid = await searchArtistMBID(name);
  mbCacheSet(key, mbid);
  return mbid;
}

// 아티스트 관계 조회 (캐시 우선)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cachedGetRelations(mbid: string): Promise<any[]> {
  const key = "rels_" + mbid;
  const cached = mbCacheGet<unknown[]>(key);
  if (cached !== null) return cached;

  const rels = await getArtistRelations(mbid);
  mbCacheSet(key, rels);
  return rels;
}

// ── 메인 ──────────────────────────────────────────────────────────

async function main() {
  log("🌌 Universe V5 그래프 빌더 시작");
  log(`   허브 아티스트: ${HUB_ARTISTS.length}명`);
  log(`   MB 캐시 경로: ${MB_CACHE_DIR}`);
  log(`   출력 경로: ${OUTPUT_PATH}\n`);

  const nodes: Record<string, V5Node> = {};
  const edges: V5Edge[] = [];
  const edgeSet = new Set<string>();

  function addEdge(e: V5Edge) {
    const key = [e.source, e.target].sort().join("||") + "||" + e.relation;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push(e);
  }

  // ────────────────────────────────────────────────────────────────
  // PASS 1: 기존 허브 JSON에서 노드 + 엣지 (tier 0, 1) 추출
  // ────────────────────────────────────────────────────────────────
  log("📦 PASS 1: 기존 hub JSON에서 1-hop 노드/엣지 수집...");
  const hubAccentMap = new Map(HUB_ARTISTS.map((h) => [h.spotifyId, h.accent]));
  const hubNameKoMap = new Map(HUB_ARTISTS.map((h) => [h.spotifyId, h.nameKo]));
  const hubsNeedingMore: string[] = []; // 위성 6명 미만 허브

  for (const hub of HUB_ARTISTS) {
    const filePath = path.join(HUB_DIR, `${hub.spotifyId}.json`);
    if (!fs.existsSync(filePath)) {
      log(`  ⚠️ ${hub.name}: JSON 없음 (prebake 필요)`);
      continue;
    }

    const data: CosmosData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    // 허브 노드 (tier 0)
    nodes[hub.spotifyId] = {
      id: hub.spotifyId,
      name: data.core.name,
      nameKo: hub.nameKo,
      image: data.core.imageUrl,
      genres: data.core.genres,
      popularity: data.core.popularity,
      previewUrl: data.core.previewUrl,
      previewTrackName: data.core.previewTrackName,
      spotifyUrl: data.core.spotifyUrl,
      tier: 0,
      accent: hub.accent,
    };

    // 위성 노드 (tier 1) + 엣지
    for (const sat of data.satellites) {
      // mb_ 접두사 가짜 ID는 제외
      if (sat.spotifyId.startsWith("mb_")) continue;

      if (!nodes[sat.spotifyId]) {
        nodes[sat.spotifyId] = {
          id: sat.spotifyId,
          name: sat.name,
          nameKo: sat.name,
          image: sat.imageUrl,
          genres: sat.genres,
          popularity: sat.popularity,
          previewUrl: sat.previewUrl,
          previewTrackName: sat.previewTrackName,
          spotifyUrl: sat.spotifyUrl,
          tier: 1,
        };
      }

      addEdge({
        source: hub.spotifyId,
        target: sat.spotifyId,
        weight: 0.70,
        relation: toV5Relation(sat.relationType),
        label: sat.relationKeyword ?? sat.relationType,
      });
    }

    log(`  ✅ ${hub.name}: 위성 ${data.satellites.length}명`);

    if (data.satellites.length < 6) {
      hubsNeedingMore.push(hub.spotifyId);
    }
  }

  log(`\n📊 PASS 1 완료: 노드 ${Object.keys(nodes).length}개, 엣지 ${edges.length}개`);
  log(`   2-hop 보충 대상: ${hubsNeedingMore.length}개 허브 (위성 6명 미만)\n`);

  // ────────────────────────────────────────────────────────────────
  // PASS 2: 2-hop 간접 관계 (위성 부족 허브에 한정)
  // ────────────────────────────────────────────────────────────────
  log("🔭 PASS 2: 2-hop 간접 관계 수집 (MusicBrainz + 로컬 캐시)...");

  for (const hubId of hubsNeedingMore) {
    const hubNode = nodes[hubId];
    if (!hubNode) continue;

    const directSatIds = edges
      .filter((e) => e.source === hubId || e.target === hubId)
      .map((e) => (e.source === hubId ? e.target : e.source));

    log(`  🔍 ${hubNode.nameKo} (현재 위성 ${directSatIds.length}명) — 2-hop 탐색 시작`);

    let indirectAdded = 0;

    for (const satId of directSatIds) {
      if (indirectAdded >= 10) break; // 허브당 최대 10명
      const satNode = nodes[satId];
      if (!satNode) continue;

      // 위성의 MBID 찾기 (캐시 우선)
      const satMbid = await cachedSearchMBID(satNode.name);
      if (!satMbid) continue;
      await sleep(200); // 캐시 미스 시 rate limit 방어

      // 위성의 관계 목록 (캐시 우선)
      const rels = await cachedGetRelations(satMbid);
      await sleep(200);

      for (const rel of rels) {
        if (indirectAdded >= 10) break;
        if (!rel.name || rel.name === hubNode.name) continue;

        // 이미 노드에 있으면 크로스 엣지만 추가
        const existingNode = Object.values(nodes).find((n) => n.name === rel.name);
        if (existingNode) {
          // 허브와 간접 연결 (satNode를 통해)
          addEdge({
            source: hubId,
            target: existingNode.id,
            weight: 0.30,
            relation: "INDIRECT",
            label: `${satNode.nameKo}을(를) 통한 연결`,
          });
          indirectAdded++;
          continue;
        }

        // 새로운 tier 2 노드 추가 (Spotify ID 없이 이름만 있는 경우 mb_ 접두사)
        const tier2Id = `mb_v5_${satMbid}_${rel.mbid || rel.name.replace(/\s/g, "_")}`;
        if (!nodes[tier2Id]) {
          nodes[tier2Id] = {
            id: tier2Id,
            name: rel.name,
            nameKo: rel.name,
            image: null, // 이미지 없음 (이니셜 렌더링)
            genres: [],
            popularity: 0,
            previewUrl: null,
            previewTrackName: null,
            spotifyUrl: null,
            tier: 2,
          };
        }

        addEdge({
          source: hubId,
          target: tier2Id,
          weight: 0.20,
          relation: "INDIRECT",
          label: `${satNode.nameKo}을(를) 통한 연결`,
        });
        indirectAdded++;
      }
    }

    log(`    → 간접 위성 ${indirectAdded}명 추가 완료`);
  }

  log(`\n📊 PASS 2 완료: 노드 ${Object.keys(nodes).length}개, 엣지 ${edges.length}개\n`);

  // ────────────────────────────────────────────────────────────────
  // PASS 3: 허브 간 장르 유사도 기반 크로스 엣지
  // ────────────────────────────────────────────────────────────────
  log("🎵 PASS 3: 허브 간 장르 유사도 크로스 엣지 생성...");
  const hubIds = HUB_ARTISTS.map((h) => h.spotifyId).filter((id) => nodes[id]);

  let genreEdgeCount = 0;
  for (let i = 0; i < hubIds.length; i++) {
    for (let j = i + 1; j < hubIds.length; j++) {
      const a = nodes[hubIds[i]];
      const b = nodes[hubIds[j]];
      const sim = genreSimilarity(a.genres, b.genres);
      if (sim > 0.25) {
        addEdge({
          source: hubIds[i],
          target: hubIds[j],
          weight: sim * 0.4,
          relation: "GENRE_OVERLAP",
          label: `장르 유사도 ${Math.round(sim * 100)}%`,
        });
        genreEdgeCount++;
      }
    }
  }
  log(`   장르 크로스 엣지 ${genreEdgeCount}개 생성`);

  // ────────────────────────────────────────────────────────────────
  // PASS 4: d3-force 시뮬레이션으로 x/y 좌표 사전 계산
  // ────────────────────────────────────────────────────────────────
  log("\n⚛️  PASS 4: d3-force 시뮬레이션으로 좌표 계산 중...");

  const nodeArray = Object.values(nodes);
  const linkArray = edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight }));

  // 이미 좌표가 있는 노드는 고정 (기존 graph.json 활용)
  const existingGraphPath = path.resolve(__dirname, "../public/data/graph.json");
  if (fs.existsSync(existingGraphPath)) {
    const existing = JSON.parse(fs.readFileSync(existingGraphPath, "utf-8"));
    for (const node of nodeArray) {
      if (existing.nodes?.[node.id]?.x !== undefined) {
        (node as V5Node & { fx?: number; fy?: number }).fx = existing.nodes[node.id].x;
        (node as V5Node & { fx?: number; fy?: number }).fy = existing.nodes[node.id].y;
      }
    }
    log("   기존 graph.json 좌표 재사용 (핀 고정)");
  }

  const simulation = d3Force.forceSimulation(nodeArray as d3Force.SimulationNodeDatum[])
    .force("link", d3Force.forceLink(linkArray)
      .id((d: d3Force.SimulationNodeDatum) => (d as V5Node).id)
      .distance((link: { weight?: number }) => 200 - (link.weight ?? 0.5) * 120) // 강한 관계일수록 가깝게
      .strength(0.8)
    )
    .force("charge", d3Force.forceManyBody()
      .strength((d: d3Force.SimulationNodeDatum) => {
        const node = d as V5Node;
        return node.tier === 0 ? -800 : node.tier === 1 ? -300 : -100;
      })
    )
    .force("center", d3Force.forceCenter(0, 0))
    .force("collision", d3Force.forceCollide()
      .radius((d: d3Force.SimulationNodeDatum) => {
        const node = d as V5Node;
        return node.tier === 0 ? 60 : node.tier === 1 ? 30 : 15;
      })
    )
    .stop();

  // tick 300회 → 충분히 수렴
  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }

  // 시뮬 결과를 노드에 반영, 핀 해제
  for (const node of nodeArray) {
    const simNode = node as V5Node & { fx?: number; fy?: number; x?: number; y?: number };
    nodes[node.id].x = Math.round(simNode.x ?? 0);
    nodes[node.id].y = Math.round(simNode.y ?? 0);
    delete simNode.fx;
    delete simNode.fy;
  }

  log("   좌표 계산 완료 ✅");

  // ────────────────────────────────────────────────────────────────
  // 최종 저장
  // ────────────────────────────────────────────────────────────────
  const graph: UniverseGraphV5 = {
    version: 5,
    builtAt: new Date().toISOString(),
    nodeCount: Object.keys(nodes).length,
    edgeCount: edges.length,
    nodes,
    edges,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  const json = JSON.stringify(graph);
  fs.writeFileSync(OUTPUT_PATH, json, "utf-8");

  const kb = Math.round(Buffer.byteLength(json, "utf-8") / 1024);

  log("\n════════════════════════════════════════");
  log("  🌌 Universe V5 그래프 빌드 완료!");
  log("════════════════════════════════════════");
  log(`  노드 수       : ${graph.nodeCount}개`);
  log(`  엣지 수       : ${graph.edgeCount}개`);
  log(`  파일 크기     : ${kb} KB`);
  log(`  저장 경로     : ${OUTPUT_PATH}`);
  log("════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("[V5 Builder] 치명적 에러:", err);
  process.exit(1);
});
