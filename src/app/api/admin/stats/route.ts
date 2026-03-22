/**
 * GET /api/admin/stats — 우주 통계
 * 노드/엣지 수는 빌드 타임에 생성된 v5-layout.json에서 읽음
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createSupabaseAdmin();

  // 우주 노드/엣지 수 (JSON 헤더에서 읽기)
  let nodeCount = 0, edgeCount = 0, lastBuiltAt: string | null = null;
  try {
    const layoutPath = path.join(process.cwd(), "public", "data", "v5-layout.json");
    const raw = await fs.readFile(layoutPath, "utf-8");
    const layout = JSON.parse(raw);
    nodeCount = layout.nodeCount ?? 0;
    lastBuiltAt = layout.builtAt ?? null;
  } catch { /* 파일 없으면 스킵 */ }

  try {
    const edgePath = path.join(process.cwd(), "public", "data", "v5-edges.json");
    const raw = await fs.readFile(edgePath, "utf-8");
    const edges = JSON.parse(raw);
    edgeCount = edges.edgeCount ?? 0;
  } catch { /* 스킵 */ }

  // Supabase 통계
  const [membersRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
    supabase.from("user_profiles").select("membership", { count: "exact", head: true }),
    supabase.from("universe_edit_logs").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("universe_edit_logs").select("*", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("universe_edit_logs").select("*", { count: "exact", head: true }).eq("status", "rejected"),
  ]);

  const { count: totalMembers } = membersRes;
  const { data: fullMembers } = await supabase.from("user_profiles").select("id", { count: "exact" }).eq("membership", "full");

  return NextResponse.json({
    nodeCount,
    edgeCount,
    memberCount: totalMembers ?? 0,
    fullMemberCount: fullMembers?.length ?? 0,
    pendingRequests: pendingRes.count ?? 0,
    approvedRequests: approvedRes.count ?? 0,
    rejectedRequests: rejectedRes.count ?? 0,
    lastBuiltAt,
  });
}
