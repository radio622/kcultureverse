"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";

// ── 타이핑 애니메이션에 사용할 예시 검색어들 ──────────
const PLACEHOLDER_EXAMPLES = [
  "송강호",
  "BTS",
  "이준기",
  "블랙핑크",
  "기생충",
  "이병헌",
  "NewJeans",
  "오징어 게임",
];

export default function SearchHero() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  // ── 플레이스홀더 타이핑 애니메이션 ──────────────────
  useEffect(() => {
    const target = PLACEHOLDER_EXAMPLES[placeholderIdx];
    let charIdx = isTyping ? 0 : target.length;
    let timeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (isTyping) {
        if (charIdx <= target.length) {
          setDisplayedPlaceholder(target.slice(0, charIdx));
          charIdx++;
          timeout = setTimeout(tick, 100);
        } else {
          // 2초 대기 후 삭제 시작
          timeout = setTimeout(() => setIsTyping(false), 2000);
        }
      } else {
        if (charIdx >= 0) {
          setDisplayedPlaceholder(target.slice(0, charIdx));
          charIdx--;
          timeout = setTimeout(tick, 60);
        } else {
          // 다음 예시로 전환
          setPlaceholderIdx((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length);
          setIsTyping(true);
        }
      }
    };

    timeout = setTimeout(tick, 400);
    return () => clearTimeout(timeout);
  }, [placeholderIdx, isTyping]);

  // ── 검색 처리 ────────────────────────────────────────
  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) {
        inputRef.current?.focus();
        return;
      }
      setIsLoading(true);
      // 탐색 페이지로 이동 (검색어를 쿼리 파라미터로 전달)
      router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
    },
    [query, router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch(e as unknown as React.FormEvent);
  };

  return (
    <section
      aria-labelledby="hero-heading"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px 60px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 배경 장식 원형 글로우 */}
      <div aria-hidden="true" style={{
        position: "absolute",
        top: "30%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(600px, 100vw)",
        height: "min(600px, 100vw)",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div
        className="container"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* 부제목 배지 */}
        <div
          className="badge badge-actor animate-fade-in"
          style={{ marginBottom: "28px", fontSize: "0.8rem" }}
        >
          ✨ K-Culture Universe Map
        </div>

        {/* 메인 헤딩 */}
        <h1
          id="hero-heading"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: "20px",
            maxWidth: "820px",
          }}
          className="animate-fade-in"
        >
          K-Culture의{" "}
          <span className="gradient-text">모든 연결</span>을<br />
          3D 우주에서 탐험하다
        </h1>

        {/* 부제목 */}
        <p
          style={{
            fontSize: "clamp(1rem, 2vw, 1.2rem)",
            color: "var(--text-secondary)",
            maxWidth: "560px",
            marginBottom: "48px",
            lineHeight: 1.7,
          }}
          className="animate-fade-in"
        >
          배우, 가수, 감독이 영화와 드라마, 앨범을 통해
          어떻게 이어지는지 한눈에 확인하세요
        </p>

        {/* 검색창 */}
        <form
          role="search"
          aria-label="K-Culture 인물 및 작품 검색"
          onSubmit={handleSearch}
          style={{
            width: "100%",
            maxWidth: "640px",
            position: "relative",
          }}
          className="animate-fade-in"
        >
          {/* 검색 아이콘 */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "20px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {isLoading
              ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
              : <Search size={20} />
            }
          </div>

          {/* 텍스트 입력창 */}
          <input
            ref={inputRef}
            id="hero-search"
            type="search"
            autoComplete="off"
            className="input-field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`${displayedPlaceholder} 검색...`}
            aria-label="배우, 가수, 드라마, 영화 이름으로 검색"
            disabled={isLoading}
            style={{
              paddingLeft: "56px",
              paddingRight: "126px",
              fontSize: "1.05rem",
              padding: "18px 130px 18px 56px",
              borderRadius: "16px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
            }}
          />

          {/* 검색 버튼 */}
          <button
            type="submit"
            id="hero-search-btn"
            className="btn btn-primary"
            disabled={isLoading || !query.trim()}
            aria-label="검색 실행"
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              padding: "10px 22px",
              borderRadius: "10px",
              fontSize: "0.9rem",
              opacity: isLoading || !query.trim() ? 0.5 : 1,
              cursor: isLoading || !query.trim() ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "검색 중..." : "검색"}
          </button>
        </form>

        {/* 예시 검색어 태그 */}
        <div
          aria-label="빠른 검색 예시"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            justifyContent: "center",
            marginTop: "24px",
          }}
          className="animate-fade-in"
        >
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", alignSelf: "center" }}>
            추천:
          </span>
          {["기생충", "블랙핑크", "오징어게임", "BTS", "이준기"].map((ex) => (
            <button
              key={ex}
              className="btn btn-ghost"
              onClick={() => {
                setQuery(ex);
                inputRef.current?.focus();
              }}
              aria-label={`${ex} 검색하기`}
              style={{
                padding: "6px 14px",
                fontSize: "0.82rem",
                borderRadius: "100px",
                minHeight: "32px",
              }}
            >
              {ex}
            </button>
          ))}
        </div>

        {/* 하단 화살표 (스크롤 유도) */}
        <div
          aria-hidden="true"
          className="animate-float"
          style={{
            marginTop: "72px",
            color: "var(--text-muted)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "0.75rem", letterSpacing: "0.1em" }}>SCROLL</span>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </div>

      {/* CSS: spin 애니메이션 인라인 */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}
