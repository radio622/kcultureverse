/**
 * MusicBrainz API 클라이언트
 * 무료, 키 불필요, 정형화된 크레딧/관계 데이터 제공
 * Rate limit: 1 req/s — 반드시 User-Agent 필수
 */

const MB_API = "https://musicbrainz.org/ws/2";
const USER_AGENT = "KCultureVerse/1.0 (https://kcultureverse.app)";

interface MBRelation {
  type: string;       // "member of band", "producer", "composer", "lyricist", "mix", "vocal" 등
  direction: string;  // "forward" | "backward"
  artist?: {
    id: string;
    name: string;
    type: string;     // "Person" | "Group"
    disambiguation?: string;
  };
  attributes?: string[];
}

interface MBArtist {
  id: string;
  name: string;
  type: string;
  relations?: MBRelation[];
}

interface MBRecording {
  id: string;
  title: string;
  "artist-credit"?: { name: string; artist: { id: string; name: string } }[];
  relations?: MBRelation[];
}

export interface MBCredit {
  name: string;
  mbid: string;
  role: string;       // "producer", "composer", "lyricist", "vocal", "featured", etc.
  count: number;       // 여러 곡에 등장 시 가중치
}

async function mbFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${MB_API}${path}`, {
      headers: { 
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
      },
      cache: "force-cache",  // MB 데이터는 거의 안 바뀌므로 공격적 캐싱
      signal: AbortSignal.timeout(3000), // MB 서버 응답 지연 시 강제 취소
    });

    if (res.status === 503 || res.status === 429) {
      // Rate limited — 1초 후 1회 재시도
      await new Promise(r => setTimeout(r, 1100));
      const retry = await fetch(`${MB_API}${path}`, {
        headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
        cache: "force-cache",
        signal: AbortSignal.timeout(3000),
      });
      if (!retry.ok) return null;
      return retry.json();
    }

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * MusicBrainz에서 아티스트 검색 → MBID 획득
 */
export async function searchArtistMBID(artistName: string): Promise<string | null> {
  const q = encodeURIComponent(artistName);
  const data = await mbFetch<{ artists: { id: string; name: string; disambiguation?: string; score: number }[] }>(
    `/artist/?query=artist:${q}&fmt=json&limit=3`
  );

  if (!data?.artists?.length) return null;

  // 점수가 가장 높고 disambiguation에 "Korean" 이 있으면 우선
  const korean = data.artists.find(a => 
    a.score >= 90 && (a.disambiguation?.toLowerCase().includes("korean") || a.disambiguation?.toLowerCase().includes("k-pop"))
  );
  return korean?.id ?? data.artists[0].id;
}

/**
 * 아티스트의 직접 관계(멤버, 콜라보 등) 가져오기
 * - member of band (그룹 ↔ 솔로 멤버)
 * - collaboration (공식 콜라보)
 */
export async function getArtistRelations(mbid: string): Promise<MBCredit[]> {
  const data = await mbFetch<MBArtist>(
    `/artist/${mbid}?inc=artist-rels&fmt=json`
  );

  if (!data?.relations) return [];

  const credits: MBCredit[] = [];
  for (const rel of data.relations) {
    if (!rel.artist) continue;

    // 그룹-멤버 관계
    if (rel.type === "member of band") {
      credits.push({
        name: rel.artist.name,
        mbid: rel.artist.id,
        role: rel.direction === "backward" ? "member" : "group",
        count: 1,
      });
    }
    // 콜라보/리믹스 관계
    else if (["collaboration", "is person"].includes(rel.type)) {
      credits.push({
        name: rel.artist.name,
        mbid: rel.artist.id,
        role: "collaboration",
        count: 1,
      });
    }
  }

  return credits;
}

/**
 * 아티스트의 레코딩들에서 크레딧(프로듀서, 작곡가 등) 추출  
 * recording 검색 → 각 recording의 rels에서 역할별 집계
 * 
 * 핵심: MusicBrainz의 recording에는 artist-rels(프로듀서, 보컬, 리믹서 등)이 직접 달려있음
 */
export async function getRecordingCredits(artistName: string, mbid: string): Promise<MBCredit[]> {
  // 아티스트 MBID로 최근 recording들 검색 (최대 10곡)
  const data = await mbFetch<{ recordings: MBRecording[] }>(
    `/recording/?query=arid:${mbid}&fmt=json&limit=5`
  );

  if (!data?.recordings?.length) return [];

  // 각 recording에서 artist-rels 가져오기 (비동기 병렬, 3곡만)
  const creditMap = new Map<string, MBCredit>();
  const recordingsToCheck = data.recordings.slice(0, 3);

  const recDetails = await Promise.all(
    recordingsToCheck.map(rec => 
      mbFetch<MBRecording>(`/recording/${rec.id}?inc=artist-rels+work-level-rels+work-rels&fmt=json`)
    )
  );

  for (const recDetail of recDetails) {
    if (!recDetail?.relations) continue;

    for (const rel of recDetail.relations) {
      if (!rel.artist) continue;
      // 자기 자신 제외
      if (rel.artist.id === mbid) continue;

      const roleType = mapRelationType(rel.type);
      if (!roleType) continue;

      const key = `${rel.artist.id}_${roleType}`;
      const prev = creditMap.get(key);
      if (prev) {
        prev.count++;
      } else {
        creditMap.set(key, {
          name: rel.artist.name,
          mbid: rel.artist.id,
          role: roleType,
          count: 1,
        });
      }
    }
  }

  // 빈도순 정렬
  return Array.from(creditMap.values()).sort((a, b) => b.count - a.count);
}

/**
 * MusicBrainz relationship type → 우리 앱의 역할 매핑
 */
function mapRelationType(mbType: string): string | null {
  const mapping: Record<string, string> = {
    "producer": "producer",
    "co-producer": "producer",
    "vocal": "featured",
    "guest": "featured",
    // 노이즈 역할(퍼포머, 악기, 믹싱, 레코딩, 리믹서 등)은 과감히 매핑 제외
    "composer": "composer",
    "lyricist": "lyricist",
    "writer": "composer",
    "arranger": "arranger",
  };
  return mapping[mbType] ?? null;
}
