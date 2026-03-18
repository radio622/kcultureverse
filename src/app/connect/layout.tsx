import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "연결 탐색기",
  description: "두 K-Culture 스타 사이의 숨겨진 연결 고리를 찾아보세요. 케빈 베이컨의 6단계 법칙.",
};

export default function ConnectLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
