/**
 * 심우주(Deep Space) 노드 생성 유틸리티 v2
 *
 * graph.json에 Force-Directed 좌표가 있으면 그것을 사용하고,
 * 없으면 기존의 황금각 나선 배치로 fallback합니다.
 */

import fs from "fs";
import path from "path";
import { HUB_ARTISTS } from "@/data/hub-artists";
import type { DeepSpaceNode } from "./types";
import type { UniverseGraph } from "./graph";

/** 시드 기반 결정적 난수 (0~1) */
function seededRandom(seed: string, salt: number = 0): number {
  let h = salt;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * 심우주 노드 배열 생성 (서버 사이드 전용)
 * @param currentCoreId  현재 화면의 코어 아티스트 Spotify ID (제외 대상)
 */
export function buildDeepSpaceNodes(currentCoreId: string): DeepSpaceNode[] {
  const hubDir = path.join(process.cwd(), "public", "data", "hub");
  const graphPath = path.join(process.cwd(), "public", "data", "graph.json");
  const nodes: DeepSpaceNode[] = [];

  // ── graph.json에서 Force-Directed 좌표 로드 시도 ──────────
  let graph: UniverseGraph | null = null;
  try {
    if (fs.existsSync(graphPath)) {
      graph = JSON.parse(fs.readFileSync(graphPath, "utf-8")) as UniverseGraph;
    }
  } catch { /* fallback to golden angle */ }

  // 허브 아티스트 중 현재 코어를 제외한 나머지
  const others = HUB_ARTISTS.filter((h) => h.spotifyId !== currentCoreId);

  others.forEach((hub, i) => {
    let x: number;
    let y: number;

    // ── 좌표 결정: graph.json 우선, 없으면 골든앵글 fallback ──
    const graphNode = graph?.nodes[hub.spotifyId];
    if (graphNode && graphNode.x !== undefined && graphNode.y !== undefined) {
      // Force-Directed 계산 좌표 사용
      x = graphNode.x;
      y = graphNode.y;
    } else {
      // Fallback: 골든앵글 나선 배치
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const angle = i * goldenAngle;
      const baseRadius = 600 + (i / others.length) * 1000;
      const jitter = seededRandom(hub.spotifyId, 1) * 200 - 100;
      const radius = baseRadius + jitter;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius * 0.55;
    }

    // pre-baked JSON 존재 여부 확인 및 이미지 추출
    const jsonPath = path.join(hubDir, `${hub.spotifyId}.json`);
    let canDive = false;
    let imageUrl: string | null = null;
    try {
      if (fs.existsSync(jsonPath)) {
        canDive = true;
        const raw = fs.readFileSync(jsonPath, "utf-8");
        const json = JSON.parse(raw);
        imageUrl = json.core?.imageUrl || null;
      }
    } catch { /* ignore */ }

    // 노드 크기: 인기도 기반 (graph.json에 있으면 popularity 활용)
    const popularity = graphNode?.popularity ?? 50;
    const size = 20 + (popularity / 100) * 15; // 20px ~ 35px

    nodes.push({
      spotifyId: hub.spotifyId,
      name: hub.nameKo,
      accent: hub.accent,
      x: Math.round(x),
      y: Math.round(y),
      size: Math.round(size),
      canDive,
      imageUrl,
    });
  });

  return nodes;
}
