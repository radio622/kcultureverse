/**
 * POST /api/universe/flight-log
 * 자율주행 비행 기록 저장 — 로그인 유저 전용
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.googleId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { startArtist, path, totalStops, totalSeconds } = await req.json();

  if (!startArtist || !path || !Array.isArray(path)) {
    return NextResponse.json({ error: "잘못된 데이터" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  // user_profiles에서 id 조회
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("google_id", session.user.googleId)
    .maybeSingle();

  if (!profile?.id) {
    return NextResponse.json({ error: "프로필 조회 실패" }, { status: 404 });
  }

  const { error } = await supabase.from("flight_logs").insert({
    user_id: profile.id,
    start_artist: startArtist,
    path,
    total_stops: totalStops || path.length,
    total_seconds: totalSeconds || 0,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
