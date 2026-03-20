/**
 * K-Culture Universe V5 — 그래프 타입 정의
 * scripts/build-universe-v5.ts 의 출력 스키마와 정확히 일치해야 함
 */

export type V5EdgeRelation =
  | "SAME_GROUP"
  | "FEATURED"
  | "PRODUCER"
  | "WRITER"
  | "INDIRECT"
  | "GENRE_OVERLAP";

export interface V5Node {
  id: string;
  name: string;
  nameKo: string;
  image: string | null;
  genres: string[];
  popularity: number;
  previewUrl: string | null;
  previewTrackName: string | null;
  spotifyUrl: string | null;
  /** 0=허브, 1=직접위성, 2=간접위성 */
  tier: 0 | 1 | 2;
  accent?: string;   // tier 0(허브) 전용 색상
  x?: number;        // d3-force 사전 계산 좌표
  y?: number;
}

export interface V5Edge {
  source: string;
  target: string;
  weight: number;          // 0.1 ~ 1.0 (높을수록 강한 관계)
  relation: V5EdgeRelation;
  label: string;           // 예: "피처링: APT.", "프로듀서 (7곡)"
}

export interface UniverseGraphV5 {
  version: 5;
  builtAt: string;
  nodeCount: number;
  edgeCount: number;
  nodes: Record<string, V5Node>;
  edges: V5Edge[];
}
