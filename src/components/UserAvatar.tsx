"use client";

/**
 * K-Culture Universe V7.0.1 — 유저 아바타 버튼 (우측 상단)
 * 로그인/비로그인 상태를 표시하는 미니멀한 UI
 * 클릭 시 드롭다운 (마이페이지/에디트/자율주행/로그아웃)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

interface Props {
  position?: "fixed" | "absolute" | "relative";
}

export default function UserAvatar({ position = "fixed" }: Props) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignIn = useCallback(() => {
    signIn("google");
  }, []);

  const handleSignOut = useCallback(() => {
    setOpen(false);
    signOut({ callbackUrl: "/" });
  }, []);

  const user = session?.user;
  const isAdmin = user?.role === "admin";
  const isFull = user?.membership === "full";

  return (
    <div
      ref={dropdownRef}
      style={position === "relative"
        ? { position: "relative" }  // 부모 flex 컨테이너가 위치를 담당
        : { position, top: 16, right: 66, zIndex: 200 }
      }
    >
      {/* 아바타 버튼 */}
      <button
        id="user-avatar-btn"
        aria-label={status === "authenticated" ? "내 계정" : "로그인"}
        onClick={() => status === "authenticated" ? setOpen(v => !v) : handleSignIn()}
        title={status === "authenticated" ? (user?.name ?? "내 계정") : "구글로 로그인"}
        style={{
          width: 38, height: 38, borderRadius: "50%",
          border: `2px solid ${isFull ? "rgba(167,139,250,0.6)" : "rgba(255,255,255,0.15)"}`,
          background: open ? "rgba(167,139,250,0.2)" : "rgba(10,14,26,0.7)",
          backdropFilter: "blur(12px)",
          cursor: "pointer",
          overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
          padding: 0,
          boxShadow: isFull ? "0 0 12px rgba(167,139,250,0.25)" : "none",
        }}
      >
        {status === "loading" ? (
          <div style={{
            width: 16, height: 16, border: "2px solid rgba(167,139,250,0.4)",
            borderTop: "2px solid #c084fc", borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
        ) : user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt={user.name ?? "프로필"} width={38} height={38}
            style={{ objectFit: "cover" }} />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="rgba(200,180,255,0.7)" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-8 8-8s8 4 8 8" />
          </svg>
        )}
      </button>

      {/* 드롭다운 */}
      {open && status === "authenticated" && (
        <div style={{
          position: "absolute", top: 46, right: 0,
          width: 200,
          background: "rgba(7,9,18,0.96)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(167,139,250,0.2)", borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          animation: "dropdownFadeIn 0.15s ease",
        }}>
          {/* 유저 정보 헤더 */}
          <div style={{
            padding: "12px 16px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", 
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.name ?? "탐험가"}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
              {isFull ? "🌟 정회원" : "🤝 준회원"}
              {isAdmin && " · 👑 Admin"}
            </div>
          </div>

          {/* 메뉴 아이템 */}
          {[
            { id: "menu-mypage", icon: "👤", label: "마이페이지", href: "/mypage" },
            { id: "menu-edit", icon: "✏️", label: "에디트 제안", href: "#edit-suggest", highlight: !isFull },
            { id: "menu-autopilot", icon: "🚀", label: "자율주행", href: "#autopilot" },
            ...(isAdmin ? [{ id: "menu-admin", icon: "⚙️", label: "관리자 대시보드", href: "/admin" }] : []),
          ].map(item => (
            <a
              key={item.id}
              id={item.id}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px", fontSize: 13,
                color: item.highlight ? "rgba(167,139,250,0.6)" : "rgba(255,255,255,0.75)",
                textDecoration: "none", transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.highlight && (
                <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(167,139,250,0.5)" }}>
                  정회원 전용
                </span>
              )}
            </a>
          ))}

          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 16px" }} />

          {/* 로그아웃 */}
          <button
            id="menu-signout"
            onClick={handleSignOut}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "10px 16px", fontSize: 13,
              color: "rgba(248,113,113,0.7)", background: "none",
              border: "none", cursor: "pointer", textAlign: "left",
              transition: "background 0.1s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.06)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span>🚪</span>
            <span>로그아웃</span>
          </button>
        </div>
      )}

      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
