/**
 * /from/[id] — 특정 아티스트 기반 우주 페이지
 *
 * 로딩 전략 (Closed Universe 원칙):
 * 1. public/data/hub/{id}.json 이 있으면 → API 0회, 즉시 렌더링
 * 2. 없으면 → getArtistCore()  (Spotify API 1회) + 위성은 client에서 백그라운드 로드
 * 3. Spotify도 실패 → notFound()
 *
 * 히스토리: 브라우저 뒤로가기가 자연스럽게 동작하도록 force-dynamic 유지.
 * (next/navigation의 router.push가 히스토리 스택에 쌓이므로 별도 처리 불필요)
 */

export const dynamic = "force-dynamic";

import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArtistCore } from "@/lib/spotify";
import CosmosClient from "@/components/CosmosClient";
import FloatingSearch from "@/components/FloatingSearch";
import BackButton from "@/components/BackButton";
import { buildDeepSpaceNodes } from "@/lib/deep-space";
import { HUB_ARTISTS } from "@/data/hub-artists";
import type { CosmosData } from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

// ── 메타데이터 ─────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  // pre-baked 에서 이름 추출 시도 (API 0회)
  try {
    const filePath = path.join(process.cwd(), "public", "data", "hub", `${id}.json`);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as CosmosData;
    const name = data.core.name;
    const img  = data.core.imageUrl;
    return {
      title: `${name}로부터`,
      description: `${name}의 음악 우주를 탐험하세요.`,
      openGraph: {
        title: `${name}로부터`,
        description: `${name}의 음악 우주를 탐험하세요.`,
        images: img ? [{ url: img, width: 640, height: 640 }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: `${name}로부터`,
        description: `${name}의 음악 우주를 탐험하세요.`,
      },
    };
  } catch { /* pre-baked 없음 → API fallback */ }

  try {
    const artist = await getArtistCore(id);
    return {
      title: `${artist.name}로부터`,
      description: `${artist.name}의 음악 우주를 탐험하세요.`,
      openGraph: {
        title: `${artist.name}로부터`,
        description: `${artist.name}의 음악 우주를 탐험하세요.`,
        images: artist.imageUrl ? [{ url: artist.imageUrl, width: 640, height: 640 }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: `${artist.name}로부터`,
        description: `${artist.name}의 음악 우주를 탐험하세요.`,
      },
    };
  } catch {
    return { title: "KCultureVerse" };
  }
}

// ── 페이지 ─────────────────────────────────────────────────────
export default async function FromPage({ params }: Props) {
  const { id } = await params;

  // ── 1. pre-baked JSON 우선 시도 ────────────────────────────
  let prebaked: CosmosData | null = null;
  try {
    const filePath = path.join(process.cwd(), "public", "data", "hub", `${id}.json`);
    const raw = fs.readFileSync(filePath, "utf-8");
    prebaked = JSON.parse(raw) as CosmosData;
    
    // 오염된 데이터(선우정아 등)를 허브 데이터로 복구
    const hub = HUB_ARTISTS.find(h => h.spotifyId === id);
    if (hub) {
      prebaked.core.name = hub.nameKo;
      if (raw.includes('"name": "선우정아"') && hub.nameKo !== "선우정아") {
        prebaked.core.imageUrl = null;
        prebaked.core.previewUrl = null;
        prebaked.core.previewTrackName = null;
      }
    }
  } catch { /* JSON 없음 → 2번으로 */ }

  if (prebaked) {
    const deepSpaceNodes = buildDeepSpaceNodes(id);
    return (
      <>
        <FloatingSearch />
        <BackButton />
        <CosmosClient
          artistId={id}
          core={prebaked.core}
          initialSatellites={prebaked.satellites}
          deepSpaceNodes={deepSpaceNodes}
        />
      </>
    );
  }

  // ── 2. API fallback (위성은 client가 백그라운드에서 로드) ───
  let core;
  try {
    core = await getArtistCore(id);
  } catch (error) {
    console.error("[FromPage] getArtistCore Error:", error);
    notFound();
  }

  if (!core) notFound();

  const deepSpaceNodes = buildDeepSpaceNodes(id);

  return (
    <>
      <FloatingSearch />
      <BackButton />
      <CosmosClient artistId={id} core={core} deepSpaceNodes={deepSpaceNodes} />
    </>
  );
}
