/**
 * K-Culture Universe V5.5 — 그래프 타입 정의
 * 
 * V5.5 핵심 원칙: 모든 아티스트는 평등한 노드(Node)이다.
 * 별의 크기와 밝기는 오직 degree(연결된 간선 수)에 비례하는
 * 연속적(continuous) 스케일로만 자연 결정된다.
 * 어떤 코드도 특정 아티스트를 강제로 크게 만들거나 작게 만들지 않는다.
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
  /** 연결된 간선 수. 렌더링 시 별의 크기와 밝기를 연속적으로 결정한다. */
  degree: number;
  accent?: string;   // degree 기반 자동 색상 (옵션)
  x?: number;        // d3-force 사전 계산 좌표
  y?: number;
}

export interface V5Edge {
  source: string;
  target: string;
  weight: number;          // 0.1 ~ 1.0 (높을수록 강한 관계)
  relation: V5EdgeRelation;
  label?: string;          // 예: "피처링", "프로듀서", "작곡/작사"
}

export interface UniverseGraphV5 {
  version: 5;
  builtAt: string;
  nodeCount: number;
  edgeCount: number;
  nodes: Record<string, V5Node>;
  edges: V5Edge[];
}

