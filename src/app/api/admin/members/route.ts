/**
 * GET /api/admin/members — 전체 회원 목록
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, nickname, role, membership, newsletter, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
