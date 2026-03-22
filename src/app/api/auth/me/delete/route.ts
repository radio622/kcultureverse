/**
 * DELETE /api/auth/me
 * 회원탈퇴: user_profiles 완전 삭제 (cascade로 flight_logs도 삭제)
 * edit_logs의 user_id는 SET NULL 처리 (데이터 보존)
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.googleId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();

  // 먼저 UUID 찾기
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("google_id", session.user.googleId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "프로필 없음" }, { status: 404 });
  }

  // 삭제 (CASCADE: flight_logs 자동 삭제, edit_logs user_id는 SET NULL)
  const { error } = await supabase
    .from("user_profiles")
    .delete()
    .eq("id", profile.id);

  if (error) {
    console.error("[delete-account]", error);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
