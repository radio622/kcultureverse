import { NextRequest, NextResponse } from 'next/server';
import { getArtistFull } from '@/lib/spotify';

/**
 * GET /api/cosmos/[id]
 * 위성 데이터(전체 관계망)를 비동기로 반환하는 전용 API.
 * 클라이언트에서 백그라운드로 호출하므로, 시간이 걸려도 렌더링이 멈추지 않습니다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing artist id' }, { status: 400 });
  }

  try {
    const data = await getArtistFull(id);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    console.error('[Cosmos API Error]', err);
    return NextResponse.json({ error: 'Failed to load cosmos data' }, { status: 500 });
  }
}
