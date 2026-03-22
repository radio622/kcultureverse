"use client";

/**
 * K-Culture Universe V7.0.1 — 온보딩 모달
 * 최초 로그인 후 닉네임/성별/연령대/뉴스레터 설정
 * onboarded=false인 유저에게 자동 노출
 */

import { useState, useCallback } from "react";

interface Props {
  onComplete: () => void;
}

const GENDER_OPTIONS = [
  { value: "undisclosed", label: "밝히지 않음" },
  { value: "female", label: "여성" },
  { value: "male", label: "남성" },
  { value: "other", label: "기타" },
] as const;

const AGE_OPTIONS = [
  { value: "10s", label: "10대" },
  { value: "20s", label: "20대" },
  { value: "30s", label: "30대" },
  { value: "40s", label: "40대" },
  { value: "50s+", label: "50대+" },
] as const;

export default function OnboardingModal({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<string>("undisclosed");
  const [ageGroup, setAgeGroup] = useState<string>("");
  const [newsletter, setNewsletter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!nickname.trim()) { setError("닉네임을 입력해주세요"); return; }
    if (!ageGroup) { setError("연령대를 선택해주세요"); return; }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), gender, ageGroup, newsletter }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "저장 실패"); return; }
      onComplete();
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [nickname, gender, ageGroup, newsletter, onComplete]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
    }}>
      <div style={{
        background: "rgba(10,14,26,0.97)",
        border: "1px solid rgba(167,139,250,0.3)",
        borderRadius: 20, padding: "36px 32px",
        width: "min(420px, 92vw)",
        boxShadow: "0 0 60px rgba(167,139,250,0.12)",
      }}>
        {/* 헤더 */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌌</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#fff" }}>
            우주 탐험가 등록
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
            나만의 별자리를 만들어보세요
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 닉네임 */}
          <div>
            <label style={{ fontSize: 12, color: "rgba(200,180,255,0.7)", letterSpacing: "0.08em" }}>
              닉네임 *
            </label>
            <input
              id="onboarding-nickname"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="우주에서 불릴 이름"
              maxLength={20}
              style={{
                display: "block", width: "100%", marginTop: 6,
                padding: "10px 14px", boxSizing: "border-box",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(167,139,250,0.2)",
                borderRadius: 10, fontSize: 15, color: "#fff",
                outline: "none",
              }}
            />
          </div>

          {/* 성별 */}
          <div>
            <label style={{ fontSize: 12, color: "rgba(200,180,255,0.7)", letterSpacing: "0.08em" }}>
              성별
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {GENDER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGender(opt.value)}
                  style={{
                    padding: "7px 14px", borderRadius: 20, fontSize: 13,
                    cursor: "pointer", transition: "all 0.15s",
                    background: gender === opt.value ? "rgba(167,139,250,0.25)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${gender === opt.value ? "rgba(167,139,250,0.6)" : "rgba(255,255,255,0.1)"}`,
                    color: gender === opt.value ? "#c084fc" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 연령대 */}
          <div>
            <label style={{ fontSize: 12, color: "rgba(200,180,255,0.7)", letterSpacing: "0.08em" }}>
              연령대 *
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {AGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAgeGroup(opt.value)}
                  style={{
                    padding: "7px 14px", borderRadius: 20, fontSize: 13,
                    cursor: "pointer", transition: "all 0.15s",
                    background: ageGroup === opt.value ? "rgba(167,139,250,0.25)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${ageGroup === opt.value ? "rgba(167,139,250,0.6)" : "rgba(255,255,255,0.1)"}`,
                    color: ageGroup === opt.value ? "#c084fc" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 뉴스레터 */}
          <div
            onClick={() => setNewsletter(v => !v)}
            style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "14px 16px", borderRadius: 12, cursor: "pointer",
              background: newsletter ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${newsletter ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.08)"}`,
              transition: "all 0.2s",
            }}
          >
            {/* 체크박스 */}
            <div style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
              background: newsletter ? "#c084fc" : "rgba(255,255,255,0.08)",
              border: `2px solid ${newsletter ? "#c084fc" : "rgba(255,255,255,0.2)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>
              {newsletter && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <div>
              <div style={{ fontSize: 14, color: "#fff", fontWeight: 500 }}>
                📧 우주 소식 뉴스레터 수신 동의
              </div>
              <div style={{ fontSize: 12, color: "rgba(167,139,250,0.8)", marginTop: 3 }}>
                ✨ 동의하면 <strong>정회원</strong>으로 승급됩니다 — 직접 아티스트 정보를 업데이트할 수 있어요!
              </div>
            </div>
          </div>

          {/* 에러 */}
          {error && (
            <p style={{ margin: 0, fontSize: 12, color: "#f87171", textAlign: "center" }}>
              ⚠️ {error}
            </p>
          )}

          {/* 제출 버튼 */}
          <button
            id="onboarding-submit"
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%", padding: "13px",
              background: loading ? "rgba(167,139,250,0.3)" : "linear-gradient(135deg, #a78bfa, #c084fc)",
              border: "none", borderRadius: 12, cursor: loading ? "not-allowed" : "pointer",
              fontSize: 15, fontWeight: 700, color: "#fff",
              transition: "all 0.2s",
              boxShadow: loading ? "none" : "0 4px 20px rgba(167,139,250,0.35)",
            }}
          >
            {loading ? "저장 중..." : "우주 탐험 시작하기 🚀"}
          </button>

          {/* 개인정보 안내 */}
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
            입력 정보는 K-Culture Universe 이용 통계 목적으로만 사용됩니다.{" "}
            <a href="/privacy" style={{ color: "rgba(167,139,250,0.6)", textDecoration: "underline" }}>
              개인정보 처리방침
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
