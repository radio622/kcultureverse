/**
 * GET /api/graph/path?from=[tmdbId]&to=[tmdbId]
 * Neo4j 최단 경로(shortestPath) 알고리즘으로 두 인물 간 연결 고리를 반환합니다.
 *
 * 반환 구조:
 * {
 *   found: boolean,
 *   hops: number,
 *   path: Array<{ type: "person"|"work", tmdbId, name, img }>
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import driver from "@/lib/neo4j";
import neo4j from "neo4j-driver";

export async function GET(req: NextRequest) {
  const from = Number(req.nextUrl.searchParams.get("from"));
  const to   = Number(req.nextUrl.searchParams.get("to"));

  if (!from || !to || isNaN(from) || isNaN(to)) {
    return NextResponse.json(
      { error: "from 과 to 쿼리 파라미터(tmdbId)가 필요합니다." },
      { status: 400 }
    );
  }

  if (from === to) {
    return NextResponse.json({ found: false, error: "같은 인물입니다." }, { status: 400 });
  }

  if (!driver) {
    return NextResponse.json({ found: false, error: "데이터베이스에 연결할 수 없습니다." }, { status: 503 });
  }

  const session = driver.session();
  try {
    /**
     * Cypher shortestPath 쿼리
     * Person ↔ Work 형태로만 연결되므로, 최단 경로는 항상 홀수 홉(1hop=1작품 공유)
     * MAX_DEPTH = 6 (케빈 베이컨 6단계 법칙)
     */
    const result = await session.run(
      `MATCH (a:Person {tmdbId: $fromId}), (b:Person {tmdbId: $toId})
       MATCH path = shortestPath((a)-[:ACTED_IN|DIRECTED|CREW_IN*..12]-(b))
       RETURN path
       LIMIT 1`,
      {
        fromId: neo4j.int(from),
        toId:   neo4j.int(to),
      }
    );

    if (result.records.length === 0) {
      return NextResponse.json({ found: false, hops: -1, path: [] });
    }

    // 경로 직렬화 (Neo4j Path 객체 → 일반 배열)
    const path = result.records[0].get("path");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const segments: any[] = path.segments;

    const nodes: Array<{
      type: "person" | "work";
      tmdbId: number;
      name: string;
      img: string | null;
    }> = [];

    const seen = new Set<number>();

    for (const seg of segments) {
      for (const node of [seg.start, seg.end]) {
        const rawId: { toNumber: () => number } = node.properties.tmdbId;
        const tmdbId = rawId.toNumber();
        if (seen.has(tmdbId)) continue;
        seen.add(tmdbId);

        const isWork = node.labels.includes("Work");
        nodes.push({
          type:   isWork ? "work" : "person",
          tmdbId,
          name:   node.properties.title ?? node.properties.name ?? "",
          img:    node.properties.posterPath ?? node.properties.profilePath ?? null,
        });
      }
    }

    // 홉 수 = Person 간 거리 = 작품 노드 수
    const hops = (nodes.length - 1) / 2;

    return NextResponse.json({ found: true, hops, path: nodes });
  } catch (err) {
    console.error("[/api/graph/path]", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  } finally {
    await session.close();
  }
}
