"use client";

/**
 * Admin Shell — 암호 게이트 + 탭 네비게이션
 * 탭 세션은 sessionStorage에 저장 (탭 닫으면 만료)
 */

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { id: "quick",   icon: "⚡", label: "빠른 수정",   href: "/admin/quick" },
  { id: "requests",icon: "📋", label: "유저 요청",    href: "/admin/requests" },
  { id: "members", icon: "👥", label: "회원 관리",    href: "/admin/members" },
  { id: "stats",   icon: "📊", label: "우주 통계",    href: "/admin/stats" },
  { id: "build",   icon: "🔄", label: "빌드 제어",    href: "/admin/build" },
  { id: "calendar",icon: "📅", label: "발매 캘린더",  href: "/admin/calendar" },
  { id: "rollback",icon: "⏪", label: "롤백",         href: "/admin/rollback" },
] as const;

const PASSPHRASE = process.env.NEXT_PUBLIC_ADMIN_HINT ?? ""; // 힌트 없음 — .env에서 직접 검증
const SESSION_KEY = "admin_unlocked";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  // 세션스토리지에 잠금 해제 여부 캐싱 (탭 닫으면 만료)
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") setUnlocked(true);
  }, []);

  const handleUnlock = useCallback(async () => {
    setChecking(true);
    const res = await fetch("/api/admin/verify-passphrase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: input }),
    });
    if (res.ok) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
    } else {
      setError("암호가 틀렸습니다");
    }
    setChecking(false);
  }, [input]);

  if (!unlocked) {
    return (
      <div style={s.gate}>
        <div style={s.gateBox}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
          <h2 style={{ margin: "0 0 6px", color: "#fff", fontSize: 18 }}>Admin 대시보드</h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            관리자 전용 공간입니다. 암호를 입력해주세요.
          </p>
          <input
            id="admin-passphrase-input"
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleUnlock()}
            placeholder="Admin 암호"
            style={s.input}
            autoFocus
          />
          {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{error}</p>}
          <button
            id="admin-unlock-btn"
            onClick={handleUnlock}
            disabled={checking || !input}
            style={s.btn}
          >
            {checking ? "확인 중..." : "잠금 해제"}
          </button>
        </div>
      </div>
    );
  }

  const activeTab = TABS.find(t => pathname.startsWith(t.href))?.id ?? "quick";

  return (
    <div style={s.shell}>
      {/* 사이드바 */}
      <aside style={s.sidebar}>
        <div style={s.logo}>⚙️ Admin</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              id={`admin-tab-${tab.id}`}
              onClick={() => router.push(tab.href)}
              style={{
                ...s.tabBtn,
                background: activeTab === tab.id
                  ? "rgba(167,139,250,0.18)"
                  : "transparent",
                color: activeTab === tab.id
                  ? "#c084fc"
                  : "rgba(255,255,255,0.55)",
                borderLeft: activeTab === tab.id
                  ? "2px solid #c084fc"
                  : "2px solid transparent",
              }}
            >
              <span style={{ fontSize: 16 }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <button
            onClick={() => { sessionStorage.removeItem(SESSION_KEY); setUnlocked(false); setInput(""); }}
            style={{ ...s.tabBtn, color: "rgba(248,113,113,0.6)", fontSize: 12 }}
          >
            🔒 잠금
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main style={s.main}>
        {children}
      </main>
    </div>
  );
}

const s = {
  gate: {
    minHeight: "100vh", background: "#05050f",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  gateBox: {
    background: "rgba(10,14,26,0.95)",
    border: "1px solid rgba(167,139,250,0.2)",
    borderRadius: 20, padding: "40px 36px",
    width: "min(380px,92vw)", textAlign: "center" as const,
    fontFamily: "'Inter', sans-serif",
  },
  input: {
    display: "block", width: "100%", padding: "11px 14px",
    boxSizing: "border-box" as const,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(167,139,250,0.25)",
    borderRadius: 10, fontSize: 15, color: "#fff", outline: "none",
  },
  btn: {
    marginTop: 14, width: "100%", padding: "12px",
    background: "linear-gradient(135deg, #a78bfa, #c084fc)",
    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
    color: "#fff", cursor: "pointer",
  },
  shell: {
    display: "flex", minHeight: "100vh",
    background: "#05050f",
    fontFamily: "'Inter', 'Apple SD Gothic Neo', sans-serif",
  },
  sidebar: {
    width: 200, flexShrink: 0,
    background: "rgba(7,9,18,0.98)",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    padding: "28px 12px 20px",
    display: "flex", flexDirection: "column" as const,
    position: "sticky" as const, top: 0, height: "100vh",
  },
  logo: {
    fontSize: 14, fontWeight: 700, color: "rgba(200,180,255,0.8)",
    marginBottom: 24, paddingLeft: 10,
  },
  tabBtn: {
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", padding: "9px 14px",
    background: "transparent", border: "none",
    borderRadius: 8, fontSize: 13, cursor: "pointer",
    textAlign: "left" as const, transition: "all 0.15s",
  },
  main: {
    flex: 1, padding: "32px 28px",
    overflowY: "auto" as const, maxHeight: "100vh",
  },
};
