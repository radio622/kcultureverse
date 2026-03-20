"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { CosmosArtist } from "@/lib/types";

interface Props {
  artist: CosmosArtist;
  isActive: boolean;
  onTap: () => void;
  onDive: () => void;
}

export default function ArtistCard({ artist, isActive, onTap, onDive }: Props) {
  const [imgError, setImgError] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(artist.imageUrl ?? null);

  // Next.js 상태 캐싱 시 동기화용
  useEffect(() => {
    setResolvedImageUrl(artist.imageUrl ?? null);
    setImgError(false);
  }, [artist.imageUrl, artist.name]);

  useEffect(() => {
    if (resolvedImageUrl || imgError || !artist.name) return;
    let cancelled = false;

    fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(artist.name)}&entity=album&attribute=artistTerm&limit=1`,
      { signal: AbortSignal.timeout(5000) }
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const url = data.results?.[0]?.artworkUrl100?.replace("100x100bb", "400x400bb");
        if (url) setResolvedImageUrl(url);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [artist.name, resolvedImageUrl, imgError]);

  const displayGenres = artist.genres.slice(0, 2);
  const initial       = artist.name.charAt(0).toUpperCase();
  const hasPreview    = !!artist.previewUrl;
  const showImage     = !!resolvedImageUrl && !imgError;

  // 이름 기반 고유 색상
  const hue = (artist.name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) * 47) % 360;
  const initialBg    = `hsl(${hue},30%,18%)`;
  const initialColor = `hsl(${hue},65%,65%)`;


  return (
    <div
      className="glass-card"
      onClick={onTap}
      style={{
        width: 170,
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        border: isActive
          ? "1px solid rgba(167,139,250,0.55)"
          : "1px solid var(--border-glass)",
        boxShadow: isActive
          ? "0 0 24px rgba(167,139,250,0.18), 0 8px 24px rgba(0,0,0,0.4)"
          : "0 4px 16px rgba(0,0,0,0.3)",
        transition: "border-color 0.3s ease, box-shadow 0.3s ease, transform 0.25s ease",
        transform: isActive ? "translateY(-4px) scale(1.01)" : "translateY(0) scale(1)",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      {/* ── 활성 시 상단 강조 줄 ───────────────────── */}
      {isActive && (
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 2,
          background: "linear-gradient(90deg, transparent, var(--accent-core), transparent)",
        }} />
      )}

      {/* ── 아티스트 이미지 ────────────────────────── */}
      <div
        style={{
          width: "100%",
          aspectRatio: "1",
          borderRadius: 10,
          overflow: "hidden",
          background: showImage ? "var(--bg-nebula)" : initialBg,
          position: "relative",
          flexShrink: 0,
        }}
      >
        {showImage ? (
          <Image
            src={resolvedImageUrl!}
            alt={artist.name}
            fill
            style={{ objectFit: "cover" }}
            sizes="212px"
            onError={() => setImgError(true)}
          />
        ) : (
          /* 이미지 없거나 실패 → 이니셜 */
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 52,
              color: initialColor,
              fontWeight: 300,
            }}
          >
            {initial}
          </div>
        )}

        {/* 재생 중 오버레이 */}
        {isActive && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {/* 파동 이퀄라이저 */}
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
              {[0,1,2,3,4].map(i => (
                <div
                  key={i}
                  style={{
                    width: 4,
                    borderRadius: 2,
                    background: "var(--accent-core)",
                    animation: `cardWave ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
                    height: `${10 + i * 4}px`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 관계 키워드 태그 ────────────────────────── */}
      {(artist as { relationKeyword?: string }).relationKeyword && (
        <div style={{
          padding: "2px 6px",
          background: "rgba(167,139,250,0.12)",
          border: "1px solid rgba(167,139,250,0.25)",
          borderRadius: 6,
          fontSize: 9,
          color: "var(--accent-core)",
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          alignSelf: "flex-start",
        }}>
          <span>🔗</span>
          {(artist as { relationKeyword?: string }).relationKeyword}
        </div>
      )}

      {/* ── 이름 + 장르 ─────────────────────────────── */}
      <div>
        <h3 style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 3px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {artist.name}
        </h3>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {displayGenres.map(genre => (
            <span
              key={genre}
              style={{
                fontSize: 10,
                padding: "2px 7px",
                borderRadius: 20,
                background: "rgba(167,139,250,0.1)",
                color: "var(--accent-core)",
                border: "1px solid rgba(167,139,250,0.18)",
              }}
            >
              {genre}
            </span>
          ))}
          {displayGenres.length === 0 && (
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>K-POP</span>
          )}
        </div>
      </div>

      {/* ── 인기도 게이지 ────────────────────────────── */}
      <div>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 9,
          color: "var(--text-muted)",
          marginBottom: 2,
        }}>
          <span>인기도</span>
          <span style={{ color: "var(--text-secondary)" }}>{artist.popularity}</span>
        </div>
        <div style={{
          height: 3,
          borderRadius: 2,
          background: "rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${artist.popularity}%`,
            background: "linear-gradient(90deg, var(--accent-core), var(--accent-blue, #60a5fa))",
            borderRadius: 2,
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {/* ── 미리듣기 / Spotify 표시 ─────────────────── */}
      <div style={{
        fontSize: 10,
        color: hasPreview ? "var(--text-secondary)" : "#1db954",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}>
        {hasPreview ? (
          <>
            <span style={{ color: "var(--accent-core)", fontSize: 9 }}>▶</span>
            <span style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {artist.previewTrackName ?? "미리듣기 가능"}
            </span>
          </>
        ) : (
          <a
            href={artist.spotifyUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ color: "#1db954", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#1db954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Spotify에서 듣기
          </a>
        )}
      </div>

      {/* ── Dive Into 버튼 ────────────────────────────── */}
      <button
        onClick={(e) => { e.stopPropagation(); onDive(); }}
        style={{
          width: "100%",
          padding: "7px 0",
          borderRadius: 8,
          background: isActive
            ? "rgba(167,139,250,0.18)"
            : "rgba(255,255,255,0.04)",
          border: "1px solid rgba(167,139,250,0.3)",
          color: "var(--accent-core)",
          fontSize: 11,
          fontWeight: 500,
          cursor: "pointer",
          transition: "background 0.2s ease, transform 0.15s ease",
          letterSpacing: "0.03em",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.22)")}
        onMouseLeave={e => (e.currentTarget.style.background = isActive ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)")}
      >
        이 아티스트의 우주로 →
      </button>

      <style>{`
        @keyframes cardWave {
          from { transform: scaleY(0.5); }
          to   { transform: scaleY(1.4); }
        }
      `}</style>
    </div>
  );
}
