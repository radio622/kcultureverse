/**
 * dijkstra.ts — A→B 최단 경로 탐색 (V7.7 Phase 3-1)
 *
 * 동일한 로직이 GraphCosmos.tsx 내에 인라인으로 존재했으나,
 * universe/page.tsx에서도 여정 재생용으로 사용하기 위해 분리.
 *
 * cost = 1 - weight (weight가 높을수록 더 가까운 관계)
 * → 강한 관계망을 따라 최단 경로 탐색
 */

import type { UniverseGraphV5 } from "@/lib/graph-v5";

type Nodes = UniverseGraphV5["nodes"];
type Edges = UniverseGraphV5["edges"];

export function dijkstra(
  nodes: Nodes,
  edges: Edges,
  fromId: string,
  toId: string
): string[] {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const id of Object.keys(nodes)) {
    dist[id] = Infinity;
    prev[id] = null;
  }
  dist[fromId] = 0;

  // 인접 리스트 구성 (cost = 1 - weight → 강한 관계일수록 cost 낮음)
  const adj: Record<string, { id: string; weight: number }[]> = {};
  for (const e of edges) {
    const cost = 1 - e.weight;
    adj[e.source] = adj[e.source] || [];
    adj[e.target] = adj[e.target] || [];
    adj[e.source].push({ id: e.target, weight: cost });
    adj[e.target].push({ id: e.source, weight: cost });
  }

  const queue = new Set(Object.keys(nodes));
  while (queue.size > 0) {
    let u: string | null = null;
    for (const id of queue) {
      if (u === null || dist[id] < dist[u]) u = id;
    }
    if (!u || dist[u] === Infinity) break;
    if (u === toId) break;
    queue.delete(u);
    visited.add(u);
    for (const nb of adj[u] || []) {
      if (visited.has(nb.id)) continue;
      const alt = dist[u] + nb.weight;
      if (alt < dist[nb.id]) {
        dist[nb.id] = alt;
        prev[nb.id] = u;
      }
    }
  }

  // 경로 역추적
  const path: string[] = [];
  let cur: string | null = toId;
  while (cur) {
    path.unshift(cur);
    cur = prev[cur] ?? null;
    if (path.includes(cur!)) break;
  }
  return path[0] === fromId ? path : [];
}
