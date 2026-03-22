"use client";

import { useState, useEffect } from "react";

export default function CalendarPage() {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 수동 편집 폼 상태
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editIsKo, setEditIsKo] = useState<boolean | null>(null);
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  const daysInMonth = new Date(now.getFullYear(), currentMonth, 0).getDate();

  useEffect(() => {
    fetchAlbums(currentMonth, selectedDay);
  }, [currentMonth, selectedDay]);

  const fetchAlbums = async (month: number, day: number) => {
    setLoading(true);
    setEditingId(null);
    try {
      const res = await fetch(`/api/admin/albums?month=${month}&day=${day}`);
      const data = await res.json();
      setAlbums(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (album: any) => {
    setEditingId(album.id);
    setEditDate(album.release_date);
    setEditIsKo(album.is_korean_artist);
    setEditNote(album.verification_note || "");
  };

  const handleSave = async (id: number) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/albums", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          release_date: editDate,
          is_korean_artist: editIsKo,
          note: editNote,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchAlbums(currentMonth, selectedDay);
      } else {
        alert("저장에 실패했습니다.");
      }
    } catch (e) {
      alert("네트워크 에러 발생");
    } finally {
      setSaving(false);
    }
  };

  const renderCalendar = () => {
    // 1일부터 총 일수까지의 배열을 생성해 그리드로 뿌림
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 28 }}>
        {days.map(d => (
          <button
            key={d}
            onClick={() => setSelectedDay(d)}
            style={{
              padding: "16px 12px", borderRadius: 10,
              background: selectedDay === d ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.03)",
              border: selectedDay === d ? "1px solid #c084fc" : "1px solid transparent",
              color: selectedDay === d ? "#fff" : "rgba(255,255,255,0.6)",
              cursor: "pointer", transition: "all 0.15s",
              fontSize: 15, fontWeight: selectedDay === d ? 700 : 400
            }}
            onMouseEnter={e => {
              if (selectedDay !== d) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={e => {
              if (selectedDay !== d) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
            }}
          >
            {d}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#fff" }}>📅 발매 캘린더</h1>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button 
            onClick={() => {
              if (currentMonth === 1) setCurrentMonth(12);
              else setCurrentMonth(currentMonth - 1);
            }} 
            style={s.btn}
          >◀ 이전 달</button>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#c084fc", width: 44, textAlign: "center" }}>{currentMonth}월</span>
          <button 
            onClick={() => {
              if (currentMonth === 12) setCurrentMonth(1);
              else setCurrentMonth(currentMonth + 1);
            }} 
            style={s.btn}
          >다음 달 ▶</button>
        </div>
      </div>

      {renderCalendar()}

      <div style={{ background: "rgba(10,14,26,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 24 }}>
        <h2 style={{ fontSize: 16, color: "#fff", margin: "0 0 20px" }}>{currentMonth}월 {selectedDay}일 앨범 목록 <span style={{fontSize: 14, color:"rgba(255,255,255,0.4)"}}>({albums.length}건)</span></h2>
        
        {loading ? (
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>우주 기록을 불러오는 중...</p>
        ) : albums.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>해당 날짜에 발매된 앨범이 없습니다.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {albums.map(a => (
              <div key={a.id} style={{
                background: "rgba(255,255,255,0.03)", padding: 18, borderRadius: 12,
                borderLeft: a.verified ? "4px solid #10b981" : "4px solid #f59e0b"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 6 }}>
                      {a.artist_name} <span style={{fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.4)"}}>({a.album_title})</span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>DB 발매일: <strong style={{color: "#c084fc", background: "rgba(167,139,250,0.1)", padding: "2px 6px", borderRadius: 4}}>{a.release_date}</strong></span>
                      <span>|</span>
                      <span>상태: {a.verified ? <span style={{color:"#10b981", fontWeight: 600}}>✅ 검증됨</span> : <span style={{color:"#f59e0b"}}>⚠️ 미검증</span>}</span>
                      <span>|</span>
                      <span>Korean Artist 여부: {a.is_korean_artist === true ? "🇰🇷" : a.is_korean_artist === false ? "❌" : "➖"}</span>
                    </div>
                    {a.verification_note && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontStyle: "italic", background: "rgba(0,0,0,0.2)", padding: "8px 10px", borderRadius: 6 }}>
                        📝 {a.verification_note} {a.verification_source && `(출처: ${a.verification_source})`}
                      </div>
                    )}
                  </div>
                  
                  {editingId !== a.id && (
                    <button onClick={() => startEdit(a)} style={{ ...s.btn, background: "rgba(167,139,250,0.15)", color: "#c084fc", fontWeight: 600 }}>
                      수동 검증
                    </button>
                  )}
                </div>

                {/* 편집 폼 */}
                {editingId === a.id && (
                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px dashed rgba(255,255,255,0.1)", display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
                    <div>
                      <label style={s.label}>발매일 (YYYY-MM-DD)</label>
                      <input type="text" value={editDate} onChange={e => setEditDate(e.target.value)} style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>Korean Artist 여부</label>
                      <select value={editIsKo === null ? "" : editIsKo.toString()} onChange={e => setEditIsKo(e.target.value === "" ? null : e.target.value === "true")} style={s.input}>
                        <option value="">미정 (판정 보류)</option>
                        <option value="true">한국 아티스트 (O)</option>
                        <option value="false">해외 / 무관 (X)</option>
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <label style={s.label}>검증 메모 (수정사유)</label>
                      <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} style={s.input} placeholder="예: 리마스터 이전 원본 발매일 보정..." />
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => setEditingId(null)} style={{ ...s.btn, background: "rgba(255,255,255,0.1)" }}>취소</button>
                      <button onClick={() => handleSave(a.id)} disabled={saving} style={{ ...s.btn, background: "#c084fc", color: "#fff", fontWeight: 700 }}>
                        {saving ? "저장 중..." : "확인 및 저장"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const s: { [key: string]: React.CSSProperties } = {
  btn: {
    padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 8,
    color: "#e2e8f0", fontSize: 13, cursor: "pointer", transition: "all 0.15s"
  },
  label: { display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, fontWeight: 500 },
  input: {
    padding: "10px 12px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, color: "#fff", fontSize: 13, minWidth: 140, outline: "none", width: "100%", boxSizing: "border-box"
  }
};
