import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/universe/today-albums
 *
 * 오늘의 우주 — "오늘 날짜(월/일)에 발매된 역대 앨범" 반환
 *
 * Query params:
 *   month: 1~12 (기본: 오늘)
 *   day: 1~31 (기본: 오늘)
 *   limit: 최대 반환 수 (기본: 10)
 *   verified_only: "true" | "false" (기본: false — 미검증도 포함)
 *
 * 반환:
 * {
 *   date: { month: 3, day: 22 },
 *   albums: [{ artist_id, artist_name, artist_name_ko, album_title, release_date, ... }],
 *   featured_artist: { id, name, nameKo },  ← 랜덤 선택한 "오늘의 대표 아티스트"
 *   fallback: boolean  ← 해당 날짜 앨범이 없어 ±3일 fallback한 경우 true
 * }
 *
 * UX 주의 (docs/V7.0.4_ROADMAP.md § 11):
 *   - 해당 날짜 앨범 0건이면 ±3일 범위로 확장 (fallback: true)
 *   - 그래도 없으면 빈 배열 반환 (UI에서 랜덤 추천으로 대체)
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // 날짜 파라미터 (기본: 오늘 KST)
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));
  const day   = parseInt(searchParams.get("day")   ?? String(now.getDate()));
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 50);
  const verifiedOnly = searchParams.get("verified_only") === "true";

  if (isNaN(month) || month < 1 || month > 12 ||
      isNaN(day)   || day   < 1 || day   > 31) {
    return NextResponse.json({ error: "Invalid month/day" }, { status: 400 });
  }

  // 1차 시도: 정확한 날짜
  let albums = await queryAlbums(month, day, limit, verifiedOnly);
  let fallback = false;

  // 빈 경우: ±3일 fallback (V7.0.4_ROADMAP.md UX 고려사항)
  if (albums.length === 0) {
    fallback = true;
    for (let offset = 1; offset <= 3; offset++) {
      const tryDate = new Date(2000, month - 1, day + offset);
      albums = await queryAlbums(
        tryDate.getMonth() + 1,
        tryDate.getDate(),
        limit,
        verifiedOnly
      );
      if (albums.length > 0) break;

      const tryDateBack = new Date(2000, month - 1, day - offset);
      albums = await queryAlbums(
        tryDateBack.getMonth() + 1,
        tryDateBack.getDate(),
        limit,
        verifiedOnly
      );
      if (albums.length > 0) break;
    }
  }

  // featured_artist: 발매 앨범 중 랜덤 1명 선택
  const featuredAlbum =
    albums.length > 0
      ? albums[Math.floor(Math.random() * albums.length)]
      : null;
  const featuredArtist = featuredAlbum
    ? {
        id: featuredAlbum.artist_id,
        name: featuredAlbum.artist_name,
        nameKo: featuredAlbum.artist_name_ko ?? featuredAlbum.artist_name,
      }
    : null;

  return NextResponse.json({
    date: { month, day },
    albums,
    featured_artist: featuredArtist,
    fallback,
    total: albums.length,
  });
}

// ── 공통 쿼리 헬퍼 (RPC 방식 — PostgREST는 EXTRACT 미지원) ──
async function queryAlbums(
  month: number,
  day: number,
  limit: number,
  verifiedOnly: boolean
) {
  // Supabase RPC: get_albums_by_mmdd(p_month, p_day, p_limit)
  const { data, error } = await supabase.rpc("get_albums_by_mmdd", {
    p_month: month,
    p_day: day,
    p_limit: limit,
  });

  if (error) {
    console.error("[today-albums] Supabase RPC error:", error.message);
    return [];
  }

  let results = data ?? [];

  // verified_only 필터 (클라이언트 사이드 — RPC 결과에서 필터)
  if (verifiedOnly) {
    results = results.filter((r: { verified: boolean }) => r.verified);
  }

  return results;
}
