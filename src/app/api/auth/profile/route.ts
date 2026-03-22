/**
 * POST /api/auth/profile
 * 온보딩 완료 시 닉네임/성별/연령대/뉴스레터 저장
 * membership 자동 계산: 뉴스레터 동의 → full, 미동의 → associate
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.googleId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const { nickname, gender, ageGroup, newsletter } = body;

  if (!nickname?.trim()) {
    return NextResponse.json({ error: "닉네임은 필수입니다" }, { status: 400 });
  }
  if (nickname.trim().length > 20) {
    return NextResponse.json({ error: "닉네임은 20자 이하여야 합니다" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const membership = newsletter ? "full" : "associate";
  const isAdmin = session.user.role === "admin";

  const { error } = await supabase
    .from("user_profiles")
    .update({
      nickname: nickname.trim(),
      gender: gender ?? "undisclosed",
      age_group: ageGroup,
      newsletter: !!newsletter,
      membership,
      // Admin 계정은 항상 full 유지
      ...(isAdmin ? { membership: "full" } : {}),
    })
    .eq("google_id", session.user.googleId);

  if (error) {
    // 닉네임 중복
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 사용 중인 닉네임입니다" }, { status: 409 });
    }
    console.error("[profile] 업데이트 실패:", error);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, membership });
}
