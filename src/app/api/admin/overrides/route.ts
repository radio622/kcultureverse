/**
 * GET /api/admin/overrides — data_overrides 목록
 * POST /api/admin/overrides/[id]/rollback — 패치 삭제
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("data_overrides")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
