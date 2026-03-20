/**
 * K-Culture Universe V5.4 — 평등/유기적 네트워크 복원을 위한 진정한 BFS 크롤러
 *
 * 기존의 중앙 집중식(Hub-centric) 방사형 크롤링 오류를 폐기하고,
 * Queue를 이용한 Breadth-First Search (너비 우선 탐색)를 수행하여
 * 1촌 -> 2촌 -> 3촌 징검다리(Chain) 간선을 정직하게 생성합니다.
 *
 * - 기준 식별자: MusicBrainz ID (MBID) - Spotify ID 종속성 탈피
 * - 데이터 평탄화: Tier(계급) 개념 없음. 모두가 평등한 Node.
 * - MAX_NODES 한계에 도달할 때까지 우주를 무한 확장.
 */

import fs from "fs";
import path from "path";
import { HUB_ARTISTS } from "../src/data/hub-artists";
import {
  searchArtistMBID,
  getArtistRelations,
  getComprehensiveCredits,
} from "../src/lib/musicbrainz";

const CACHE_DIR = path.join(process.cwd(), "scripts", ".cache", "v5.4");
const GRAPH_OUT = path.join(CACHE_DIR, "organic-graph.json");

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// ── V5.4 통합 그래프 타입 ──
interface OrganicNode {
  mbid: string;
  name: string;
  depth: number;
  spotifyId: string | null;
  image: string | null;
  genres: string[];
  popularity: number;
}

interface OrganicEdge {
  source: string; // mbid
  target: string; // mbid
  relation: string;
  weight: number;
}

interface QueueItem {
  mbid: string;
  name: string;
  depth: number;
}

const MAX_NODES = 2000; // 우주의 한계 크기 설정

// 캐시 기반 딜레이
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runBfsCrawler() {
  console.log("🌌 V5.4 Organic BFS Crawler Started...\n");

  // 상태 복원 (Resumable)
  let nodes = new Map<string, OrganicNode>();
  let edges = new Map<string, OrganicEdge>();
  let queue: QueueItem[] = [];
  let visited = new Set<string>();

  if (fs.existsSync(GRAPH_OUT)) {
    console.log("💾 기존 그래프 캐시 로드 중...");
    const data = JSON.parse(fs.readFileSync(GRAPH_OUT, "utf-8"));
    for (const n of data.nodes) nodes.set(n.mbid, n);
    for (const e of data.edges) {
      edges.set([e.source, e.target].sort().join("::"), e);
    }
    visited = new Set(data.visited);
    queue = data.queue;
    console.log(`  복원 완료: 노드 ${nodes.size}개, 엣지 ${edges.size}개, 큐 ${queue.length}개`);
  }

  // 초기 큐 설정 (Seed)
  if (queue.length === 0 && visited.size === 0) {
    console.log("🌱 초기 Seed(Hub) 아티스트 설정 중...");
    for (const hub of HUB_ARTISTS) {
      const mbid = await searchArtistMBID(hub.name);
      if (mbid) {
        queue.push({ mbid, name: hub.name, depth: 0 });
        nodes.set(mbid, {
          mbid, name: hub.name, depth: 0,
          spotifyId: hub.spotifyId, image: null, genres: [], popularity: 0
        });
      }
      await sleep(1000);
    }
  }

  // BFS 루프
  while (queue.length > 0 && nodes.size < MAX_NODES) {
    const current = queue.shift()!;
    if (visited.has(current.mbid)) continue;
    visited.add(current.mbid);

    console.log(`\n🔍 [탐색] ${current.name} (Depth: ${current.depth}) | Queue: ${queue.length} | Nodes: ${nodes.size}`);

    const newCredits = new Map<string, { name: string; role: string; count: number }>();

    // 1. 직접 관계 (소속 그룹 등)
    const directRels = await getArtistRelations(current.mbid);
    for (const rel of directRels) {
      newCredits.set(rel.mbid, { name: rel.name, role: rel.role, count: rel.count });
    }
    if (directRels.length === 0) await sleep(1100);

    // 2. 디스코그래피 종합 크레딧 (작사/작곡/프로듀서/피처링)
    const compCredits = await getComprehensiveCredits(current.name, current.mbid);
    for (const rel of compCredits) {
      const prev = newCredits.get(rel.mbid);
      if (prev) {
        prev.count += rel.count;
      } else {
        newCredits.set(rel.mbid, { name: rel.name, role: rel.role, count: rel.count });
      }
    }

    // 발견된 노드 및 엣지 처리
    for (const [targetMbid, info] of newCredits.entries()) {
      // 엣지 생성 (양방향 안전 키포맷)
      const edgeKey = [current.mbid, targetMbid].sort().join("::");
      if (!edges.has(edgeKey)) {
        edges.set(edgeKey, {
          source: current.mbid,
          target: targetMbid,
          relation: info.role.toUpperCase(), // PRODUCER, FEATURED 등
          weight: Math.min(info.count * 0.2, 1.0),
        });
      }

      // 노드가 없으면 생성 및 큐 추가 (Depth 증가시켜서 징검다리 전진)
      if (!nodes.has(targetMbid)) {
        nodes.set(targetMbid, {
          mbid: targetMbid, name: info.name, depth: current.depth + 1,
          spotifyId: null, image: null, genres: [], popularity: 0
        });
        queue.push({ mbid: targetMbid, name: info.name, depth: current.depth + 1 });
      }
    }

    // 중간 저장 (안전성 보장)
    if (visited.size % 5 === 0) {
      fs.writeFileSync(GRAPH_OUT, JSON.stringify({
        nodes: Array.from(nodes.values()),
        edges: Array.from(edges.values()),
        visited: Array.from(visited),
        queue: queue
      }, null, 2));
      console.log(`  💾 중간 저장 완료 (${nodes.size} nodes)`);
    }
  }

  // 최종 저장
  fs.writeFileSync(GRAPH_OUT, JSON.stringify({
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
    visited: Array.from(visited),
    queue: queue
  }, null, 2));

  console.log(`\n🎉 탐색 종료! 총 노드: ${nodes.size}, 총 엣지: ${edges.size}`);
}

runBfsCrawler().catch(console.error);
