/**
 * GET /api/auth/me
 * 현재 로그인 유저의 Supabase 프로필 조회
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.googleId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, nickname, gender, age_group, newsletter, role, membership, email, created_at")
    .eq("google_id", session.user.googleId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "프로필을 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json(data);
}
