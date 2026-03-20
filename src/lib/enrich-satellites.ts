/**
 * 위성 아티스트 이미지 보완 유틸리티
 *
 * Prebaked JSON의 위성 데이터에 imageUrl이 null인 경우,
 * graph.json이나 다른 허브 JSON에서 이미지를 찾아 보완합니다.
 */

import fs from "fs";
import path from "path";
import type { SatelliteNode } from "./types";
import type { UniverseGraph } from "./graph";

let _graphCache: UniverseGraph | null = null;

function loadGraph(): UniverseGraph | null {
  if (_graphCache) return _graphCache;
  try {
    const graphPath = path.join(process.cwd(), "public", "data", "graph.json");
    if (fs.existsSync(graphPath)) {
      _graphCache = JSON.parse(fs.readFileSync(graphPath, "utf-8"));
      return _graphCache;
    }
  } catch {}
  return null;
}

/**
 * 위성 아티스트들의 누락된 이미지를 graph.json & 허브 JSON에서 보완
 */
export function enrichSatelliteImages(satellites: SatelliteNode[]): SatelliteNode[] {
  const graph = loadGraph();
  const hubDir = path.join(process.cwd(), "public", "data", "hub");

  return satellites.map((sat) => {
    // 이미 이미지가 있으면 그대로 반환
    if (sat.imageUrl) return sat;

    // 1. graph.json에서 이미지 찾기
    if (graph?.nodes) {
      // Spotify ID로 직접 찾기
      const graphNode = graph.nodes[sat.spotifyId];
      if (graphNode?.image) {
        return { ...sat, imageUrl: graphNode.image };
      }

      // manual_ ID로도 찾기 (이름 기반 해시)
      const manualId = "manual_" + Buffer.from(sat.name).toString("base64url").slice(0, 22);
      const manualNode = graph.nodes[manualId];
      if (manualNode?.image) {
        return { ...sat, imageUrl: manualNode.image };
      }

      // 이름으로 검색
      for (const [, node] of Object.entries(graph.nodes)) {
        if ((node.name === sat.name || node.nameKo === sat.name) && node.image) {
          return { ...sat, imageUrl: node.image };
        }
      }
    }

    // 2. 위성의 자체 허브 JSON에서 코어 이미지 가져오기
    try {
      const hubPath = path.join(hubDir, `${sat.spotifyId}.json`);
      if (fs.existsSync(hubPath)) {
        const raw = fs.readFileSync(hubPath, "utf-8");
        const data = JSON.parse(raw);
        if (data.core?.imageUrl) {
          return { ...sat, imageUrl: data.core.imageUrl };
        }
      }
    } catch {}

    return sat;
  });
}
