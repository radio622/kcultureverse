/**
 * MusicBrainz API 클라이언트 v2
 *
 * 변경사항 (Phase 2 패치):
 *  - getArtistDiscography(): Release Group 기반 정확한 앨범 발매일 연표 수집
 *  - getComprehensiveCredits(): 전체 앨범 → 핵심 트랙 → Recording + Work 레벨 크레딧 통합 집계
 *    (작곡/작사는 Work 레벨에 저장됨을 실증 테스트로 확인 완료)
 *
 * Rate limit: 1 req/s — User-Agent 필수
 * 아티스트 1명 처리 시간: 약 3분 (Pre-bake 전용)
 */

import type { AlbumRelease, ArtistDiscography } from "./types";

const MB_API = "https://musicbrainz.org/ws/2";
const USER_AGENT = "KCultureVerse/2.0 (https://kcultureverse.app)";

// ── 내부 타입 ─────────────────────────────────────────────────────

interface MBRelation {
  type: string;
  direction: string;
  artist?: { id: string; name: string; type: string; disambiguation?: string };
  work?: { id: string; title: string };
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

interface MBReleaseGroup {
  id: string;
  title: string;
  "first-release-date": string | null;
  "primary-type": string;
  "secondary-types"?: string[];
}

interface MBRelease {
  id: string;
  title: string;
  date?: string;
  media?: Array<{
    tracks?: Array<{
      number: string;
      title: string;
      recording: { id: string; title: string };
    }>;
  }>;
}

export interface MBCredit {
  name: string;
  mbid: string;
  role: string;       // "producer" | "composer" | "lyricist" | "arranger" | "featured" | ...
  count: number;      // 여러 곡에 등장 시 가중치
}

// ── 공통 fetch 유틸 ───────────────────────────────────────────────

async function mbFetch<T>(path: string, delayMs = 1100): Promise<T | null> {
  // MusicBrainz 1 req/s 준수: 호출 전 무조건 대기
  await new Promise((r) => setTimeout(r, delayMs));

  try {
    const res = await fetch(`${MB_API}${path}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      cache: "force-cache",
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 503 || res.status === 429) {
      console.warn(`[MusicBrainz] Rate limited (${res.status}), 3초 대기 후 재시도...`);
      await new Promise((r) => setTimeout(r, 3000));
      const retry = await fetch(`${MB_API}${path}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        cache: "force-cache",
        signal: AbortSignal.timeout(8000),
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

// ── 공개 API 함수 ─────────────────────────────────────────────────

/**
 * 아티스트 이름으로 MusicBrainz MBID 검색
 */
export async function searchArtistMBID(artistName: string): Promise<string | null> {
  // "Various Artists" 오염 방지: 검색어 자체가 오염된 경우 차단
  const BLOCKED_NAMES = ["various artists", "various", "va", "unknown artist", "unknown"];
  if (BLOCKED_NAMES.includes(artistName.trim().toLowerCase())) {
    console.warn(`[MusicBrainz] 차단된 아티스트명: "${artistName}" — 검색 건너뜀`);
    return null;
  }

  const q = encodeURIComponent(artistName);
  const data = await mbFetch<{
    artists: { id: string; name: string; disambiguation?: string; score: number }[];
  }>(`/artist/?query=artist:${q}&fmt=json&limit=5`);

  if (!data?.artists?.length) return null;

  // "Various Artists" 결과 자체를 필터링 (컴필레이션 앨범 오염 방지)
  const filtered = data.artists.filter((a) => {
    const nameLower = a.name.toLowerCase();
    if (BLOCKED_NAMES.includes(nameLower)) return false;
    if (nameLower.startsWith("various")) return false;
    return true;
  });

  if (!filtered.length) {
    console.warn(`[MusicBrainz] "${artistName}" 검색 결과가 모두 Various Artists 등으로 필터됨`);
    return null;
  }

  // 점수 90+ 이면서 Korean/K-Pop 표기 있으면 우선
  const korean = filtered.find(
    (a) =>
      a.score >= 90 &&
      (a.disambiguation?.toLowerCase().includes("korean") ||
        a.disambiguation?.toLowerCase().includes("k-pop"))
  );
  return korean?.id ?? filtered[0].id;
}

/**
 * 아티스트의 직접 관계 (그룹 멤버, 공식 콜라보)
 */
export async function getArtistRelations(mbid: string): Promise<MBCredit[]> {
  const data = await mbFetch<MBArtist>(`/artist/${mbid}?inc=artist-rels&fmt=json`);
  if (!data?.relations) return [];

  const credits: MBCredit[] = [];
  for (const rel of data.relations) {
    if (!rel.artist) continue;
    if (rel.type === "member of band") {
      credits.push({
        name: rel.artist.name,
        mbid: rel.artist.id,
        role: rel.direction === "backward" ? "member" : "group",
        count: 1,
      });
    } else if (["collaboration", "is person"].includes(rel.type)) {
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
 * [Phase 2 신규] 아티스트의 전체 앨범 발매일 연표 수집
 * MusicBrainz Release Group의 first-release-date를 사용 (Spotify보다 훨씬 정확)
 */
export async function getArtistDiscography(
  spotifyId: string,
  artistName: string,
  mbid: string
): Promise<ArtistDiscography> {
  const albums: AlbumRelease[] = [];

  // Release Group 전체 목록 (Album + EP + Single)
  let offset = 0;
  const limit = 100;

  while (true) {
    const data = await mbFetch<{
      "release-groups": MBReleaseGroup[];
      "release-group-count": number;
    }>(
      `/release-group?artist=${mbid}&type=album|ep|single&limit=${limit}&offset=${offset}&fmt=json`
    );

    if (!data?.["release-groups"]?.length) break;

    for (const rg of data["release-groups"]) {
      // 라이브/컴필 등 제외 (Secondary Types 필터)
      const secondary = rg["secondary-types"] ?? [];
      if (secondary.some((t) => ["Live", "Compilation", "Remix", "DJ-mix"].includes(t))) continue;

      const type = mapReleaseGroupType(rg["primary-type"]);
      albums.push({
        title: rg.title,
        releaseDate: rg["first-release-date"] || null,
        type,
        mbReleaseGroupId: rg.id,
        source: "musicbrainz",
        verifyStatus: "auto",
      });
    }

    offset += limit;
    if (offset >= (data["release-group-count"] ?? 0)) break;
  }

  // 발매일 기준 오름차순 정렬
  albums.sort((a, b) => {
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    return a.releaseDate.localeCompare(b.releaseDate);
  });

  return {
    spotifyId,
    name: artistName,
    mbid,
    albums,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * [Phase 2 신규] 전체 앨범 스캔 기반 종합 크레딧 집계
 *
 * 파이프라인:
 *   Release Group 목록 → 대표 Release 1개 → 트랙 목록 →
 *   각 트랙의 Recording rels (producer/arranger/vocal) →
 *   Work ID 추출 → Work rels (★ composer / ★ lyricist)
 *   → 아티스트별 역할+곡수 집계
 *
 * 처리량: 앨범 최대 10개 × 트랙 최대 5개 = 최대 50곡
 *         곡당 최대 3 API 호출 → 최대 150 calls (~2.5분)
 */
export async function getComprehensiveCredits(
  coreArtistName: string,
  mbid: string
): Promise<MBCredit[]> {
  const creditMap = new Map<string, MBCredit>();

  // Step 1: Release Group 목록 (앨범/EP 우선, 싱글은 보조)
  const rgData = await mbFetch<{
    "release-groups": MBReleaseGroup[];
    "release-group-count": number;
  }>(`/release-group?artist=${mbid}&type=album|ep&limit=25&fmt=json`);

  const releaseGroups = rgData?.["release-groups"] ?? [];

  // 앨범 없으면 싱글로 fallback
  let targetGroups = releaseGroups.slice(0, 10);
  if (targetGroups.length === 0) {
    const singleData = await mbFetch<{ "release-groups": MBReleaseGroup[] }>(
      `/release-group?artist=${mbid}&type=single&limit=15&fmt=json`
    );
    targetGroups = singleData?.["release-groups"]?.slice(0, 10) ?? [];
  }

  if (targetGroups.length === 0) return [];

  // Step 2: 각 Release Group의 대표 Release → 트랙리스트
  for (const rg of targetGroups) {
    const relData = await mbFetch<{ releases: MBRelease[] }>(
      `/release?release-group=${rg.id}&inc=recordings&limit=1&fmt=json`
    );

    const release = relData?.releases?.[0];
    if (!release?.media) continue;

    // 트랙 수집 (미디어당 최대 5트랙)
    const tracks: { id: string; title: string }[] = [];
    for (const media of release.media) {
      for (const track of (media.tracks ?? []).slice(0, 5)) {
        if (track.recording?.id) {
          tracks.push({ id: track.recording.id, title: track.recording.title });
        }
      }
      if (tracks.length >= 5) break;
    }

    // Step 3: 각 트랙의 Recording rels + Work ID 추출
    for (const track of tracks) {
      const recData = await mbFetch<MBRecording>(
        `/recording/${track.id}?inc=artist-rels+work-rels&fmt=json`
      );
      if (!recData?.relations) continue;

      let workId: string | null = null;

      for (const rel of recData.relations) {
        // Recording 레벨 크레딧 (producer, arranger, vocal/피처링)
        if (rel.artist && rel.artist.id !== mbid) {
          const role = mapRecordingRelationType(rel.type);
          if (role) {
            accumulateCredit(creditMap, rel.artist, role);
          }
        }
        // Work ID 추출 (작곡/작사는 Work 레벨에 저장됨)
        if (rel.work && !workId) {
          workId = rel.work.id;
        }
      }

      // Step 4: Work 레벨 크레딧 (★ composer / ★ lyricist)
      if (workId) {
        const workData = await mbFetch<{ relations?: MBRelation[] }>(
          `/work/${workId}?inc=artist-rels&fmt=json`
        );
        for (const rel of workData?.relations ?? []) {
          if (rel.artist && rel.artist.id !== mbid) {
            const role = mapWorkRelationType(rel.type);
            if (role) {
              accumulateCredit(creditMap, rel.artist, role);
            }
          }
        }
      }
    }
  }

  // 빈도 순 정렬 후 반환
  return Array.from(creditMap.values()).sort((a, b) => b.count - a.count);
}

/**
 * [레거시 호환 유지] 기존 Recording 기반 검색 (getArtistFull에서 사용 중)
 * Phase 2 prebake 완료 후 getComprehensiveCredits로 교체 예정
 */
export async function getRecordingCredits(
  artistName: string,
  mbid: string
): Promise<MBCredit[]> {
  // 기존 recording 검색 API (빠르지만 샘플링 한계 있음)
  const data = await mbFetch<{ recordings: MBRecording[] }>(
    `/recording/?query=arid:${mbid}&fmt=json&limit=10`
  );

  if (!data?.recordings?.length) return [];

  const creditMap = new Map<string, MBCredit>();
  const recordingsToCheck = data.recordings.slice(0, 5);

  const recDetails = await Promise.all(
    recordingsToCheck.map((rec) =>
      mbFetch<MBRecording>(
        `/recording/${rec.id}?inc=artist-rels+work-level-rels+work-rels&fmt=json`
      )
    )
  );

  for (const recDetail of recDetails) {
    if (!recDetail?.relations) continue;
    for (const rel of recDetail.relations) {
      if (!rel.artist || rel.artist.id === mbid) continue;
      const role = mapRecordingRelationType(rel.type);
      if (role) accumulateCredit(creditMap, rel.artist, role);
    }
  }

  return Array.from(creditMap.values()).sort((a, b) => b.count - a.count);
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────

function accumulateCredit(
  map: Map<string, MBCredit>,
  artist: { id: string; name: string },
  role: string
) {
  const key = `${artist.id}_${role}`;
  const prev = map.get(key);
  if (prev) {
    prev.count++;
  } else {
    map.set(key, { name: artist.name, mbid: artist.id, role, count: 1 });
  }
}

/** Recording 레벨 관계 타입 매핑 */
function mapRecordingRelationType(mbType: string): string | null {
  const mapping: Record<string, string> = {
    producer: "producer",
    "co-producer": "producer",
    "executive producer": "producer",
    arranger: "arranger",
    vocal: "featured",
    guest: "featured",
    // 노이즈 필터 (엔지니어, 악기 연주자, 믹싱 등 순수 기술직은 위성 제외)
    // "mix", "recording", "instrument", "mastering" → null 반환으로 자동 필터
  };
  return mapping[mbType] ?? null;
}

/** Work 레벨 관계 타입 매핑 (작곡/작사 전담) */
function mapWorkRelationType(mbType: string): string | null {
  const mapping: Record<string, string> = {
    composer: "composer",
    lyricist: "lyricist",
    writer: "composer",
    "additional lyrics": "lyricist",
    translator: "lyricist", // 번역 가사
  };
  return mapping[mbType] ?? null;
}

/** Release Group primary-type → 앱 내 타입 */
function mapReleaseGroupType(
  type: string
): "Album" | "EP" | "Single" | "Other" {
  if (type === "Album") return "Album";
  if (type === "EP") return "EP";
  if (type === "Single") return "Single";
  return "Other";
}
