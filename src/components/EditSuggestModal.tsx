"use client";

/**
 * 에디트 제안 모달 — 정회원 전용
 * 자연어로 아티스트 정보/관계 수정 제안 → POST /api/universe/suggest
 */
import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** 현재 포커스된 아티스트 이름 (프리필용) */
  artistName?: string;
}

const PLACEHOLDER_EXAMPLES = [
  "아이유가 유희열의 스케치북에서 혁오의 '위잉위잉'을 풀 커버했어요",
  "BTS RM이 아이유의 곡 '에잇'에 피처링으로 참여했습니다",
  "NewJeans와 르세라핌은 같은 하이브 레이블 소속이에요",
  "태연의 영문 이름이 TAEYEON인데 TAYEON으로 잘못 표기되어 있어요",
  "지코가 '아무노래'를 프로듀싱한 프로듀서 팝타임은 우주에 없어요",
];

export default function EditSuggestModal({ isOpen, onClose, artistName }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status: string; emoji: string; message: string;
    summary: string; reasoning: string;
  } | null>(null);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [placeholder] = useState(
    () => PLACEHOLDER_EXAMPLES[Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.length)]
  );

  // 모달 열릴 때 포커스 + 아티스트 프리필
  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setError("");
      if (artistName && !input) {
        setInput(`${artistName}의 `);
      }
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, artistName]);

  // ESC 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError("");

    try {
      const res = await fetch("/api/universe/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "요청 실패");
      } else {
        setResult(data);
        if (data.status === "approved" || data.status === "pending") {
          setInput(""); // 성공 시 입력 초기화
        }
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  if (!isOpen) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 500,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* 모달 */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 501, width: "92vw", maxWidth: 420,
        background: "rgba(10,14,26,0.97)",
        border: "1px solid rgba(167,139,250,0.25)",
        borderRadius: 20, padding: "24px 20px",
        boxShadow: "0 16px 64px rgba(0,0,0,0.6)",
        animation: "edgePopIn 0.2s ease",
      }}>
        {/* 헤더 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>
            ✏️ 우주 에디트 제안
          </h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.3)",
            fontSize: 18, cursor: "pointer", padding: "4px 8px", lineHeight: 1,
          }}>×</button>
        </div>

        {/* 안내 */}
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, marginBottom: 14 }}>
          아티스트 정보 수정, 관계 추가, 신규 아티스트 제안을 자유롭게 입력하세요.
          AI가 검증 후 자동으로 처리합니다.
        </p>

        {/* 입력 */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          maxLength={500}
          rows={4}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "12px 14px", borderRadius: 12,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(167,139,250,0.2)",
            color: "#fff", fontSize: 14, resize: "vertical",
            lineHeight: 1.6, outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "rgba(167,139,250,0.5)")}
          onBlur={e => (e.currentTarget.style.borderColor = "rgba(167,139,250,0.2)")}
        />

        {/* 글자 수 */}
        <div style={{
          textAlign: "right", fontSize: 11,
          color: input.length > 450 ? "#fb923c" : "rgba(255,255,255,0.2)",
          marginTop: 4, marginBottom: 12,
        }}>
          {input.length}/500
        </div>

        {/* 제출 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || loading}
          style={{
            width: "100%", padding: "12px", borderRadius: 12,
            border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer",
            background: loading
              ? "rgba(167,139,250,0.15)"
              : input.trim()
                ? "linear-gradient(135deg, #a78bfa, #c084fc)"
                : "rgba(255,255,255,0.06)",
            color: input.trim() ? "#fff" : "rgba(255,255,255,0.25)",
            transition: "all 0.2s",
          }}
        >
          {loading ? "🔍 AI 검증 중..." : "⌘/Ctrl+Enter로 제출"}
        </button>

        {/* 에러 */}
        {error && (
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
            fontSize: 13, color: "#fca5a5", lineHeight: 1.5,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* 결과 */}
        {result && (
          <div style={{
            marginTop: 12, padding: "12px 14px", borderRadius: 12,
            background: result.status === "approved"
              ? "rgba(52,211,153,0.08)"
              : result.status === "pending"
                ? "rgba(251,191,36,0.08)"
                : "rgba(239,68,68,0.08)",
            border: `1px solid ${
              result.status === "approved" ? "rgba(52,211,153,0.25)"
              : result.status === "pending" ? "rgba(251,191,36,0.25)"
              : "rgba(239,68,68,0.25)"
            }`,
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 6 }}>
              {result.emoji} {result.message}
            </p>
            {result.summary && (
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                📝 {result.summary}
              </p>
            )}
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
              {result.reasoning}
            </p>
          </div>
        )}

        {/* 도움말 */}
        <p style={{
          marginTop: 12, fontSize: 11,
          color: "rgba(255,255,255,0.18)", textAlign: "center", lineHeight: 1.6,
        }}>
          정회원만 이용 가능 • 1분에 1회 제한 • AI가 자동 사실 검증
        </p>
      </div>
    </>
  );
}
