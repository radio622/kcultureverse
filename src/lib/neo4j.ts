/**
 * Neo4j 드라이버 연결 (싱글턴 패턴)
 * 아키텍처 원칙: 뼈대(Person ID, name, relationship)만 Neo4j에 저장.
 * 무거운 텍스트/이미지는 TMDb/Spotify API를 실시간 호출로 보완.
 */
import neo4j, { Driver } from "neo4j-driver";

declare global {
  // 개발 환경에서 Hot Reload 시 드라이버가 중복 생성되지 않도록 global에 캐시
  // eslint-disable-next-line no-var
  var _neo4jDriver: Driver | undefined;
}

function createDriver(): Driver {
  const uri      = process.env.NEO4J_URI!;
  const username = process.env.NEO4J_USERNAME!;
  const password = process.env.NEO4J_PASSWORD!;

  if (!uri || !username || !password) {
    throw new Error(
      "Neo4j 환경 변수가 설정되지 않았습니다. (.env.local 파일을 확인하세요)"
    );
  }

  return neo4j.driver(uri, neo4j.auth.basic(username, password), {
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 5000,
  });
}

// 싱글턴: 개발 환경에서는 global 캐시, 프로덕션에서는 모듈 레벨 변수
const driver: Driver =
  process.env.NODE_ENV === "development"
    ? (global._neo4jDriver ??= createDriver())
    : createDriver();

if (process.env.NODE_ENV === "development") {
  global._neo4jDriver = driver;
}

export default driver;

/**
 * Neo4j 세션을 열고 쿼리를 실행한 뒤 자동으로 닫는 헬퍼 함수
 * @example
 *   const people = await runQuery<{ name: string }>(
 *     "MATCH (p:Person) RETURN p.name AS name LIMIT 10"
 *   );
 */
export async function runQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => record.toObject() as T);
  } finally {
    await session.close();
  }
}
