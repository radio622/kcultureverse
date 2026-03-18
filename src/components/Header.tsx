"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, Globe, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/explore", label: "탐색하기" },
  { href: "/trending", label: "트렌딩" },
];

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled]     = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 스크롤 감지 — 헤더 배경 블러 처리
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 경로 이동 시 모바일 메뉴 자동 닫기
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // 모바일 메뉴 열릴 때 배경 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <header
      role="banner"
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 50,
        height: "var(--nav-height)",
        transition: "background 0.3s ease, border-color 0.3s ease",
        background: scrolled ? "rgba(10, 14, 26, 0.88)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
      }}
    >
      {/* 반응형 CSS (미디어 쿼리) */}
      <style>{`
        .header-desktop-nav { display: flex; }
        .header-mobile-btn  { display: none; }

        /* 태블릿 이하 (≤ 768px) */
        @media (max-width: 768px) {
          .header-desktop-nav { display: none !important; }
          .header-mobile-btn  { display: flex !important; }
        }
      `}</style>

      {/* 내부 컨테이너 */}
      <div className="container" style={{
        display: "flex",
        alignItems: "center",
        height: "100%",
        gap: 0,
      }}>

        {/* ── 로고 ──────────────────────────────────────── */}
        <Link
          href="/"
          aria-label="KCultureVerse 홈으로 이동"
          style={{ display: "flex", alignItems: "center", gap: "10px", flex: "0 0 auto" }}
        >
          <div aria-hidden="true" style={{
            width: 34, height: 34,
            borderRadius: "10px",
            background: "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "var(--glow-primary)",
          }}>
            <Globe size={18} color="white" />
          </div>
          <span style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.15rem",
            background: "linear-gradient(135deg, #e2e8f0 0%, var(--primary-light) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            KCultureVerse
          </span>
        </Link>

        {/* ── 데스크탑 네비 (≥ 769px 에서만 보임) ─────── */}
        <nav
          role="navigation"
          aria-label="주 메뉴"
          className="header-desktop-nav"
          style={{ alignItems: "center", gap: "4px", marginLeft: "40px", flex: 1 }}
        >
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link key={link.href} href={link.href}
                aria-current={active ? "page" : undefined}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--primary-light)" : "var(--text-secondary)",
                  background: active ? "rgba(124,58,237,0.12)" : "transparent",
                  transition: "all 0.2s ease",
                }}
              >
                {link.label}
              </Link>
            );
          })}
          <div style={{ flex: 1 }} />
        </nav>

        {/* ── 오른쪽 액션 영역 ──────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
          {/* 검색 아이콘 버튼 (항상 표시) */}
          <Link
            href="/explore"
            aria-label="검색 및 탐색"
            className="btn btn-ghost"
            style={{ padding: "10px", borderRadius: "10px" }}
          >
            <Search size={18} aria-hidden="true" />
          </Link>

          {/* 모바일 햄버거 버튼 (≤ 768px 에서만 보임) */}
          <button
            className="btn btn-ghost header-mobile-btn"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            style={{ padding: "10px", borderRadius: "10px" }}
          >
            {mobileOpen
              ? <X size={18} aria-hidden="true" />
              : <Menu size={18} aria-hidden="true" />
            }
          </button>
        </div>
      </div>

      {/* ── 모바일 풀스크린 드롭다운 ────────────────────── */}
      {mobileOpen && (
        <>
          {/* 반투명 오버레이 (터치로 닫기) */}
          <div
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              top: "var(--nav-height)",
              background: "rgba(0,0,0,0.5)",
              zIndex: -1,
            }}
          />

          {/* 메뉴 패널 */}
          <nav
            id="mobile-menu"
            role="navigation"
            aria-label="모바일 메뉴"
            className="animate-fade-in"
            style={{
              position: "absolute",
              top: "var(--nav-height)",
              left: 0, right: 0,
              background: "rgba(10, 14, 26, 0.98)",
              backdropFilter: "blur(20px)",
              borderBottom: "1px solid var(--border)",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  color: pathname === link.href ? "var(--primary-light)" : "var(--text-primary)",
                  background: pathname === link.href ? "rgba(124,58,237,0.12)" : "transparent",
                  fontSize: "1.05rem",
                  fontWeight: pathname === link.href ? 600 : 400,
                  minHeight: "44px", /* 모바일 터치 타겟 최소 44px */
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {link.label}
              </Link>
            ))}

            <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />

            {/* 모바일에서도 검색 접근 */}
            <Link
              href="/explore"
              onClick={() => setMobileOpen(false)}
              style={{
                padding: "16px",
                borderRadius: "12px",
                color: "var(--text-primary)",
                fontSize: "1.05rem",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                minHeight: "44px",
              }}
            >
              <Search size={18} aria-hidden="true" color="var(--text-muted)" />
              탐색 / 검색
            </Link>
          </nav>
        </>
      )}
    </header>
  );
}
