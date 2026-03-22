/**
 * K-Culture Universe V5.5 — 그래프 타입 정의
 * 
 * V5.5 핵심 원칙: 모든 아티스트는 평등한 노드(Node)이다.
 * 별의 크기와 밝기는 오직 degree(연결된 간선 수)에 비례하는
 * 연속적(continuous) 스케일로만 자연 결정된다.
 * 어떤 코드도 특정 아티스트를 강제로 크게 만들거나 작게 만들지 않는다.
 */

export type V5EdgeRelation =
  | "SAME_GROUP"       // 그룹 멤버 (1.0)
  | "FAMILY"           // 가족/혈연/혼인 (1.0) - V7.5
  | "FEATURED"         // 피처링/정식 음원 협업 (0.7)
  | "PRODUCER"         // 프로듀서 (0.7)
  | "WRITER"           // 작곡/작사 (0.7)
  | "COVER_OFFICIAL"   // 공식 발매 리메이크/커버 (0.7)
  | "ALUMNI_INTIMATE"  // 동기 동창 (0.7) - V7.5
  | "AGENCY_MATE"      // 같은 기획사/레이블 (0.6) - V7.5
  | "COVER_FULL"       // 방송/SNS 풀 커버 (0.5)
  | "ALUMNI"           // 일반 동문/학연 (0.3 ~ 0.4) - V7.5
  | "COVER_PARTIAL"    // 방송/SNS 일부 커버 (0.3)
  | "SHARED_WRITER"    // 공동 작가 (0.3)
  | "SHARED_PRODUCER"  // 공동 프로듀서 (0.3)
  | "EVENT_CO"         // 행사/페스티벌 동반 참석 (0.3) - V7.5
  | "NEIGHBOR"         // 같은 동네/지연 (0.3) - V7.5
  | "LABEL"            // 단순 소속/배급사 (0.2)
  | "TV_SHOW"          // 방송/예능 공동 출연 (0.15)
  | "NEWS_MENTION"     // 기사 동시 언급 (0.15) - V7.5
  | "INDIRECT"         // 딥스캔 간접 교류 (0.1)
  | "GENRE_OVERLAP";   // 장르/테마 유사 (0.05)


export interface V5Node {
  id: string;
  /**
   * 영문 공식명 (또는 영문 주 표기).
   *
   * ⚠️ 데이터 품질 규칙 (docs/DATA_QUALITY_GUIDE.md 참조):
   *
   * 1. 【콜라보 금지】 세미콜론(;)이 포함된 이름은 절대 노드로 만들지 않는다.
   *    "Crush;태연" → ❌ 하나의 노드가 아님! Crush와 태연 각각 개별 노드 + FEATURED 엣지.
   *
   * 2. 【name ≠ nameKo】 name은 영문, nameKo는 한글. 둘 다 빈 값이면 안 된다.
   *    name="IU", nameKo="아이유" (O)
   *    name="BTS", nameKo="BTS"  (X) ← nameKo가 영문과 동일하면 안 됨
   */
  name: string;
  /**
   * 한글 공식명. `nameKo || name` 패턴으로 메인 표시명이 결정됨.
   * - nameKo가 있으면 → 한글이 화면 메인 표시
   * - nameKo가 없으면 → name(영문)으로 fallback (에러는 아님)
   * - ⚠️ 양쪽 다 채우는 것을 권장 (한글 검색 발견성 확보)
   * - name과 동일한 값이면 의미 없음 (name="BTS", nameKo="BTS" → ❌)
   */
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

