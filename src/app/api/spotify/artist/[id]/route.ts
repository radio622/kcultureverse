import { NextRequest, NextResponse } from 'next/server';
import { getArtistFull } from '@/lib/spotify';

// GET /api/spotify/artist/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing artist id' }, { status: 400 });
  }

  try {
    const cosmosData = await getArtistFull(id);
    return NextResponse.json(cosmosData, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    console.error('[Spotify Artist Error]', err);
    return NextResponse.json({ error: 'Failed to fetch artist data' }, { status: 500 });
  }
}
