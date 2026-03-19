/**
 * K-Culture Universe — 관계 그래프 데이터 구조 및 유틸리티
 *
 * graph.json 스키마:
 *   nodes: { [spotifyId]: NodeData }
 *   edges: [sourceId, targetId, weight, reason][]
 */

export interface GraphNode {
  name: string;
  nameKo: string;
  image: string | null;
  genres: string[];
  popularity: number;
  previewUrl: string | null;
  spotifyUrl: string | null;
  // Force-directed layout 결과 좌표
  x?: number;
  y?: number;
  // Incremental layout: true이면 좌표 재계산에서 제외
  pinned?: boolean;
}

// [sourceId, targetId, weight, reason]
export type GraphEdge = [string, string, number, string];

export interface UniverseGraph {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
}

/**
 * 두 아티스트의 장르 코사인 유사도 계산 (0~1)
 */
export function genreSimilarity(genresA: string[], genresB: string[]): number {
  if (!genresA.length || !genresB.length) return 0;

  const allGenres = new Set([...genresA, ...genresB]);
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (const genre of allGenres) {
    const a = genresA.includes(genre) ? 1 : 0;
    const b = genresB.includes(genre) ? 1 : 0;
    dotProduct += a * b;
    magA += a * a;
    magB += b * b;
  }

  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * 기존 hub JSON 파일들로부터 초기 graph.json을 생성
 */
export function buildInitialGraph(
  hubData: Array<{
    spotifyId: string;
    name: string;
    nameKo: string;
    accent: string;
    core: {
      imageUrl: string | null;
      genres: string[];
      popularity: number;
      previewUrl: string | null;
      spotifyUrl: string | null;
    };
    satellites: Array<{
      spotifyId: string;
      name: string;
      imageUrl: string | null;
      genres: string[];
      popularity: number;
      previewUrl: string | null;
      spotifyUrl: string | null;
    }>;
  }>
): UniverseGraph {
  const nodes: Record<string, GraphNode> = {};
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>(); // 중복 방지

  for (const hub of hubData) {
    // 허브 노드 추가
    if (!nodes[hub.spotifyId]) {
      nodes[hub.spotifyId] = {
        name: hub.name,
        nameKo: hub.nameKo,
        image: hub.core.imageUrl,
        genres: hub.core.genres,
        popularity: hub.core.popularity,
        previewUrl: hub.core.previewUrl,
        spotifyUrl: hub.core.spotifyUrl,
      };
    }

    // 위성 노드 추가 + 허브↔위성 엣지
    for (const sat of hub.satellites) {
      if (!nodes[sat.spotifyId]) {
        nodes[sat.spotifyId] = {
          name: sat.name,
          nameKo: sat.name,
          image: sat.imageUrl,
          genres: sat.genres,
          popularity: sat.popularity,
          previewUrl: sat.previewUrl,
          spotifyUrl: sat.spotifyUrl,
        };
      }

      // 엣지 추가 (중복 방지)
      const edgeKey = [hub.spotifyId, sat.spotifyId].sort().join("-");
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        edges.push([hub.spotifyId, sat.spotifyId, 0.7, "hub_satellite"]);
      }
    }
  }

  // 장르 유사도 기반 엣지 추가 (허브 간)
  const hubIds = hubData.map((h) => h.spotifyId);
  for (let i = 0; i < hubIds.length; i++) {
    for (let j = i + 1; j < hubIds.length; j++) {
      const a = nodes[hubIds[i]];
      const b = nodes[hubIds[j]];
      const sim = genreSimilarity(a.genres, b.genres);
      if (sim > 0.2) {
        const edgeKey = [hubIds[i], hubIds[j]].sort().join("-");
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push([hubIds[i], hubIds[j], sim * 0.5, "genre_overlap"]);
        }
      }
    }
  }

  return { nodes, edges };
}
