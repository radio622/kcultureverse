import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * /api/admin/albums
 * GET: 해당 월/일(mm/dd) 발매된 앨범 목록을 가져옵니다.
 * PUT: 수동으로 특정 앨범의 릴리즈 날짜와 is_korean_artist 값을 업데이트하고 verified=true 로 마킹합니다.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || "0");
  const day = parseInt(searchParams.get("day") || "0");
  
  if (!month || !day) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const { data, error } = await supabase.rpc("get_albums_by_mmdd", {
    p_month: month, 
    p_day: day, 
    p_limit: 100 // 관리자 뷰는 한 번에 많이
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  try {
    const { id, release_date, is_korean_artist, note } = await req.json();
    
    if (!id || !release_date) {
        return NextResponse.json({ error: "id and release_date are required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("album_releases")
      .update({ 
         release_date, 
         is_korean_artist, 
         verified: true,
         verified_at: new Date().toISOString(),
         verification_source: 'admin_manual',
         verification_note: note || "Admin 수동 교정"
      })
      .eq("id", id);
      
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
