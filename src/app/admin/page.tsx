"use client";

import { useState } from "react";

export default function AdminPage() {
  // ── 아티스트 추가 상태 ─────────────────────────────────────────
  const [formData, setFormData] = useState({ name: "", spotifyId: "", nameKo: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addLog, setAddLog] = useState("");

  // ── Universe Rebuild 상태 ──────────────────────────────────────
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [rebuildLog, setRebuildLog] = useState("");

  // ── 아티스트 추가 핸들러 ────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.spotifyId) return alert("필수값을 입력하세요");

    setAddLoading(true);
    setAddLog(`Adding ${formData.name}...\n`);

    try {
      const res = await fetch("/api/admin/add-artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      let newLog = `Adding ${formData.name}...\n`;
      if (data.log) newLog += `[STDOUT]\n${data.log}\n`;
      if (data.errorLog) newLog += `[STDERR]\n${data.errorLog}\n`;
      if (data.error) newLog += `[ERROR]\n${data.error}\n`;

      setAddLog(newLog + "\n[DONE]");
      if (data.success) setFormData({ name: "", spotifyId: "", nameKo: "" });
    } catch (err: any) {
      setAddLog((prev) => prev + `\n[NETWORK ERROR]\n${err.message}`);
    } finally {
      setAddLoading(false);
    }
  };

  // ── Universe Rebuild 핸들러 ─────────────────────────────────────
  const handleRebuild = async () => {
    const confirmed = window.confirm(
      "🌌 Universe Rebuild를 시작합니다.\n\n" +
      "이 작업은 graph.json을 재생성하고 Force-Directed 레이아웃을 재계산합니다.\n" +
      "완료까지 1~3분이 소요됩니다.\n\n" +
      "⚠️ 로컬(localhost)에서만 정상 동작합니다.\n\n" +
      "계속하시겠습니까?"
    );
    if (!confirmed) return;

    setRebuildLoading(true);
    setRebuildLog("🌌 Universe Rebuild 시작...\n\n");

    try {
      const res = await fetch("/api/admin/rebuild-universe", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setRebuildLog(
          "✅ Rebuild 완료!\n\n" +
          (data.log || "") +
          "\n\n--- 다음 단계 ---\n" +
          "git add -A && git commit -m '🌌 universe rebuild' && git push origin main\n" +
          "(Vercel이 자동으로 새 좌표로 배포합니다)"
        );
      } else {
        setRebuildLog(`❌ 실패:\n${data.error}\n\n${data.log || ""}`);
      }
    } catch (err: any) {
      setRebuildLog(`[NETWORK ERROR]\n${err.message}\n\n⚠️ localhost에서 실행 중인지 확인하세요.`);
    } finally {
      setRebuildLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0c10", color: "#e2e8f0", padding: "32px", fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, color: "#fff" }}>
          🌌 K-Culture Universe Admin
        </h1>
        <p style={{ color: "#64748b", marginBottom: 8 }}>
          아티스트 데이터 파이프라인 관리 도구
        </p>

        {/* ── 로컬 전용 경고 배너 ── */}
        <div style={{
          background: "rgba(234,179,8,0.1)",
          border: "1px solid rgba(234,179,8,0.3)",
          borderRadius: 10,
          padding: "10px 16px",
          marginBottom: 32,
          fontSize: 13,
          color: "#fcd34d",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span>⚠️</span>
          <span>
            <strong>로컬 전용 도구:</strong> 이 Admin 페이지는 <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 5px", borderRadius: 4 }}>npm run dev</code> 로 실행된 <strong>localhost:3000</strong> 에서만 완전히 동작합니다.
            Vercel 프러덕션에서는 Universe Rebuild가 비활성화됩니다.
          </span>
        </div>

        {/* ── 1열: 아티스트 추가 + 로그 ── */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: "#a78bfa" }}>
            ➕ 새 아티스트 추가
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* 폼 */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24 }}>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { label: "아티스트 영문 이름 *", key: "name", placeholder: "예: AKMU" },
                  { label: "아티스트 한글 이름 (선택)", key: "nameKo", placeholder: "예: 악동뮤지션" },
                  { label: "Spotify ID *", key: "spotifyId", placeholder: "예: 6s1pCNXcbdtQJlsnM1hRIA" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
                      {label}
                    </label>
                    <input
                      type="text"
                      required={label.includes("*")}
                      value={(formData as any)[key]}
                      onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                      placeholder={placeholder}
                      style={{
                        width: "100%",
                        background: "rgba(0,0,0,0.4)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        color: "#fff",
                        fontSize: 14,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                ))}

                <button
                  type="submit"
                  disabled={addLoading}
                  style={{
                    padding: "12px",
                    borderRadius: 10,
                    border: "none",
                    background: addLoading ? "rgba(255,255,255,0.1)" : "#7c3aed",
                    color: addLoading ? "#64748b" : "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: addLoading ? "not-allowed" : "pointer",
                    marginTop: 4,
                  }}
                >
                  {addLoading ? "Pre-bake 진행 중..." : "아티스트 추가 및 Pre-bake 실행"}
                </button>
              </form>

              <div style={{ marginTop: 16, padding: 14, background: "rgba(96,165,250,0.08)", borderRadius: 10, fontSize: 12, color: "#93c5fd", lineHeight: 1.6, border: "1px solid rgba(96,165,250,0.15)" }}>
                <strong style={{ display: "block", marginBottom: 4 }}>💡 Spotify ID 찾는 법:</strong>
                Spotify 앱에서 아티스트 우클릭 → "Share" → "Copy URI"<br />
                또는 웹 URL: <code>open.spotify.com/artist/<strong>ID부분</strong></code>
              </div>
            </div>

            {/* 아티스트 추가 로그 */}
            <div style={{ background: "#000", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, display: "flex", flexDirection: "column", minHeight: 300 }}>
              <div style={{ background: "rgba(255,255,255,0.04)", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {["#ef4444", "#eab308", "#22c55e"].map((c) => (
                    <div key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: "#475569" }}>add-artist log</span>
              </div>
              <div style={{ flex: 1, padding: 16, fontFamily: "monospace", fontSize: 12, color: "#4ade80", whiteSpace: "pre-wrap", overflowY: "auto" }}>
                {addLog || "대기 중..."}
              </div>
            </div>
          </div>
        </section>

        {/* ── 2열: Universe Rebuild ── */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: "#a78bfa" }}>
            🌌 Universe Rebuild
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
            아티스트를 추가하거나 데이터를 업데이트한 후 실행합니다.<br />
            크레딧 기반 관계 가중치를 재계산하고 Force-Directed 레이아웃으로 배치를 최적화합니다.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* 실행 패널 */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24 }}>
              <div style={{ marginBottom: 20, fontSize: 13, color: "#94a3b8", lineHeight: 1.8 }}>
                <strong style={{ color: "#e2e8f0", display: "block", marginBottom: 8 }}>파이프라인 순서:</strong>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { step: "1", label: "build-graph.ts", desc: "hub/*.json → 크레딧 가중치 edge → graph.json", time: "~5초" },
                    { step: "2", label: "compute-layout.ts", desc: "Torus Force-Directed 시뮬레이션 (300회 반복)", time: "~1분" },
                  ].map(({ step, label, desc, time }) => (
                    <div key={step} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 8, fontSize: 12 }}>
                      <span style={{ color: "#a78bfa", fontWeight: 700, minWidth: 20 }}>#{step}</span>
                      <div>
                        <code style={{ color: "#38bdf8" }}>{label}</code>
                        <span style={{ color: "#475569", margin: "0 6px" }}>—</span>
                        <span style={{ color: "#64748b" }}>{desc}</span>
                        <span style={{ color: "#a78bfa", marginLeft: 6, fontSize: 11 }}>({time})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleRebuild}
                disabled={rebuildLoading}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 10,
                  border: "none",
                  background: rebuildLoading
                    ? "rgba(255,255,255,0.06)"
                    : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  color: rebuildLoading ? "#475569" : "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: rebuildLoading ? "not-allowed" : "pointer",
                  letterSpacing: "0.02em",
                  transition: "opacity 0.2s",
                }}
              >
                {rebuildLoading ? "⏳ Rebuild 진행 중 (최대 3분)..." : "🚀 Universe Rebuild 실행"}
              </button>

              <div style={{ marginTop: 16, padding: 14, background: "rgba(234,179,8,0.06)", borderRadius: 10, fontSize: 12, color: "#fcd34d", lineHeight: 1.6, border: "1px solid rgba(234,179,8,0.15)" }}>
                <strong style={{ display: "block", marginBottom: 4 }}>⚠️ 주의사항:</strong>
                • Rebuild 후에는 반드시 git push를 해야 Vercel에 반영됩니다<br />
                • prebake.ts(아티스트 크레딧/발매일 수집)는 별도로 터미널에서 실행:<br />
                <code style={{ color: "#fb923c", fontSize: 11 }}>npm run prebake</code>
              </div>
            </div>

            {/* Rebuild 로그 */}
            <div style={{ background: "#000", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, display: "flex", flexDirection: "column", minHeight: 300 }}>
              <div style={{ background: "rgba(255,255,255,0.04)", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {["#ef4444", "#eab308", "#22c55e"].map((c) => (
                    <div key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: "#475569" }}>rebuild log</span>
              </div>
              <div style={{ flex: 1, padding: 16, fontFamily: "monospace", fontSize: 12, color: "#a78bfa", whiteSpace: "pre-wrap", overflowY: "auto" }}>
                {rebuildLog || "대기 중..."}
              </div>
            </div>
          </div>
        </section>

        {/* ── 3섹션: CLI 참조 가이드 ── */}
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: "#a78bfa" }}>
            💻 CLI 명령어 빠른 참조
          </h2>
          <div style={{ background: "#000", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
            {[
              {
                cmd: "npm run prebake",
                desc: "허브 아티스트 전체 Pre-bake (MusicBrainz 크레딧 + 발매일 연표 + iTunes 이미지). 기존 JSON 있으면 SKIP.",
                color: "#4ade80",
              },
              {
                cmd: "npm run build-graph",
                desc: "hub/*.json → 크레딧 기반 edge weight 계산 → graph.json 생성.",
                color: "#38bdf8",
              },
              {
                cmd: "npm run compute-layout",
                desc: "graph.json → Torus Force-Directed 시뮬레이션 → x,y 좌표 계산 → graph.json 업데이트.",
                color: "#f472b6",
              },
              {
                cmd: "npm run universe:rebuild",
                desc: "build-graph + compute-layout 순차 실행 (아티스트 관계도 전체 재배치). 아티스트 추가 후 실행.",
                color: "#a78bfa",
                highlight: true,
              },
              {
                cmd: 'npm run add-artist -- "이름" "SpotifyID" "한글이름"',
                desc: "단일 아티스트 추가 + Pre-bake. 완료 후 universe:rebuild 실행 필요.",
                color: "#fb923c",
              },
              {
                cmd: 'npx tsx scripts/ingest-playlist.ts "PLAYLIST_URL"',
                desc: "Spotify 플레이리스트 URL로 아티스트 일괄 수집 (iTunes 3초 딜레이 준수).",
                color: "#fbbf24",
              },
            ].map(({ cmd, desc, color, highlight }) => (
              <div key={cmd} style={{
                display: "flex",
                gap: 16,
                padding: "12px 16px",
                borderRadius: 10,
                marginBottom: 8,
                background: highlight ? "rgba(167,139,250,0.06)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${highlight ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)"}`,
              }}>
                <code style={{ color, fontFamily: "monospace", fontSize: 13, minWidth: 300, flexShrink: 0 }}>
                  {cmd}
                </code>
                <span style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>{desc}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
