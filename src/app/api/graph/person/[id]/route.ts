/**
 * GET /api/graph/person/[id]
 * Neo4j에서 특정 인물의 1촌 관계망을 반환합니다.
 *
 * 반환 구조:
 * {
 *   person: { tmdbId, name, department, profilePath },
 *   works: [{ tmdbId, title, type, posterPath, relation, character }],
 * }
 *
 * JIT(Just-In-Time) 전략:
 *   Neo4j에 Person 노드가 없으면 TMDb에서 실시간으로 데이터를 가져와 자동 저장 후 반환.
 */
import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";
import { getPersonDetail, getTmdbImage } from "@/lib/tmdb";
import neo4j from "neo4j-driver";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tmdbId = Number(id);
  if (isNaN(tmdbId)) {
    return NextResponse.json({ error: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  try {
    // 1. Neo4j에서 인물 노드 + 연결된 작품 조회
    const rows = await runQuery<{
      personName: string;
      personDept: string;
      profilePath: string | null;
      workId: number;
      workTitle: string;
      workType: string;
      posterPath: string | null;
      relType: string;
      character: string | null;
      voteAvg: number;
    }>(
      `MATCH (p:Person {tmdbId: $tmdbId})-[r]->(w:Work)
       RETURN p.name         AS personName,
              p.department   AS personDept,
              p.profilePath  AS profilePath,
              w.tmdbId       AS workId,
              w.title        AS workTitle,
              w.type         AS workType,
              w.posterPath   AS posterPath,
              type(r)        AS relType,
              r.character    AS character,
              w.voteAvg      AS voteAvg
       ORDER BY w.voteAvg DESC
       LIMIT 50`,
      { tmdbId: neo4j.int(tmdbId) }
    );

    // 2. Neo4j에 데이터가 없으면 JIT — TMDb에서 가져와서 응답
    if (rows.length === 0) {
      const person = await getPersonDetail(tmdbId);
      if (!person) {
        return NextResponse.json({ error: "인물을 찾을 수 없습니다." }, { status: 404 });
      }

      // TODO: 백그라운드에서 Neo4j에 비동기 저장 (Phase 0-3 단계에서 구현 예정)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const credits = (person as any).combined_credits?.cast ?? [];

      return NextResponse.json({
        source: "tmdb-live",  // 클라이언트에서 캐시 미적용 여부 판단용
        person: {
          tmdbId,
          name: person.name,
          department: person.known_for_department,
          profilePath: person.profile_path,
          profileImg: getTmdbImage(person.profile_path, "w185"),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        works: credits.slice(0, 30).map((w: any) => ({
          tmdbId: w.id,
          title: w.title ?? w.name,
          type: w.media_type,
          posterPath: w.poster_path,
          posterImg: getTmdbImage(w.poster_path, "w185"),
          relType: "ACTED_IN",
          character: w.character ?? null,
          voteAvg: w.vote_average ?? 0,
        })),
      });
    }

    // 3. Neo4j 데이터로 응답 구성
    const firstRow = rows[0];
    return NextResponse.json({
      source: "neo4j",
      person: {
        tmdbId,
        name: firstRow.personName,
        department: firstRow.personDept,
        profilePath: firstRow.profilePath,
        profileImg: getTmdbImage(firstRow.profilePath, "w185"),
      },
      works: rows.map((r) => ({
        tmdbId: typeof r.workId === "object" ? (r.workId as unknown as { toNumber: () => number }).toNumber() : Number(r.workId),
        title: r.workTitle,
        type: r.workType,
        posterPath: r.posterPath,
        posterImg: getTmdbImage(r.posterPath, "w185"),
        relType: r.relType,
        character: r.character,
        voteAvg: r.voteAvg ?? 0,
      })),
    });
  } catch (err) {
    console.error("[/api/graph/person]", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
