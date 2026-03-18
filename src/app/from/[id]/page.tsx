export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArtistCore } from "@/lib/spotify";
import CosmosClient from "@/components/CosmosClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

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

export default async function FromPage({ params }: Props) {
  const { id } = await params;

  let core;
  try {
    // 코어 아티스트 데이터만 서버에서 즉시 가져옵니다 (Spotify 1번 호출, ~1초)
    // 위성(관계망) 데이터는 CosmosClient 클라이언트에서 백그라운드로 로드합니다.
    core = await getArtistCore(id);
  } catch (error) {
    console.error("[FromPage] getArtistCore Error:", error);
    notFound();
  }

  if (!core) notFound();

  return <CosmosClient artistId={id} core={core} />;
}
