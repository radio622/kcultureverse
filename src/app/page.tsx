/**
 * KCultureVerse — 메인 랜딩 페이지
 * ─ Server Component (데이터 fetch)
 * ─ 구성: Hero + 검색창(Client) + 트렌딩 인물/작품 카드 그리드
 */
import { Suspense } from "react";
import Header from "@/components/Header";
import SearchHero from "@/components/SearchHero";
import TrendingSection from "@/components/TrendingSection";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KCultureVerse — K-Culture 유니버스 맵",
  description:
    "배우, 가수, 감독들이 어떻게 연결되어 있는지 3D 우주 지도로 탐험하세요. K-드라마, K-팝, 한국 영화의 모든 관계를 한눈에 보여드립니다.",
};

// ── 스켈레톤 로딩 UI ─────────────────────────────────
function TrendingSkeleton() {
  return (
    <section style={{ padding: "60px 0" }}>
      <div className="container">
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 32 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 20 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton" style={{ aspectRatio: "2/3", borderRadius: 12, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 18, width: "80%", marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: "50%" }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 페이지 컴포넌트 (Server Component) ───────────────
export default function HomePage() {
  return (
    <>
      <Header />

      <main
        role="main"
        id="main-content"
        style={{ position: "relative", zIndex: 1 }}
      >
        {/* ① Hero + 검색 영역 */}
        <SearchHero />

        {/* ② 트렌딩 섹션 (Suspense Streaming) */}
        <Suspense fallback={<TrendingSkeleton />}>
          <TrendingSection />
        </Suspense>

        {/* ③ 소개 / 기능 설명 섹션 */}
        <FeaturesSection />

        {/* ④ CTA */}
        <CtaSection />
      </main>

      <footer
        role="contentinfo"
        style={{
          borderTop: "1px solid var(--border)",
          padding: "32px 0",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div className="container">
          <p>© 2026 KCultureVerse · K-Culture의 모든 연결을 탐험하다</p>
          <p style={{ marginTop: 8 }}>
            Data provided by{" "}
            <a
              href="https://www.themoviedb.org"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--primary-light)" }}
            >
              TMDb
            </a>{" "}
            &{" "}
            <a
              href="https://spotify.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--secondary)" }}
            >
              Spotify
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}

// ── 기능 소개 섹션 ────────────────────────────────────
const FEATURES = [
  {
    icon: "🌌",
    title: "3D 유니버스 맵",
    desc: "K-Culture의 모든 인물과 작품이 3D 우주에서 별처럼 연결됩니다. 직접 탐험하고 회전하며 관계를 발견하세요.",
  },
  {
    icon: "🔗",
    title: "6단계 연결 탐색",
    desc: "배우 A와 배우 B는 몇 단계를 거쳐 연결될까요? 최단 경로를 찾아 예상치 못한 연결고리를 발견하세요.",
  },
  {
    icon: "🤖",
    title: "AI 추천 서비스",
    desc: '"이 목소리 느낌이 좋아" 단 하나의 문장으로 나에게 딱 맞는 아티스트를 추천받으세요.',
  },
  {
    icon: "📡",
    title: "실시간 데이터 확장",
    desc: "검색할수록 유니버스가 넓어집니다. 인디 밴드부터 국민 배우까지, K-Culture 생태계 전체를 담습니다.",
  },
];

function FeaturesSection() {
  return (
    <section
      aria-labelledby="features-heading"
      style={{ padding: "80px 0" }}
    >
      <div className="container">
        <h2
          id="features-heading"
          style={{
            fontFamily: "var(--font-display)",
            textAlign: "center",
            marginBottom: "56px",
            fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
          }}
        >
          왜 <span className="gradient-text">KCultureVerse</span>인가요?
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "24px",
          }}
        >
          {FEATURES.map((f, i) => (
            <article
              key={f.title}
              className="glass-card"
              style={{
                padding: "32px 24px",
                cursor: "default",
                animationDelay: `${i * 0.1}s`,
              }}
            >
              <div
                aria-hidden="true"
                style={{ fontSize: "2.5rem", marginBottom: "20px", lineHeight: 1 }}
              >
                {f.icon}
              </div>
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.1rem",
                  marginBottom: "12px",
                  color: "var(--text-primary)",
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.7,
                }}
              >
                {f.desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA 섹션 ──────────────────────────────────────────
function CtaSection() {
  return (
    <section
      aria-labelledby="cta-heading"
      style={{
        padding: "80px 0 120px",
        textAlign: "center",
      }}
    >
      <div className="container">
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            padding: "56px 40px",
            borderRadius: "24px",
            background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(6,182,212,0.1) 100%)",
            border: "1px solid rgba(124,58,237,0.25)",
          }}
        >
          <h2
            id="cta-heading"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.5rem, 3vw, 2rem)",
              marginBottom: "16px",
            }}
          >
            지금 바로 탐험을 시작하세요
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              marginBottom: "32px",
              fontSize: "1rem",
            }}
          >
            좋아하는 배우나 가수의 이름을 검색하는 것만으로
            <br />
            K-Culture의 거대한 연결망이 눈앞에 펼쳐집니다.
          </p>
          <a
            href="/explore"
            id="cta-explore-btn"
            className="btn btn-primary"
            style={{ fontSize: "1rem", padding: "14px 36px" }}
          >
            🌌 유니버스 탐색하기
          </a>
        </div>
      </div>
    </section>
  );
}
