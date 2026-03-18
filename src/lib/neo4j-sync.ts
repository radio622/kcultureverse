/**
 * Neo4j JIT(Just-In-Time) 동기화 헬퍼
 *
 * 유저가 처음 방문하는 인물/작품 페이지 → Neo4j에 없으면 TMDb에서 실시간으로 긁어와 자동 저장.
 * 우주가 유저와 함께 살아 숨쉬며 팽창하는 핵심 로직.
 *
 * 사용 위치:
 *  - /person/[id] 서버컴포넌트에서 진입 시 호출
 *  - /api/graph/person/[id] 에서 Neo4j miss 발생 시 호출
 */

import neo4j from "neo4j-driver";
import { getPersonDetail } from "./tmdb";

// Vercel serverless 환경에서 드라이버 싱글턴 재사용
declare global {
  // eslint-disable-next-line no-var
  var _neo4jSyncDriver: ReturnType<typeof neo4j.driver> | undefined;
}

function getSyncDriver() {
  if (!global._neo4jSyncDriver) {
    global._neo4jSyncDriver = neo4j.driver(
      process.env.NEO4J_URI!,
      neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
    );
  }
  return global._neo4jSyncDriver;
}

/**
 * Neo4j에 인물이 존재하는지 확인합니다.
 */
export async function personExistsInNeo4j(tmdbId: number): Promise<boolean> {
  const driver  = getSyncDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      "MATCH (p:Person {tmdbId: $tmdbId}) RETURN count(p) AS cnt",
      { tmdbId: neo4j.int(tmdbId) }
    );
    const cnt = result.records[0]?.get("cnt");
    return typeof cnt === "object" ? cnt.toNumber() > 0 : Number(cnt) > 0;
  } finally {
    await session.close();
  }
}

/**
 * TMDb에서 인물 데이터를 가져와 Neo4j에 동기화합니다.
 * person/[id] 페이지 진입 시 백그라운드로 호출 → 첫 방문자가 우주를 확장시킵니다.
 *
 * 오류 발생 시 조용히 실패 (throw 없음) — UI 렌더링을 막으면 안 됨.
 */
export async function syncPersonToNeo4j(tmdbId: number): Promise<void> {
  const driver  = getSyncDriver();
  const session = driver.session();

  try {
    const person = await getPersonDetail(tmdbId);
    if (!person) return;

    // Person 노드 MERGE
    await session.run(
      `MERGE (p:Person {tmdbId: $tmdbId})
       SET p.name       = $name,
           p.department = $department,
           p.popularity = $popularity,
           p.profilePath= $profilePath,
           p.updatedAt  = datetime()`,
      {
        tmdbId:      neo4j.int(tmdbId),
        name:        person.name,
        department:  person.known_for_department ?? "Unknown",
        popularity:  person.popularity,
        profilePath: person.profile_path ?? null,
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const credits: any[] = (person as any).combined_credits?.cast ?? [];
    const topWorks = credits
      .filter((w: { media_type: string }) => w.media_type === "movie" || w.media_type === "tv")
      .sort((a: { vote_average: number }, b: { vote_average: number }) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
      .slice(0, 20);

    for (const work of topWorks) {
      // Work 노드 MERGE
      await session.run(
        `MERGE (w:Work {tmdbId: $workId})
         SET w.type       = $type,
             w.title      = $title,
             w.posterPath = $posterPath,
             w.voteAvg    = $voteAvg`,
        {
          workId:     neo4j.int(work.id),
          type:       work.media_type,
          title:      work.title ?? work.name ?? "",
          posterPath: work.poster_path ?? null,
          voteAvg:    work.vote_average ?? 0,
        }
      );

      // ACTED_IN 관계 MERGE
      await session.run(
        `MATCH (p:Person {tmdbId: $personId}), (w:Work {tmdbId: $workId})
         MERGE (p)-[r:ACTED_IN]->(w)
         SET r.character = $character`,
        {
          personId:  neo4j.int(tmdbId),
          workId:    neo4j.int(work.id),
          character: work.character ?? null,
        }
      );
    }

    console.log(`[JIT sync] ${person.name} (${tmdbId}) → Neo4j 동기화 완료 (${topWorks.length}편)`);
  } catch (err) {
    // 조용한 실패 — UI 렌더링 블로킹 방지
    console.warn(`[JIT sync] ${tmdbId} 동기화 실패 (무시):`, err);
  } finally {
    await session.close();
  }
}
