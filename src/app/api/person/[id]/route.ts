/**
 * GET /api/person/[id]
 * TMDb 인물 상세 정보를 서버에서 가져와 반환합니다.
 */
import { NextRequest, NextResponse } from "next/server";
import { getPersonDetail } from "@/lib/tmdb";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const person = await getPersonDetail(Number(id));
  if (!person) {
    return NextResponse.json({ error: "인물 정보를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(person);
}
