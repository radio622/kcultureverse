/**
 * TMDb API 클라이언트
 * 데이터 전략: 무거운 텍스트/이미지는 TMDb에서 실시간으로 가져옴.
 * Neo4j에는 tmdbId + name만 저장하고, 상세 정보는 이 파일의 함수들로 실시간 보완.
 */

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

// 인증 헤더 (Bearer Token 방식)
const headers = {
  Authorization: `Bearer ${process.env.NEXT_PUBLIC_TMDB_API_KEY}`,
  "Content-Type": "application/json",
};

// 이미지 URL 생성 헬퍼
export const getTmdbImage = (
  path: string | null | undefined,
  size: "w185" | "w342" | "w500" | "w780" | "original" = "w342"
): string | null => {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
};

// ── 인물 ─────────────────────────────────────────────

export interface TmdbPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  known_for: TmdbWork[];
}

export interface TmdbPersonDetail extends TmdbPerson {
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  also_known_as: string[];
}

// 한국 인물 트렌딩 목록 (주간)
export async function getTrendingKoreanPeople(): Promise<TmdbPerson[]> {
  const res = await fetch(
    `${BASE_URL}/trending/person/week?language=ko-KR&region=KR`,
    { headers, next: { revalidate: 3600 } } // 1시간 캐시
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

// 인물 검색
export async function searchPeople(query: string): Promise<TmdbPerson[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `${BASE_URL}/search/person?query=${encodeURIComponent(query)}&language=ko-KR&include_adult=false`,
    { headers, next: { revalidate: 60 } } // 1분 캐시
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

// 인물 상세 정보
export async function getPersonDetail(tmdbId: number): Promise<TmdbPersonDetail | null> {
  const res = await fetch(
    `${BASE_URL}/person/${tmdbId}?language=ko-KR&append_to_response=combined_credits`,
    { headers, next: { revalidate: 86400 } } // 24시간 캐시
  );
  if (!res.ok) return null;
  return res.json();
}

// ── 작품 ─────────────────────────────────────────────

export interface TmdbWork {
  id: number;
  title?: string;      // 영화
  name?: string;       // 드라마
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  media_type?: "movie" | "tv" | "person";
}

// 한국 인기 영화 목록
export async function getTrendingKoreanMovies(): Promise<TmdbWork[]> {
  const res = await fetch(
    `${BASE_URL}/trending/movie/week?language=ko-KR&region=KR`,
    { headers, next: { revalidate: 3600 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

// 한국 인기 드라마 목록
export async function getTrendingKoreanShows(): Promise<TmdbWork[]> {
  const res = await fetch(
    `${BASE_URL}/trending/tv/week?language=ko-KR&region=KR&with_origin_country=KR`,
    { headers, next: { revalidate: 3600 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

// 통합 검색 (인물 + 영화 + 드라마)
export async function searchAll(query: string) {
  if (!query.trim()) return { people: [], movies: [], shows: [] };
  const res = await fetch(
    `${BASE_URL}/search/multi?query=${encodeURIComponent(query)}&language=ko-KR&include_adult=false`,
    { headers, next: { revalidate: 60 } }
  );
  if (!res.ok) return { people: [], movies: [], shows: [] };
  const data = await res.json();
  const results: TmdbWork[] = data.results ?? [];
  return {
    people: results.filter((r) => r.media_type === "person") as TmdbPerson[],
    movies: results.filter((r) => r.media_type === "movie"),
    shows:  results.filter((r) => r.media_type === "tv"),
  };
}
