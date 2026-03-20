/**
 * K-Culture Universe — 홈 진입점
 *
 * V5.3: /universe 우주페이지로 즉시 리다이렉트.
 * V4 CosmosClient 완전 제거.
 *
 * SEO: metadata 유지, permanent redirect (308)
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "K-Culture Universe — K-문화 아티스트 관계망 탐험",
  description: "K-culture 아티스트들의 관계망을 별자리처럼 탐험하는 인터랙티브 음악 지도. BTS, BLACKPINK, NewJeans 등 372명의 아티스트와 그들의 협업·피처링·작곡 관계를 우주에서 즐기세요.",
  openGraph: {
    title: "K-Culture Universe",
    description: "K-culture 아티스트들의 관계망을 별자리처럼 탐험하세요.",
  },
};

export default function HomePage() {
  // V5.3: 우주 페이지로 즉시 이동
  redirect("/universe");
}
