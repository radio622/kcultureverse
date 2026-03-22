"use client";

/**
 * K-Culture Universe V7.0.1 — 온보딩 / 토스트 / 세션 게이트
 * 전역 레이아웃에서 사용. 온보딩 미완료 시 OnboardingModal 자동 노출
 * 비회원 첫 방문 시 토스트 안내 띄우기
 */

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import OnboardingModal from "./OnboardingModal";

export default function SessionGate() {
  const { data: session, status, update } = useSession();
  const [showToast, setShowToast] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  // 비회원 첫 방문 토스트 (5초 후 사라짐)
  useEffect(() => {
    if (status === "unauthenticated") {
      const shown = sessionStorage.getItem("toast_shown");
      if (!shown) {
        const t = setTimeout(() => {
          setShowToast(true);
          sessionStorage.setItem("toast_shown", "1");
          setTimeout(() => setShowToast(false), 5000);
        }, 3000);
        return () => clearTimeout(t);
      }
    }
  }, [status]);

  const handleOnboardingComplete = async () => {
    setOnboardingDone(true);
    // JWT 세션 갱신하여 onboarded=true 반영
    await update();
  };

  // 온보딩 미완료 유저에게 모달 표시
  const showOnboarding =
    status === "authenticated" &&
    session?.user?.onboarded === false &&
    !onboardingDone;

  return (
    <>
      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}

      {/* 비회원 안내 토스트 */}
      {showToast && (
        <div
          style={{
            position: "fixed", bottom: 100, left: "50%",
            transform: "translateX(-50%)",
            zIndex: 300,
            background: "rgba(10,14,26,0.92)",
            border: "1px solid rgba(167,139,250,0.25)",
            borderRadius: 50,
            padding: "10px 20px",
            backdropFilter: "blur(16px)",
            display: "flex", alignItems: "center", gap: 8,
            animation: "toastIn 0.4s ease, toastOut 0.4s ease 4.6s forwards",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 16 }}>🚀</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
            가입하면 <strong style={{ color: "#c084fc" }}>자율주행</strong>과 아티스트 업데이트 요청이 가능해요!
          </span>
        </div>
      )}

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes toastOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
      `}</style>
    </>
  );
}
