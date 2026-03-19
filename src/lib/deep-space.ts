/**
 * 심우주(Deep Space) 노드 생성 유틸리티
 *
 * hub-artists.ts에서 현재 코어를 제외한 나머지 허브 아티스트들을
 * 먼 우주 좌표(600~1800px 반경)에 결정적으로 배치합니다.
 * JSON 파일 의존 없음 — 100% hub-artists.ts 기반.
 */

import fs from "fs";
import path from "path";
import { HUB_ARTISTS } from "@/data/hub-artists";
import type { DeepSpaceNode } from "./types";

/** 시드 기반 결정적 난수 (0~1) — 아티스트 이름에서 항상 같은 값 */
function seededRandom(seed: string, salt: number = 0): number {
  let h = salt;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * 심우주 노드 배열 생성 (서버 사이드 전용)
 * @param currentCoreId  현재 화면의 코어 아티스트 Spotify ID (제외 대상)
 */
export function buildDeepSpaceNodes(currentCoreId: string): DeepSpaceNode[] {
  const hubDir = path.join(process.cwd(), "public", "data", "hub");
  const nodes: DeepSpaceNode[] = [];

  // 현재 코어를 제외한 나머지 허브 아티스트
  const others = HUB_ARTISTS.filter((h) => h.spotifyId !== currentCoreId);

  others.forEach((hub, i) => {
    // ── 극좌표 → 직교 좌표 변환 ────────────────────────────
    // 황금각(Golden Angle: ~137.5°) 기반 나선 배치 → 자연스러운 산란
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.3999 rad
    const angle = i * goldenAngle;

    // 반경: 600 ~ 1600px, 바깥으로 갈수록 점점 넓어짐
    const baseRadius = 600 + (i / others.length) * 1000;
    const jitter = seededRandom(hub.spotifyId, 1) * 200 - 100; // ±100px 랜덤 지터
    const radius = baseRadius + jitter;

    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.55; // Y축 55% 압축 → 타원 원근감

    // pre-baked JSON 존재 여부 확인 및 이미지 추출
    const jsonPath = path.join(hubDir, `${hub.spotifyId}.json`);
    let canDive = false;
    let imageUrl: string | null = null;
    try { 
      if (fs.existsSync(jsonPath)) {
        canDive = true;
        const raw = fs.readFileSync(jsonPath, "utf-8");
        const json = JSON.parse(raw);
        imageUrl = json.core?.imageUrl || null;
      }
    } catch { /* ignore */ }

    // 노드 크기: 인덱스 기반 (가까운 것은 크게, 먼 것은 작게)
    const size = 30 - (i / others.length) * 10; // 30px → 20px

    nodes.push({
      spotifyId: hub.spotifyId,
      name: hub.nameKo,
      accent: hub.accent,
      x: Math.round(x),
      y: Math.round(y),
      size: Math.round(size),
      canDive,
      imageUrl,
    });
  });

  return nodes;
}
