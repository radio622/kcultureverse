/**
 * K-Culture Universe — Torus-aware Force-Directed Layout 엔진
 *
 * 관계 그래프를 읽어 Torus(도넛) 공간 위에
 * 관련 아티스트는 가깝게, 무관한 아티스트는 멀리 배치합니다.
 *
 * 핵심:
 *  - shortestDelta()로 Torus 최단거리 계산 (가장자리 공백 방지)
 *  - node.pinned으로 기존 좌표 보존 (Incremental Layout)
 *  - Barnes-Hut 없이 단순 N² (1,000개 이하에서는 충분)
 *
 * 실행: npx tsx scripts/compute-layout.ts
 */

import * as fs from "fs";
import * as path from "path";
import type { UniverseGraph } from "../src/lib/graph";

const GRAPH_PATH = path.resolve(__dirname, "../public/data/graph.json");

// ── Torus 상수 (Cosmos.tsx와 동일) ──────────────────────────────
const UNIVERSE_W = 4000;
const UNIVERSE_H = 3000;

// ── 물리 파라미터 ────────────────────────────────────────────────
const MAX_ITERATIONS = 300;
const REPULSION = 500000;       // 척력 강도
const ATTRACTION = 0.003;       // 인력 강도
const DAMPING = 0.85;           // 감쇠 계수 (0.8~0.95)
const MIN_DIST = 30;            // 최소 거리 (겹침 방지)
const INITIAL_TEMP = 1.0;       // 초기 온도 (시뮬레이티드 어닐링)

// ── Torus 수학 ───────────────────────────────────────────────────
function wrap(val: number, half: number): number {
  const size = half * 2;
  return ((val + half) % size + size) % size - half;
}

function shortestDelta(from: number, to: number, half: number): number {
  const size = half * 2;
  let d = ((to - from) % size + size) % size;
  if (d > half) d -= size;
  return d;
}

// ── 시드 기반 결정적 랜덤 ────────────────────────────────────────
function seededRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}

// ── 메인 ─────────────────────────────────────────────────────────
async function main() {
  console.log("🌌 Torus Force-Directed Layout 계산 시작\n");

  // 그래프 로드
  const raw = fs.readFileSync(GRAPH_PATH, "utf-8");
  const graph: UniverseGraph = JSON.parse(raw);

  const ids = Object.keys(graph.nodes);
  const n = ids.length;
  console.log(`   노드: ${n}개, 엣지: ${graph.edges.length}개\n`);

  // ── 노드별 위치 초기화 ─────────────────────────────────────
  const halfW = UNIVERSE_W / 2;
  const halfH = UNIVERSE_H / 2;
  const pos: Record<string, { x: number; y: number; vx: number; vy: number; pinned: boolean }> = {};

  for (const id of ids) {
    const node = graph.nodes[id];
    if (node.x !== undefined && node.y !== undefined && node.pinned) {
      // Incremental: 기존 고정 노드
      pos[id] = { x: node.x, y: node.y, vx: 0, vy: 0, pinned: true };
    } else {
      // 새 노드: 시드 기반 랜덤 초기 위치 (결정적)
      const r1 = seededRandom(id);
      const r2 = seededRandom(id + "_y");
      pos[id] = {
        x: (r1 - 0.5) * UNIVERSE_W * 0.8,
        y: (r2 - 0.5) * UNIVERSE_H * 0.8,
        vx: 0,
        vy: 0,
        pinned: false,
      };
    }
  }

  // ── 인접 리스트 구축 ────────────────────────────────────────
  const adj: Record<string, Array<{ target: string; weight: number }>> = {};
  for (const id of ids) adj[id] = [];

  for (const [src, tgt, weight] of graph.edges) {
    if (pos[src] && pos[tgt]) {
      adj[src].push({ target: tgt, weight });
      adj[tgt].push({ target: src, weight });
    }
  }

  // ── 시뮬레이션 ─────────────────────────────────────────────
  console.log(`   ${MAX_ITERATIONS}회 반복 시뮬레이션 시작...`);
  const startTime = Date.now();

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const temp = INITIAL_TEMP * (1 - iter / MAX_ITERATIONS); // 시뮬레이티드 어닐링

    for (const id of ids) {
      const p = pos[id];
      if (p.pinned) continue;

      let fx = 0;
      let fy = 0;

      // ── 척력: 모든 노드가 서로를 밀어냄 ───────────────────
      for (const otherId of ids) {
        if (otherId === id) continue;
        const o = pos[otherId];
        const dx = shortestDelta(p.x, o.x, halfW);
        const dy = shortestDelta(p.y, o.y, halfH);
        const dist = Math.max(MIN_DIST, Math.hypot(dx, dy));
        const force = REPULSION / (dist * dist);
        fx -= (dx / dist) * force;
        fy -= (dy / dist) * force;
      }

      // ── 인력: 연결 노드끼리 끌어당김 ──────────────────────
      for (const edge of adj[id]) {
        const o = pos[edge.target];
        const dx = shortestDelta(p.x, o.x, halfW);
        const dy = shortestDelta(p.y, o.y, halfH);
        const dist = Math.hypot(dx, dy);
        const force = edge.weight * ATTRACTION * dist;
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }

      // 속도 업데이트 (감쇠 + 온도)
      p.vx = (p.vx + fx) * DAMPING * temp;
      p.vy = (p.vy + fy) * DAMPING * temp;

      // 위치 업데이트 (Torus 래핑)
      p.x = wrap(p.x + p.vx, halfW);
      p.y = wrap(p.y + p.vy, halfH);
    }

    // 진행 표시
    if ((iter + 1) % 50 === 0 || iter === MAX_ITERATIONS - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   [${iter + 1}/${MAX_ITERATIONS}] ${elapsed}초 경과`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ 시뮬레이션 완료 (${totalTime}초)\n`);

  // ── 결과를 graph.json에 반영 ──────────────────────────────
  for (const id of ids) {
    graph.nodes[id].x = Math.round(pos[id].x * 10) / 10;
    graph.nodes[id].y = Math.round(pos[id].y * 10) / 10;
  }

  fs.writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2), "utf-8");
  console.log(`💾 좌표 포함 graph.json 저장 완료`);
  console.log(`   크기: ${(fs.statSync(GRAPH_PATH).size / 1024).toFixed(1)}KB`);

  // ── 통계 출력 ──────────────────────────────────────────────
  console.log("\n📊 좌표 분포 통계:");
  const xs = ids.map((id) => pos[id].x);
  const ys = ids.map((id) => pos[id].y);
  console.log(`   X: [${Math.min(...xs).toFixed(0)}, ${Math.max(...xs).toFixed(0)}]`);
  console.log(`   Y: [${Math.min(...ys).toFixed(0)}, ${Math.max(...ys).toFixed(0)}]`);
}

main().catch((err) => {
  console.error("치명적 에러:", err);
  process.exit(1);
});
