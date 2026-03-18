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
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 스크롤 시 헤더 배경 블러 처리
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      role="banner"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: "var(--nav-height)",
        transition: "background 0.3s ease, backdrop-filter 0.3s ease, border-color 0.3s ease",
        background: scrolled
          ? "rgba(10, 14, 26, 0.85)"
          : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled
          ? "1px solid var(--border)"
          : "1px solid transparent",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          gap: 0,
        }}
      >
        {/* 로고 */}
        <Link
          href="/"
          aria-label="KCultureVerse 홈으로 이동"
          style={{ display: "flex", alignItems: "center", gap: "10px", flex: "0 0 auto" }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 34,
              height: 34,
              borderRadius: "10px",
              background: "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--glow-primary)",
            }}
          >
            <Globe size={18} color="white" />
          </div>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1.15rem",
              background: "linear-gradient(135deg, #e2e8f0 0%, var(--primary-light) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            KCultureVerse
          </span>
        </Link>

        {/* 데스크탑 내비게이션 */}
        <nav
          role="navigation"
          aria-label="주 메뉴"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            marginLeft: "40px",
            flex: 1,
          }}
        >
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--primary-light)" : "var(--text-secondary)",
                  background: active ? "rgba(124, 58, 237, 0.12)" : "transparent",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.target as HTMLElement).style.color = "var(--text-primary)";
                    (e.target as HTMLElement).style.background = "var(--bg-glass)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.target as HTMLElement).style.color = "var(--text-secondary)";
                    (e.target as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* 오른쪽 액션 영역 */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* 검색 버튼 */}
          <Link
            href="/explore"
            aria-label="검색 및 탐색"
            className="btn btn-ghost"
            style={{ padding: "10px", borderRadius: "10px" }}
          >
            <Search size={18} aria-hidden="true" />
          </Link>

          {/* 모바일 메뉴 버튼 */}
          <button
            className="btn btn-ghost"
            style={{ padding: "10px", borderRadius: "10px", display: "flex" }}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            {mobileOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      {mobileOpen && (
        <nav
          id="mobile-menu"
          role="navigation"
          aria-label="모바일 메뉴"
          style={{
            position: "absolute",
            top: "var(--nav-height)",
            left: 0,
            right: 0,
            background: "rgba(10, 14, 26, 0.95)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid var(--border)",
            padding: "12px 16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
          className="animate-fade-in"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              style={{
                padding: "12px 16px",
                borderRadius: "10px",
                color: pathname === link.href ? "var(--primary-light)" : "var(--text-primary)",
                background: pathname === link.href ? "rgba(124, 58, 237, 0.12)" : "transparent",
                fontSize: "1rem",
                fontWeight: pathname === link.href ? 600 : 400,
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
