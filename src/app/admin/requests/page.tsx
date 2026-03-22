"use client";
/**
 * /admin/requests — 📋 유저 요청 관리 탭
 * universe_edit_logs 전체 조회, 필터, 수동 승인·거절
 */
import { useState, useEffect, useCallback } from "react";

interface EditLog {
  id: number;
  user_id: string | null;
  intent: string;
  raw_input: string;
  parsed_data: unknown;
  status: "approved" | "pending" | "rejected";
  ai_reasoning: string | null;
  created_at: string;
  user_profiles?: { nickname: string | null; email: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  approved: "✅ 승인", pending: "⏳ 대기", rejected: "❌ 거절",
};
const STATUS_COLOR: Record<string, string> = {
  approved: "#4ade80", pending: "#fbbf24", rejected: "#f87171",
};

export default function RequestsTab() {
  const [logs, setLogs] = useState<EditLog[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const q = filter === "all" ? "" : `?status=${filter}`;
    const res = await fetch(`/api/admin/edit-logs${q}`);
    if (res.ok) setLogs(await res.json());
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleAction = useCallback(async (id: number, action: "approved" | "rejected") => {
    setActionLoading(id);
    await fetch(`/api/admin/edit-logs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action }),
    });
    setLogs(prev => prev.map(l => l.id === id ? { ...l, status: action } : l));
    setActionLoading(null);
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={s.pageTitle}>📋 유저 요청 관리</h1>
        <button onClick={fetchLogs} style={s.refreshBtn}>↻ 새로고침</button>
      </div>

      {/* 필터 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {(["all", "pending", "approved", "rejected"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            ...s.filterBtn,
            background: filter === f ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)",
            borderColor: filter === f ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.08)",
            color: filter === f ? "#c084fc" : "rgba(255,255,255,0.5)",
          }}>
            {f === "all" ? "전체" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "rgba(200,180,255,0.4)", fontSize: 13 }}>불러오는 중...</p>
      ) : logs.length === 0 ? (
        <div style={{ ...s.card, textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
          해당 조건의 요청이 없습니다
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {logs.map(log => (
            <div key={log.id} style={s.card}>
              {/* 헤더 */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[log.status] }}>
                  {STATUS_LABEL[log.status]}
                </span>
                <span style={{ fontSize: 11, color: "rgba(200,180,255,0.5)", background: "rgba(167,139,250,0.1)", padding: "2px 8px", borderRadius: 10 }}>
                  {log.intent}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
                  {new Date(log.created_at).toLocaleString("ko-KR")}
                </span>
              </div>

              {/* 입력 내용 */}
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>
                {log.raw_input}
              </p>

              {/* AI 판정 이유 (펼침) */}
              {log.ai_reasoning && (
                <button onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  style={{ fontSize: 11, color: "rgba(167,139,250,0.6)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 8 }}>
                  {expanded === log.id ? "▲ AI 판정 숨기기" : "▼ AI 판정 보기"}
                </button>
              )}
              {expanded === log.id && (
                <pre style={{ fontSize: 11, color: "rgba(200,180,255,0.6)", background: "rgba(0,0,0,0.3)", padding: 10, borderRadius: 8, whiteSpace: "pre-wrap", marginBottom: 8 }}>
                  {log.ai_reasoning}
                </pre>
              )}

              {/* 액션 버튼 */}
              {log.status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    id={`approve-${log.id}`}
                    onClick={() => handleAction(log.id, "approved")}
                    disabled={actionLoading === log.id}
                    style={{ ...s.actionBtn, background: "rgba(74,222,128,0.12)", color: "#4ade80", borderColor: "rgba(74,222,128,0.3)" }}>
                    ✅ 승인
                  </button>
                  <button
                    id={`reject-${log.id}`}
                    onClick={() => handleAction(log.id, "rejected")}
                    disabled={actionLoading === log.id}
                    style={{ ...s.actionBtn, background: "rgba(248,113,113,0.12)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}>
                    ❌ 거절
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  pageTitle: { margin: 0, fontSize: 22, fontWeight: 800, color: "#fff" },
  card: { background: "rgba(10,14,26,0.6)", border: "1px solid rgba(167,139,250,0.1)", borderRadius: 14, padding: "14px 16px" },
  filterBtn: { padding: "6px 14px", borderRadius: 20, fontSize: 12, border: "1px solid", cursor: "pointer", transition: "all 0.15s" },
  refreshBtn: { fontSize: 12, color: "rgba(167,139,250,0.7)", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" },
  actionBtn: { padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid", cursor: "pointer" },
};
