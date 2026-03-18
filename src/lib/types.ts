/**
 * KCultureVerse 2.0 "Orbital Resonance"
 * 공유 타입 정의 — Spotify 기반 우주 궤도 시각화용
 */

/** 궤도 위의 아티스트 (코어) 기본 데이터 */
export interface CosmosArtist {
  spotifyId: string;
  name: string;
  imageUrl: string | null;    // 아티스트 이미지 (Spotify or TMDb)
  genres: string[];
  popularity: number;          // 0-100
  previewUrl: string | null;   // 30초 mp3 URL (iTunes)
  previewTrackName: string | null;
  spotifyUrl: string | null;   // 관련 외부 링크
}

/** 위성 특화 확장 데이터 (어떻게 연결되었는가) */
export interface SatelliteNode extends CosmosArtist {
  relationType: "FEATURED" | "PRODUCER" | "WRITER" | "ACTOR_COSTAR" | "SAME_GROUP" | "FALLBACK";
  relationKeyword: string;     // 예: "작곡: 에잇(eight)", "피처링: APT."
}

/** /from/[id] 페이지의 전체 우주 데이터 */
export interface CosmosData {
  core: CosmosArtist;
  satellites: SatelliteNode[];  // 단순 아티스트 배치가 아닌, 관계가 엮인 위성망 (최대 20개)
}

/** 오디오 재생 상태 */
export interface AudioState {
  isPlaying: boolean;
  currentTrackName: string | null;
  currentArtistId: string | null;
  progress: number;              // 0~1
}
