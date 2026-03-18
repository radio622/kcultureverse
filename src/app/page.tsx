"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { CosmosArtist } from "@/lib/types";

// 추천 아티스트 (홈 화면 기본 표시)
const FEATURED_ARTISTS = [
  { id: "3Nrfpe0tUJi4K4DXYWgMUX", name: "BTS", emoji: "🌟" },
  { id: "41MozSoPIsD1dJM0CLPjZF", name: "BLACKPINK", emoji: "🌸" },
  { id: "28ot3wh4oNmoFOdVajibBl", name: "NMIXX", emoji: "💥" },
  { id: "4Kxlr1PRlDKEB0ekOCyHgX", name: "검정치마", emoji: "🖤" },
  { id: "5rm0sBnflaCLmMMlS1cNMr", name: "백아", emoji: "🌙" },
  { id: "1Ur5YlAlza6E69KPH88Fti", name: "이박사", emoji: "🪘" },
];

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CosmosArtist[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const starsRef = useRef<{ id: number; x: number; y: number; size: number; opacity: number; duration: number; delay: number }[]>([]);

  // 별 생성
  useEffect(() => {
    starsRef.current = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: (i * 137.5) % 100,
      y: (i * 97.3) % 100,
      size: 1 + (i % 3) * 0.5,
      opacity: 0.15 + (i % 5) * 0.1,
      duration: 2 + (i % 4),
      delay: (i % 30) * 0.2,
    }));
  }, []);

  // 검색 (디바운스 300ms)
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleArtistSelect = useCallback((id: string) => {
    router.push(`/from/${id}`);
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100svh",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      {/* 성운 배경 */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 40%, #0c1029 0%, #0a0d20 40%, #060a14 100%)`,
          zIndex: 0,
        }}
      />

      {/* 별 */}
      {starsRef.current.map((star) => (
        <div
          key={star.id}
          className="star"
          style={{
            position: "fixed",
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            "--opacity-min": star.opacity * 0.3,
            "--opacity-max": star.opacity,
            "--duration": `${star.duration}s`,
            "--delay": `${star.delay}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* 메인 콘텐츠 */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: 480,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
        }}
      >
        {/* 로고 + 서브타이틀 */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, letterSpacing: "0.2em", color: "var(--accent-core)", marginBottom: 12, textTransform: "uppercase" }}>
            K · C U L T U R E
          </div>
          <h1
            style={{
              fontSize: "clamp(28px, 8vw, 48px)",
              fontWeight: 700,
              background: "linear-gradient(135deg, #fff 0%, var(--accent-core) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Universe
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 10 }}>
            아티스트의 음악 우주로 여행하세요
          </p>
        </div>

        {/* 검색창 */}
        <div style={{ width: "100%", position: "relative" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="search"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => query && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              placeholder="아티스트 검색... (BTS, 블랙핑크...)"
              className="search-input"
              autoComplete="off"
              style={{
                flex: 1,
                padding: "14px 18px",
                fontSize: 16,
              }}
            />
            {isSearching && (
              <div
                style={{
                  position: "absolute",
                  right: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 16,
                  height: 16,
                  border: "2px solid var(--accent-core)",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
            )}
          </div>

          {/* 검색 결과 드롭다운 */}
          {showResults && results.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                right: 0,
                background: "rgba(10, 14, 26, 0.98)",
                border: "1px solid var(--border-glass)",
                borderRadius: 12,
                overflow: "hidden",
                zIndex: 100,
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              {results.map((artist) => (
                <button
                  key={artist.spotifyId}
                  onClick={() => handleArtistSelect(artist.spotifyId)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s ease",
                    minHeight: "var(--touch-target)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(167,139,250,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "none";
                  }}
                >
                  {artist.imageUrl ? (
                    <Image
                      src={artist.imageUrl}
                      alt={artist.name}
                      width={36}
                      height={36}
                      style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "rgba(167,139,250,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        color: "var(--accent-core)",
                        flexShrink: 0,
                      }}
                    >
                      {artist.name.charAt(0)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
                      {artist.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {artist.genres.slice(0, 2).join(" · ") || "Artist"}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>→</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 추천 아티스트 */}
        <div style={{ width: "100%" }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            추천
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            {FEATURED_ARTISTS.map((artist) => (
              <button
                key={artist.id}
                onClick={() => handleArtistSelect(artist.id)}
                style={{
                  padding: "14px 8px",
                  background: "var(--surface-glass)",
                  border: "1px solid var(--border-glass)",
                  borderRadius: 12,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  transition: "background 0.2s ease, border-color 0.2s ease",
                  minHeight: "var(--touch-target)",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "rgba(167,139,250,0.1)";
                  el.style.borderColor = "rgba(167,139,250,0.3)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "var(--surface-glass)";
                  el.style.borderColor = "var(--border-glass)";
                }}
              >
                <span style={{ fontSize: 22 }}>{artist.emoji}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                  {artist.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
