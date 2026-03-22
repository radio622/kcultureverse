/**
 * POST /api/admin/verify-passphrase
 * Admin 암호 검증 (서버 측 환경변수와 비교)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { passphrase } = await req.json();
  const expected = process.env.ADMIN_PASSPHRASE;

  if (!expected || passphrase !== expected) {
    return NextResponse.json({ error: "Wrong passphrase" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
