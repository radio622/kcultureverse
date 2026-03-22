"use client";
/**
 * /admin/quick — ⚡ 빠른 수정 탭
 * GPT-4o-mini 직통 입력 → 사실검증 없이 즉시 data_overrides에 등록
 */
import { useState, useCallback } from "react";

export default function QuickEditTab() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string; data?: Record<string, unknown> } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/quick-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      setResult({ ok: res.ok, message: data.message ?? (res.ok ? "완료" : "실패"), data });
    } catch {
      setResult({ ok: false, message: "네트워크 오류" });
    } finally {
      setLoading(false);
    }
  }, [input]);

  return (
    <div>
      <h1 style={s.pageTitle}>⚡ 빠른 수정</h1>
      <p style={s.pageDesc}>
        자연어로 데이터 수정을 요청합니다. AI가 파싱하여 <strong style={{ color: "#c084fc" }}>사실검증 없이 즉시</strong> 반영합니다.
      </p>

      <div style={s.card}>
        <label style={s.label}>수정 내용을 자연어로 입력하세요</label>
        <textarea
          id="quick-edit-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={"예시:\n• 아이유의 한글 이름을 '이지은'으로 수정해줘\n• BTS와 방탄소년단이 같은 아티스트야. 아이디는 3Nrfpe0tUk74Ig3gOBQUAY\n• SHINee와 태민은 SAME_GROUP 관계야 가중치 1.0으로"}
          rows={5}
          style={{ ...s.textarea, marginBottom: 12 }}
        />
        <button id="quick-edit-submit" onClick={handleSubmit} disabled={loading || !input.trim()} style={s.btnPrimary}>
          {loading ? "AI 처리 중..." : "⚡ 즉시 반영"}
        </button>
      </div>

      {result && (
        <div style={{
          ...s.card, marginTop: 16,
          borderColor: result.ok ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)",
          background: result.ok ? "rgba(74,222,128,0.04)" : "rgba(248,113,113,0.04)",
        }}>
          <div style={{ fontSize: 14, color: result.ok ? "#4ade80" : "#f87171", fontWeight: 600, marginBottom: 8 }}>
            {result.ok ? "✅ 완료" : "❌ 실패"}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", whiteSpace: "pre-wrap" }}>
            {result.message}
          </div>
          {result.data && (
            <pre style={{ fontSize: 11, color: "rgba(200,180,255,0.5)", marginTop: 8, whiteSpace: "pre-wrap", overflowX: "auto" }}>
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div style={{ ...s.card, marginTop: 16, background: "rgba(251,191,36,0.04)", borderColor: "rgba(251,191,36,0.2)" }}>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(251,191,36,0.8)", lineHeight: 1.7 }}>
          ⚠️ <strong>빠른 수정</strong>은 AI 파싱만 수행하며 외부 API 검증을 거치지 않습니다.<br />
          잘못 입력한 경우 <strong>롤백 탭</strong>에서 되돌릴 수 있습니다.
        </p>
      </div>
    </div>
  );
}

const s = {
  pageTitle: { margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "#fff" },
  pageDesc: { fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 24, margin: "0 0 24px" },
  card: {
    background: "rgba(10,14,26,0.6)", border: "1px solid rgba(167,139,250,0.12)",
    borderRadius: 16, padding: "20px 20px",
  },
  label: { display: "block", fontSize: 12, color: "rgba(200,180,255,0.6)", letterSpacing: "0.08em", marginBottom: 8 },
  textarea: {
    display: "block", width: "100%", boxSizing: "border-box" as const,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.2)",
    borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#fff",
    outline: "none", resize: "vertical" as const, lineHeight: 1.7,
    fontFamily: "'Inter', sans-serif",
  },
  btnPrimary: {
    padding: "10px 22px", borderRadius: 10, fontSize: 14, fontWeight: 700,
    background: "linear-gradient(135deg, #a78bfa, #c084fc)",
    border: "none", color: "#fff", cursor: "pointer",
  },
};
