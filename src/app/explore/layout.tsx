import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "탐색하기",
  description: "K-Culture 배우, 가수, 영화, 드라마를 검색하고 연결 관계를 탐험하세요.",
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
