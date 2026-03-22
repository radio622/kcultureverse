"use client";
/**
 * /admin/rollback — ⏪ 롤백 관리 탭
 * data_overrides 목록 조회 및 개별 되돌리기
 */
import { useState, useEffect, useCallback } from "react";

interface Override {
  id: number;
  target_type: string;
  target_id: string | null;
  patch_data: unknown;
  applied: boolean;
  created_at: string;
  edit_log_id: number | null;
}

export default function RollbackTab() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollbackLoading, setRollbackLoading] = useState<number | null>(null);

  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/overrides");
    if (res.ok) setOverrides(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchOverrides(); }, [fetchOverrides]);

  const handleRollback = useCallback(async (id: number) => {
    if (!confirm("이 패치를 rollback하시겠습니까?")) return;
    setRollbackLoading(id);
    const res = await fetch(`/api/admin/overrides/${id}/rollback`, { method: "POST" });
    if (res.ok) setOverrides(prev => prev.filter(o => o.id !== id));
    setRollbackLoading(null);
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff" }}>⏪ 롤백 관리</h1>
        <button onClick={fetchOverrides} style={s.refreshBtn}>↻ 새로고침</button>
      </div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>
        승인된 데이터 패치 목록입니다. 잘못 반영된 항목을 개별적으로 되돌릴 수 있습니다.
      </p>

      {loading ? (
        <p style={{ color: "rgba(200,180,255,0.4)", fontSize: 13 }}>불러오는 중...</p>
      ) : overrides.length === 0 ? (
        <div style={{ ...s.card, textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)" }}>
          롤백 가능한 패치가 없습니다
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {overrides.map(o => (
            <div key={o.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#c084fc", background: "rgba(167,139,250,0.12)", padding: "2px 8px", borderRadius: 8 }}>
                    {o.target_type}
                  </span>
                  {o.target_id && (
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{o.target_id}</span>
                  )}
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>
                    {new Date(o.created_at).toLocaleString("ko-KR")}
                  </span>
                </div>
                <pre style={{ margin: 0, fontSize: 11, color: "rgba(200,180,255,0.6)", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(o.patch_data, null, 2).slice(0, 200)}
                  {JSON.stringify(o.patch_data).length > 200 ? "..." : ""}
                </pre>
              </div>
              <button
                id={`rollback-${o.id}`}
                onClick={() => handleRollback(o.id)}
                disabled={rollbackLoading === o.id}
                style={{
                  flexShrink: 0, padding: "7px 14px", fontSize: 12, fontWeight: 600,
                  background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)",
                  color: "#f87171", borderRadius: 8, cursor: "pointer",
                }}>
                {rollbackLoading === o.id ? "처리 중..." : "⏪ 롤백"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  card: { background: "rgba(10,14,26,0.6)", border: "1px solid rgba(167,139,250,0.1)", borderRadius: 14, padding: "14px 16px" },
  refreshBtn: { fontSize: 12, color: "rgba(167,139,250,0.7)", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" },
};
