"use client";

import { useRouter } from "next/navigation";

interface Props {
  /** 히스토리가 없을 때 대체 경로 (기본: "/") */
  fallbackHref?: string;
}

/**
 * 뒤로가기 버튼
 * - 히스토리가 있으면 router.back()
 * - 없으면 fallbackHref로 이동 (외부 링크로 직접 방문한 경우)
 */
export default function BackButton({ fallbackHref = "/" }: Props) {
  const router = useRouter();

  const handleBack = () => {
    // window.history.length <= 2 이면 히스토리 없음 (직접 방문)
    if (typeof window !== "undefined" && window.history.length <= 2) {
      router.push(fallbackHref);
    } else {
      router.back();
    }
  };

  return (
    <button
      className="back-btn"
      onClick={handleBack}
      aria-label="이전 우주로 돌아가기"
    >
      {/* 화살표 SVG */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span>이전</span>
    </button>
  );
}
