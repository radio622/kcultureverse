"use client";
/**
 * /admin/stats — 📊 우주 통계 탭
 */
import { useState, useEffect } from "react";

interface Stats {
  nodeCount: number;
  edgeCount: number;
  memberCount: number;
  fullMemberCount: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  lastBuiltAt: string | null;
}

export default function StatsTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const STAT_CARDS = stats ? [
    { label: "총 아티스트 (노드)", value: stats.nodeCount.toLocaleString(), icon: "⭐", color: "#c084fc" },
    { label: "총 연결선 (엣지)", value: stats.edgeCount.toLocaleString(), icon: "🔗", color: "#60a5fa" },
    { label: "총 회원", value: stats.memberCount.toLocaleString(), icon: "👥", color: "#34d399" },
    { label: "정회원 (뉴스레터)", value: stats.fullMemberCount.toLocaleString(), icon: "🌟", color: "#fbbf24" },
    { label: "대기 중 요청", value: stats.pendingRequests.toLocaleString(), icon: "⏳", color: "#f97316" },
    { label: "승인된 요청", value: stats.approvedRequests.toLocaleString(), icon: "✅", color: "#4ade80" },
  ] : [];

  return (
    <div>
      <h1 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 800, color: "#fff" }}>📊 우주 통계</h1>

      {loading ? (
        <p style={{ color: "rgba(200,180,255,0.4)", fontSize: 13 }}>통계 로딩 중...</p>
      ) : stats ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
            {STAT_CARDS.map(c => (
              <div key={c.label} style={{
                background: "rgba(10,14,26,0.7)", border: "1px solid rgba(167,139,250,0.1)",
                borderRadius: 14, padding: "18px 18px",
              }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: c.color, marginBottom: 4 }}>{c.value}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{c.label}</div>
              </div>
            ))}
          </div>

          {stats.lastBuiltAt && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
              마지막 빌드: {new Date(stats.lastBuiltAt).toLocaleString("ko-KR")}
            </div>
          )}
        </>
      ) : (
        <p style={{ color: "rgba(248,113,113,0.6)", fontSize: 13 }}>통계를 불러올 수 없습니다</p>
      )}
    </div>
  );
}
