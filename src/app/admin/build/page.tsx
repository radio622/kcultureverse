"use client";
/**
 * /admin/build — 🔄 빌드 제어 탭
 * 기존 admin/page.tsx의 아티스트 추가 + Rebuild 기능을 통합
 */
import { useState } from "react";

export default function BuildTab() {
  const [formData, setFormData] = useState({ name: "", spotifyId: "", nameKo: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addLog, setAddLog] = useState("");
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [rebuildLog, setRebuildLog] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.spotifyId) return;
    setAddLoading(true);
    setAddLog(`Adding ${formData.name}...\n`);
    const res = await fetch("/api/admin/add-artist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    setAddLog([`Adding ${formData.name}...`, data.log, data.errorLog, data.error, "[DONE]"].filter(Boolean).join("\n\n"));
    if (data.success) setFormData({ name: "", spotifyId: "", nameKo: "" });
    setAddLoading(false);
  };

  const handleRebuild = async () => {
    if (!confirm("Universe Rebuild를 시작합니다. 1~3분 소요됩니다. 계속하시겠습니까?")) return;
    setRebuildLoading(true);
    setRebuildLog("🌌 Universe Rebuild 시작...\n");
    const res = await fetch("/api/admin/rebuild-universe", { method: "POST" });
    const data = await res.json();
    setRebuildLog(data.success
      ? `✅ 완료!\n\n${data.log ?? ""}\n\n→ 이제 git push origin main 으로 배포하세요.`
      : `❌ 실패:\n${data.error}\n\n${data.log ?? ""}`);
    setRebuildLoading(false);
  };

  return (
    <div>
      <h1 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 800, color: "#fff" }}>🔄 빌드 제어</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* 아티스트 추가 폼 */}
        <div style={s.card}>
          <h2 style={s.sectionTitle}>➕ 아티스트 추가</h2>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "영문 이름 *", key: "name", placeholder: "AKMU" },
              { label: "한글 이름", key: "nameKo", placeholder: "악동뮤지션" },
              { label: "Spotify ID *", key: "spotifyId", placeholder: "6s1pCNXcbdtQJlsnM1hRIA" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label style={s.label}>{label}</label>
                <input
                  value={(formData as Record<string, string>)[key]}
                  onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                  placeholder={placeholder}
                  style={s.input}
                />
              </div>
            ))}
            <button type="submit" disabled={addLoading} style={s.btnPrimary}>
              {addLoading ? "추가 중..." : "아티스트 추가 실행"}
            </button>
          </form>
        </div>

        {/* 추가 로그 */}
        <div style={s.terminal}>
          <div style={s.terminalHeader}>add-artist log</div>
          <pre style={s.terminalBody}>{addLog || "대기 중..."}</pre>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Rebuild 버튼 */}
        <div style={s.card}>
          <h2 style={s.sectionTitle}>🌌 Universe Rebuild</h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 16, lineHeight: 1.7 }}>
            아티스트 추가 또는 데이터 수정 후 실행합니다.<br />
            크레딧 가중치 재계산 + 레이아웃 좌표 재생성.
          </p>
          <button onClick={handleRebuild} disabled={rebuildLoading} style={{ ...s.btnPrimary, width: "100%" }}>
            {rebuildLoading ? "⏳ Rebuild 진행 중..." : "🚀 Rebuild 실행"}
          </button>
        </div>

        {/* Rebuild 로그 */}
        <div style={s.terminal}>
          <div style={s.terminalHeader}>rebuild log</div>
          <pre style={{ ...s.terminalBody, color: "#a78bfa" }}>{rebuildLog || "대기 중..."}</pre>
        </div>
      </div>
    </div>
  );
}

const s = {
  card: { background: "rgba(10,14,26,0.6)", border: "1px solid rgba(167,139,250,0.12)", borderRadius: 14, padding: "18px 18px" },
  sectionTitle: { margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "#c084fc" },
  label: { display: "block", fontSize: 12, color: "rgba(200,180,255,0.6)", marginBottom: 5 },
  input: {
    display: "block", width: "100%", boxSizing: "border-box" as const,
    padding: "9px 12px", background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8,
    fontSize: 13, color: "#fff", outline: "none",
  },
  btnPrimary: {
    padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700,
    background: "linear-gradient(135deg, #a78bfa, #c084fc)",
    border: "none", color: "#fff", cursor: "pointer",
  },
  terminal: {
    background: "#000", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14, display: "flex", flexDirection: "column" as const, minHeight: 240,
  },
  terminalHeader: {
    background: "rgba(255,255,255,0.04)", padding: "8px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    fontSize: 11, fontFamily: "monospace", color: "#475569",
  },
  terminalBody: {
    flex: 1, padding: "12px 14px", fontFamily: "monospace",
    fontSize: 11, color: "#4ade80", whiteSpace: "pre-wrap" as const, overflowY: "auto" as const, margin: 0,
  },
};
