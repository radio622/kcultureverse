/**
 * PATCH /api/admin/edit-logs/[id]
 * 수동 승인/거절
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { status } = await req.json();

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("universe_edit_logs")
    .update({ status, applied_at: status === "approved" ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 승인 시 data_overrides에 패치 등록
  if (status === "approved") {
    const { data: log } = await supabase
      .from("universe_edit_logs")
      .select("intent, parsed_data")
      .eq("id", id)
      .maybeSingle();

    if (log?.parsed_data) {
      await supabase.from("data_overrides").insert({
        edit_log_id: parseInt(id),
        target_type: log.intent,
        patch_data: log.parsed_data,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
