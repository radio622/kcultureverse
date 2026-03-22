/**
 * GET /api/admin/edit-logs?status=pending|approved|rejected
 * PATCH /api/admin/edit-logs/:id — 상태 변경
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status");
  const supabase = createSupabaseAdmin();

  let query = supabase
    .from("universe_edit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && ["pending", "approved", "rejected"].includes(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
