/**
 * GET /api/universe/artist?id={spotifyId}
 *
 * V5.3: v5-details.json + v5-edges.json 기반으로 응답.
 * 노드 클릭 시 바텀시트 데이터(1촌 목록) 반환.
 *
 * 우선순위:
 *   1) public/data/hub/{id}.json 존재 → 즉시 반환 (허브 아티스트)
 *   2) v5-details.json + v5-layout.json에서 조합 반환 (위성 아티스트)
 *   3) 둘 다 없으면 404
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { CosmosData } from "@/lib/types";

export const runtime = "nodejs";

// 파일 경로 상수
const DATA_DIR     = path.join(process.cwd(), "public", "data");
const HUB_DIR      = path.join(DATA_DIR, "hub");
const LAYOUT_PATH  = path.join(DATA_DIR, "v5-layout.json");
const EDGES_PATH   = path.join(DATA_DIR, "v5-edges.json");
const DETAILS_PATH = path.join(DATA_DIR, "v5-details.json");

// 서버 메모리 캐시 (cold start 후 파일 재파싱 방지)
let _layoutCache: Record<string, any> | null = null;
let _edgesCache: any[] | null = null;
let _detailsCache: Record<string, any> | null = null;

function getLayout(): Record<string, any> {
  if (!_layoutCache && fs.existsSync(LAYOUT_PATH)) {
    const f = JSON.parse(fs.readFileSync(LAYOUT_PATH, "utf-8"));
    _layoutCache = Object.fromEntries((f.nodes ?? []).map((n: any) => [n.id, n]));
  }
  return _layoutCache ?? {};
}

function getEdges(): any[] {
  if (!_edgesCache && fs.existsSync(EDGES_PATH)) {
    const f = JSON.parse(fs.readFileSync(EDGES_PATH, "utf-8"));
    _edgesCache = f.edges ?? [];
  }
  return _edgesCache ?? [];
}

function getDetails(): Record<string, any> {
  if (!_detailsCache && fs.existsSync(DETAILS_PATH)) {
    const f = JSON.parse(fs.readFileSync(DETAILS_PATH, "utf-8"));
    _detailsCache = f.nodes ?? {};
  }
  return _detailsCache ?? {};
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // 1) Hub JSON 파일 우선 (허브 아티스트 — 즉시 반환)
  const hubPath = path.join(HUB_DIR, `${id}.json`);
  if (fs.existsSync(hubPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(hubPath, "utf-8")) as CosmosData;
      return NextResponse.json(data, {
        headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
      });
    } catch { /* 파싱 실패 → 다음 단계 */ }
  }

  // 2) v5 분할 파일에서 조합 (위성 아티스트)
  const layout = getLayout();
  const edges = getEdges();
  const details = getDetails();

  const node = layout[id];
  if (!node) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }

  const detail = details[id] ?? {};

  // 이 노드와 연결된 엣지 → 1촌 위성 목록
  const satellites = edges
    .filter((e) => e.source === id || e.target === id)
    .map((e) => {
      const satId = e.source === id ? e.target : e.source;
      const satLayout = layout[satId];
      if (!satLayout) return null;
      const satDetail = details[satId] ?? {};
      return {
        spotifyId: satId,
        name: satLayout.nameKo || satLayout.name,
        imageUrl: satDetail.image ?? null,
        genres: satDetail.genres ?? [],
        popularity: satDetail.popularity ?? 0,
        previewUrl: satDetail.previewUrl ?? null,
        previewTrackName: satDetail.previewTrackName ?? null,
        spotifyUrl: satDetail.spotifyUrl ?? null,
        relationType: e.relation,
        relationKeyword: e.label,
      };
    })
    .filter(Boolean)
    // weight 내림차순 (이미 edges에 weight 있음)
    .slice(0, 20);

  const result: CosmosData = {
    core: {
      spotifyId: id,
      name: node.nameKo || node.name,
      imageUrl: detail.image ?? null,
      genres: detail.genres ?? [],
      popularity: detail.popularity ?? 0,
      previewUrl: detail.previewUrl ?? null,
      previewTrackName: detail.previewTrackName ?? null,
      spotifyUrl: detail.spotifyUrl ?? null,
    },
    satellites: satellites as any[],
  };

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
