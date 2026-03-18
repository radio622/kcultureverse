/**
 * 🌌 KCultureVerse — Neo4j 씨드 스크립트
 *
 * 동작 방식:
 *  1. TMDb 트렌딩 API (한국어·한국 리전) 에서 주간 인기 인물 5페이지(~100명) 수집
 *  2. 각 인물의 combined_credits 를 조회해 출연작(movie, tv) 목록 확보
 *  3. Neo4j 에 Person / Work 노드를 MERGE(중복 방지)로 삽입
 *  4. ACTED_IN / DIRECTED / CREW_IN 관계 생성
 *
 * 설계 원칙 (from dev_plan.md):
 *  - COLLABORATED_WITH 는 만들지 않는다 → 양분 그래프(Bipartite) 유지
 *  - TMDb Rate Limit(40 req/10s) 대비 요청 사이 딜레이 삽입
 *  - MERGE 로 멱등성(Idempotent) 보장 → 재실행해도 중복 없음
 *
 * 실행: npm run seed
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import neo4j from "neo4j-driver";

// .env.local 로드 (Next.js 앱과 동일하게 환경변수 읽기)
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// ── 설정 ─────────────────────────────────────────────
const TMDB_TOKEN   = process.env.NEXT_PUBLIC_TMDB_API_KEY!;
const NEO4J_URI    = process.env.NEO4J_URI!;
const NEO4J_USER   = process.env.NEO4J_USERNAME!;
const NEO4J_PASS   = process.env.NEO4J_PASSWORD!;
const TMDB_BASE    = "https://api.themoviedb.org/3";
const TMDB_HEADERS = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  "Content-Type": "application/json",
};

// 요청 사이 딜레이 (TMDb Rate Limit: 40 req/10s 기준, 안전하게 300ms)
const DELAY_MS     = 300;
// 수집할 트렌딩 페이지 수 (1페이지 = 20명, 5페이지 = 100명)
const TOTAL_PAGES  = 5;
// 인물당 최대 작품 수 (너무 많으면 실행 시간 폭발)
const MAX_WORKS_PER_PERSON = 20;

// ── 유틸 ─────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tmdbGet<T>(endpoint: string): Promise<T | null> {
  try {
    const res = await fetch(`${TMDB_BASE}${endpoint}`, { headers: TMDB_HEADERS });
    if (!res.ok) {
      console.warn(`  [TMDb] ${res.status} GET ${endpoint}`);
      return null;
    }
    return res.json();
  } catch (e) {
    console.error(`  [TMDb] fetch error: ${endpoint}`, e);
    return null;
  }
}

// ── Neo4j 연결 ───────────────────────────────────────
function createDriver() {
  if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASS) {
    throw new Error(
      "Neo4j 환경변수가 없습니다. .env.local 파일을 확인하세요.\n" +
      "필요: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD"
    );
  }
  return neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASS));
}

async function runCypher(
  session: ReturnType<ReturnType<typeof createDriver>["session"]>,
  cypher: string,
  params: Record<string, unknown> = {}
) {
  return session.run(cypher, params);
}

// ── 인덱스 생성 (최초 1회만 실행되면 됨) ─────────────
async function ensureIndexes(session: ReturnType<ReturnType<typeof createDriver>["session"]>) {
  const queries = [
    "CREATE CONSTRAINT person_tmdbId IF NOT EXISTS FOR (p:Person) REQUIRE p.tmdbId IS UNIQUE",
    "CREATE CONSTRAINT work_tmdbId   IF NOT EXISTS FOR (w:Work)   REQUIRE w.tmdbId IS UNIQUE",
  ];
  for (const q of queries) {
    await session.run(q);
  }
  console.log("✅ Neo4j 인덱스/제약조건 확인 완료");
}

// ── 인물 저장 ────────────────────────────────────────
async function upsertPerson(
  session: ReturnType<ReturnType<typeof createDriver>["session"]>,
  person: {
    id: number;
    name: string;
    known_for_department: string;
    popularity: number;
    profile_path: string | null;
  }
) {
  await runCypher(
    session,
    `MERGE (p:Person {tmdbId: $tmdbId})
     SET p.name       = $name,
         p.department = $department,
         p.popularity = $popularity,
         p.profilePath= $profilePath,
         p.updatedAt  = datetime()`,
    {
      tmdbId:      neo4j.int(person.id),
      name:        person.name,
      department:  person.known_for_department ?? "Unknown",
      popularity:  person.popularity,
      profilePath: person.profile_path ?? null,
    }
  );
}

// ── 작품 저장 + 관계 생성 ────────────────────────────
async function upsertWorkAndRelation(
  session: ReturnType<ReturnType<typeof createDriver>["session"]>,
  personId: number,
  work: {
    id: number;
    title?: string;
    name?: string;
    media_type: "movie" | "tv";
    poster_path: string | null;
    release_date?: string;
    first_air_date?: string;
    vote_average: number;
    character?: string;
    job?: string;
    department?: string;
  }
) {
  const title = work.title ?? work.name ?? "";
  const year = (work.release_date ?? work.first_air_date ?? "").slice(0, 4);

  // Work 노드 MERGE
  await runCypher(
    session,
    `MERGE (w:Work {tmdbId: $tmdbId})
     SET w.type       = $type,
         w.title      = $title,
         w.year       = $year,
         w.posterPath = $posterPath,
         w.voteAvg    = $voteAvg`,
    {
      tmdbId:     neo4j.int(work.id),
      type:       work.media_type,
      title,
      year,
      posterPath: work.poster_path ?? null,
      voteAvg:    work.vote_average ?? 0,
    }
  );

  // 관계 생성 — department/job 기반으로 분류
  const dept = (work.department ?? "").toLowerCase();
  const job  = (work.job ?? "").toLowerCase();
  const isDirector = dept === "directing" || job === "director";
  const isActor    = dept === "acting"    || !!work.character;
  const relType    = isDirector ? "DIRECTED" : isActor ? "ACTED_IN" : "CREW_IN";

  await runCypher(
    session,
    `MATCH (p:Person {tmdbId: $personId}), (w:Work {tmdbId: $workId})
     MERGE (p)-[r:${relType}]->(w)
     SET r.character = $character,
         r.job       = $job`,
    {
      personId:  neo4j.int(personId),
      workId:    neo4j.int(work.id),
      character: work.character ?? null,
      job:       work.job ?? null,
    }
  );
}

// ── 메인 ─────────────────────────────────────────────
async function main() {
  console.log("🌌 KCultureVerse — Neo4j 씨드 시작");
  console.log(`   NEO4J_URI: ${NEO4J_URI}`);
  console.log(`   수집 페이지: ${TOTAL_PAGES}페이지 (최대 ~${TOTAL_PAGES * 20}명)\n`);

  const driver  = createDriver();
  const session = driver.session();

  try {
    // 1. 인덱스 생성
    await ensureIndexes(session);

    // 2. 트렌딩 인물 수집
    const allPeople: Array<{
      id: number;
      name: string;
      known_for_department: string;
      popularity: number;
      profile_path: string | null;
    }> = [];

    for (let page = 1; page <= TOTAL_PAGES; page++) {
      const data = await tmdbGet<{ results: typeof allPeople }>(
        `/trending/person/week?language=ko-KR&region=KR&page=${page}`
      );
      if (data?.results) {
        allPeople.push(...data.results);
        console.log(`📡 트렌딩 인물 Page ${page}: ${data.results.length}명 수집`);
      }
      await sleep(DELAY_MS);
    }

    console.log(`\n👥 총 ${allPeople.length}명 수집 완료. Neo4j에 저장 시작...\n`);

    // 3. 인물별 출연작 수집 + Neo4j 저장
    let personIdx = 0;
    for (const person of allPeople) {
      personIdx++;
      process.stdout.write(
        `[${String(personIdx).padStart(3, "0")}/${allPeople.length}] ${person.name} 처리 중...`
      );

      // Person 노드 저장
      await upsertPerson(session, person);

      // combined_credits 조회
      const credits = await tmdbGet<{
        cast: Array<{
          id: number; title?: string; name?: string;
          media_type: "movie" | "tv"; poster_path: string | null;
          release_date?: string; first_air_date?: string;
          vote_average: number; character: string;
        }>;
        crew: Array<{
          id: number; title?: string; name?: string;
          media_type: "movie" | "tv"; poster_path: string | null;
          release_date?: string; first_air_date?: string;
          vote_average: number; job: string; department: string;
        }>;
      }>(`/person/${person.id}/combined_credits?language=ko-KR`);

      await sleep(DELAY_MS);

      if (!credits) {
        console.log(" ⚠️  credits 없음");
        continue;
      }

      // 출연작 (cast) — 평점 높은 순 상위 N개
      const castWorks = [...credits.cast]
        .filter((w) => w.media_type === "movie" || w.media_type === "tv")
        .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
        .slice(0, MAX_WORKS_PER_PERSON);

      // 스태프 (crew) — 감독만 추가 저장 (감독은 중요 관계)
      const crewWorks = credits.crew
        .filter((w) => (w.media_type === "movie" || w.media_type === "tv") && w.job === "Director")
        .slice(0, 10);

      const allWorks = [
        ...castWorks.map((w) => ({ ...w, character: w.character })),
        ...crewWorks.map((w) => ({ ...w, character: undefined })),
      ];

      for (const work of allWorks) {
        await upsertWorkAndRelation(session, person.id, work);
      }

      console.log(
        ` ✅ 출연작 ${castWorks.length}편 + 연출 ${crewWorks.length}편 저장`
      );
    }

    // 4. 통계 출력
    const stats = await session.run(`
      MATCH (p:Person) WITH count(p) AS persons
      MATCH (w:Work)   WITH persons, count(w) AS works
      MATCH ()-[r]->() WITH persons, works, count(r) AS rels
      RETURN persons, works, rels
    `);
    const row = stats.records[0];
    console.log("\n🎉 씨드 완료!");
    console.log(`   👥 Person 노드: ${row.get("persons")}개`);
    console.log(`   🎬 Work 노드:   ${row.get("works")}개`);
    console.log(`   🔗 관계:        ${row.get("rels")}개`);

  } catch (err) {
    console.error("\n❌ 씨드 실패:", err);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
