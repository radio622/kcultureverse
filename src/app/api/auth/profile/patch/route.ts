/**
 * PATCH /api/auth/profile
 * 마이페이지에서 닉네임 / 뉴스레터 업데이트
 * membership은 newsletter 값에 따라 자동 계산
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.googleId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { nickname, newsletter } = body;

  const update: Record<string, unknown> = {};

  if (nickname !== undefined) {
    const trimmed = nickname.trim();
    if (!trimmed || trimmed.length > 20) {
      return NextResponse.json({ error: "닉네임은 1~20자여야 합니다" }, { status: 400 });
    }
    update.nickname = trimmed;
  }

  if (newsletter !== undefined) {
    update.newsletter = !!newsletter;
    update.membership = newsletter ? "full" : "associate";
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "변경 사항 없음" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("user_profiles")
    .update(update)
    .eq("google_id", session.user.googleId);

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 사용 중인 닉네임입니다" }, { status: 409 });
    }
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, membership: update.membership ?? session.user.membership });
}
