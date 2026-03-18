/**
 * GET /api/search?q=검색어
 * TMDb /search/multi 를 서버에서 호출해 결과를 반환합니다.
 * NEXT_PUBLIC_ 대신 서버전용 환경변수로 토큰을 관리할 수 있도록 서버 라우트를 경유합니다.
 */
import { NextRequest, NextResponse } from "next/server";
import { searchAll } from "@/lib/tmdb";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";

  if (!q.trim()) {
    return NextResponse.json({ people: [], movies: [], shows: [] });
  }

  try {
    const result = await searchAll(q);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[/api/search] error:", e);
    return NextResponse.json(
      { error: "검색 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
