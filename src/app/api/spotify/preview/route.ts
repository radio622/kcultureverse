import { NextRequest, NextResponse } from "next/server";
import { getArtistPreviewViaSearch } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Missing artist name parameter" }, { status: 400 });
  }

  try {
    const previewData = await getArtistPreviewViaSearch(name);
    return NextResponse.json(previewData, {
      headers: { 'Cache-Control': 'public, s-maxage=86400' }, // 하루 캐싱
    });
  } catch (err) {
    console.error("[Spotify Preview API Error]", err);
    return NextResponse.json({ previewUrl: null, trackName: null });
  }
}
