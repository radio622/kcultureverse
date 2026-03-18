import { NextRequest, NextResponse } from 'next/server';
import { searchArtists } from '@/lib/spotify';

// GET /api/spotify/search?q=블랙핑크
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');

  if (!q || !q.trim()) {
    return NextResponse.json({ error: 'Missing query parameter q' }, { status: 400 });
  }

  try {
    const artists = await searchArtists(q);
    return NextResponse.json(artists, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[Spotify Search Error]', err);
    return NextResponse.json({ error: 'Failed to search artists' }, { status: 500 });
  }
}
