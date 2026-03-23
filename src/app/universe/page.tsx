/**
 * /universe — 서버 컴포넌트 래퍼
 *
 * 역할:
 *  1. searchParams(?artist=, ?to=)에 따라 동적 OG 메타데이터 생성
 *     → 카카오톡/SNS 링크 미리보기가 "백아로부터" 또는 "백아로부터 서태지에게"로 표시
 *  2. 실제 우주 UI는 UniverseClient(클라이언트 컴포넌트)에 위임
 */

import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import UniverseClient from "./UniverseClient";

// ── 종성 판별 → 조사 선택 ──────────────────────────────────────
function getJosa(word: string, josa1: string, josa2: string) {
  if (!word) return josa1;
  const lastChar = word.charCodeAt(word.length - 1);
  if (lastChar < 0xac00 || lastChar > 0xd7a3) {
    const isConsonant = /[13678LMNR]$/i.test(word);
    return isConsonant ? josa2 : josa1;
  }
  return (lastChar - 0xac00) % 28 > 0 ? josa2 : josa1;
}

// ── 노드 이름 조회 (v5-layout.json에서 빠르게) ──────────────────
interface LayoutNode {
  id: string;
  name: string;
  nameKo: string;
}

let _nodeCache: Record<string, LayoutNode> | null = null;

function getNodeName(nodeId: string): string | null {
  if (!_nodeCache) {
    try {
      const filePath = path.join(process.cwd(), "public/data/v5-layout.json");
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      _nodeCache = {};
      for (const n of data.nodes) {
        if (n && n.id) {
          _nodeCache[n.id] = n;
        }
      }
    } catch {
      return null;
    }
  }
  const node = _nodeCache?.[nodeId];
  return node ? (node.nameKo || node.name) : null;
}

// ── 동적 메타데이터 ─────────────────────────────────────────────
interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const artistId = typeof params.artist === "string" ? params.artist : undefined;
  const toId = typeof params.to === "string" ? params.to : undefined;

  // 기본 메타
  const base: Metadata = {
    title: "우주 탐험",
    description: "K-culture 아티스트들의 관계망을 별자리처럼 탐험하세요.",
    openGraph: {
      title: "우주 탐험",
      description: "K-culture 아티스트들의 관계망을 별자리처럼 탐험하세요.",
      type: "website",
      siteName: "K-Culture Universe",
    },
    twitter: {
      card: "summary_large_image",
    },
  };

  if (!artistId) return base;

  const fromName = getNodeName(artistId);
  if (!fromName) return base;

  // ── 여정 모드: ?artist=A&to=B → "백아로부터 서태지에게" ──
  if (toId) {
    const toName = getNodeName(toId);
    if (toName) {
      const josa = getJosa(fromName, "로부터", "으로부터");
      const title = `${fromName}${josa} ${toName}에게 🚀`;
      const desc = `${fromName}에서 ${toName}까지, 음악으로 이어지는 우주 여정`;
      const ogImage = `https://frompangyo.vercel.app/api/og/from/${artistId}`;

      return {
        title,
        description: desc,
        openGraph: {
          title,
          description: desc,
          type: "website",
          siteName: "K-Culture Universe",
          images: [{ url: ogImage, width: 1200, height: 630 }],
        },
        twitter: {
          card: "summary_large_image",
          title,
          description: desc,
        },
      };
    }
  }

  // ── 단일 아티스트: ?artist=A → "백아로부터" ──
  const josa = getJosa(fromName, "로부터", "으로부터");
  const title = `${fromName}${josa} 🚀`;
  const desc = `${fromName}의 음악 우주를 탐험하세요`;
  const ogImage = `https://frompangyo.vercel.app/api/og/from/${artistId}`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type: "website",
      siteName: "K-Culture Universe",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
    },
  };
}

// ── 페이지 렌더링 ───────────────────────────────────────────────
export default function UniversePage() {
  return <UniverseClient />;
}
