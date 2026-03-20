/**
 * GET /api/universe/artist?id={spotifyId}
 *
 * V5 Universe SPA에서 노드 클릭 시 바텀시트 데이터를 교체하기 위해 호출.
 * 페이지 전환(라우팅) 없이 BottomSheet 콘텐츠만 갈아끼움.
 *
 * 우선순위:
 *   1) public/data/hub/{id}.json 존재 → 즉시 반환 (0ms)
 *   2) public/data/universe-graph-v5.json 의 노드 정보로 minimal 반환
 *   3) 둘 다 없으면 404
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { CosmosData } from "@/lib/types";
import type { UniverseGraphV5 } from "@/lib/graph-v5";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // 1) Hub JSON 우선
  const hubPath = path.join(process.cwd(), "public", "data", "hub", `${id}.json`);
  if (fs.existsSync(hubPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(hubPath, "utf-8")) as CosmosData;
      return NextResponse.json(data, {
        headers: { "Cache-Control": "public, max-age=3600" },
      });
    } catch {
      // 파싱 실패 → 다음 단계로
    }
  }

  // 2) V5 그래프에서 노드 정보 반환
  const graphPath = path.join(process.cwd(), "public", "data", "universe-graph-v5.json");
  if (fs.existsSync(graphPath)) {
    try {
      const graph = JSON.parse(fs.readFileSync(graphPath, "utf-8")) as UniverseGraphV5;
      const node = graph.nodes[id];

      if (node) {
        // 이 노드의 직접 연결 이웃을 위성으로 구성
        const neighbors = graph.edges
          .filter((e) => e.source === id || e.target === id)
          .map((e) => {
            const satelliteId = e.source === id ? e.target : e.source;
            const satNode = graph.nodes[satelliteId];
            if (!satNode) return null;
            return {
              spotifyId: satelliteId,
              name: satNode.name,
              imageUrl: satNode.image,
              genres: satNode.genres,
              popularity: satNode.popularity,
              previewUrl: satNode.previewUrl,
              previewTrackName: satNode.previewTrackName,
              spotifyUrl: satNode.spotifyUrl,
              relationType: e.relation,
              relationKeyword: e.label,
            };
          })
          .filter(Boolean);

        const minimal: CosmosData = {
          core: {
            spotifyId: id,
            name: node.nameKo || node.name,
            imageUrl: node.image,
            genres: node.genres,
            popularity: node.popularity,
            previewUrl: node.previewUrl,
            previewTrackName: node.previewTrackName,
            spotifyUrl: node.spotifyUrl,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          satellites: neighbors as any[],
        };

        return NextResponse.json(minimal, {
          headers: { "Cache-Control": "public, max-age=3600" },
        });
      }
    } catch {
      // 파싱 실패
    }
  }

  return NextResponse.json({ error: "Artist not found" }, { status: 404 });
}
