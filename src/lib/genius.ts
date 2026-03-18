export interface GeniusArtist {
  api_path: string;
  header_image_url: string;
  id: number;
  image_url: string;
  name: string;
  url: string;
}

export interface GeniusCredits {
  producers: GeniusArtist[];
  writers: GeniusArtist[];
}

const GENIUS_API_URL = "https://api.genius.com";

async function geniusFetch<T>(endpoint: string): Promise<T | null> {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(`${GENIUS_API_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "force-cache", // 곡의 크레딧은 자주 바뀌지 않으므로 캐싱 권장
      signal: AbortSignal.timeout(3000), // 무한 로딩 원천 차단
    });

    if (!res.ok) return null;
    const body = await res.json();
    return body.response as T;
  } catch (error) {
    console.error("Genius API Error:", error);
    return null;
  }
}

/**
 * 곡 이름 + 아티스트로 Genius에서 검색 후, 첫 번째 곡의 ID를 반환
 */
export async function searchSongId(title: string, artist: string): Promise<number | null> {
  // 괄호, 피처링 표기 등 잡음 제거 (예: APT. (feat. Bruno Mars) -> APT.)
  const cleanTitle = title.split("(")[0].split("-")[0].trim();
  const query = encodeURIComponent(`${cleanTitle} ${artist}`);
  
  const data = await geniusFetch<{ hits: { type: string; result: { id: number; primary_artist: { name: string } } }[] }>(`/search?q=${query}`);
  
  if (!data || !data.hits || data.hits.length === 0) return null;
  
  // 첫 번째 결과 사용 (정확도 향상을 위해 꼼꼼히 비교하려면 여기서 분기 가능하지만 MVP는 첫번째가 유리)
  return data.hits[0].result.id;
}

/**
 * Genius 곡 ID로 프로듀서, 작사가 명단을 확정적으로 가져오기
 */
export async function getSongCredits(songId: number): Promise<GeniusCredits | null> {
  const data = await geniusFetch<{ song: { producer_artists: GeniusArtist[]; writer_artists: GeniusArtist[] } }>(`/songs/${songId}`);
  if (!data || !data.song) return null;

  return {
    producers: data.song.producer_artists || [],
    writers: data.song.writer_artists || [],
  };
}
