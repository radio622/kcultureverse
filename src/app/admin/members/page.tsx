"use client";
/**
 * /admin/members — 👥 회원 관리 탭
 */
import { useState, useEffect } from "react";

interface Member {
  id: string;
  email: string;
  nickname: string | null;
  role: string;
  membership: string;
  newsletter: boolean;
  created_at: string;
}

export default function MembersTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/members")
      .then(r => r.json())
      .then(data => { setMembers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = members.filter(m =>
    m.email.includes(search) || (m.nickname ?? "").includes(search)
  );

  return (
    <div>
      <h1 style={s.pageTitle}>👥 회원 관리</h1>
      <p style={s.pageDesc}>총 {members.length}명 가입</p>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="이메일 또는 닉네임 검색"
        style={{ ...s.input, marginBottom: 16 }}
      />

      {loading ? (
        <p style={{ color: "rgba(200,180,255,0.4)", fontSize: 13 }}>불러오는 중...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={s.table}>
            <thead>
              <tr>
                {["닉네임", "이메일", "등급", "뉴스레터", "역할", "가입일"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={s.td}>{m.nickname ?? <span style={{ color: "rgba(255,255,255,0.25)" }}>(미설정)</span>}</td>
                  <td style={{ ...s.td, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{m.email}</td>
                  <td style={s.td}>
                    <span style={{ fontSize: 11, color: m.membership === "full" ? "#c084fc" : "rgba(255,255,255,0.4)" }}>
                      {m.membership === "full" ? "🌟 정회원" : "🤝 준회원"}
                    </span>
                  </td>
                  <td style={{ ...s.td, textAlign: "center" as const }}>
                    {m.newsletter ? "✅" : "—"}
                  </td>
                  <td style={s.td}>
                    {m.role === "admin"
                      ? <span style={{ color: "#fbbf24", fontSize: 11 }}>👑 Admin</span>
                      : <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>일반</span>}
                  </td>
                  <td style={{ ...s.td, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                    {new Date(m.created_at).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const s = {
  pageTitle: { margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "#fff" },
  pageDesc: { margin: "0 0 20px", fontSize: 13, color: "rgba(255,255,255,0.35)" },
  input: {
    display: "block", width: "100%", maxWidth: 360, padding: "9px 14px",
    boxSizing: "border-box" as const,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.2)",
    borderRadius: 10, fontSize: 13, color: "#fff", outline: "none",
  },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { padding: "10px 14px", textAlign: "left" as const, fontSize: 11, color: "rgba(200,180,255,0.5)", fontWeight: 600, letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  td: { padding: "10px 14px", color: "rgba(255,255,255,0.75)" },
};
