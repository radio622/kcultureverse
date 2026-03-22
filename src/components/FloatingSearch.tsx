"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SearchEntry {
  spotifyId: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
}

// 분당 최대 5회 throttle (Spotify 검색 API 보호)
const THROTTLE_MAX = 5;
const THROTTLE_WINDOW_MS = 60_000;
const callTimestamps: number[] = [];

function isThrottled(): boolean {
  const now = Date.now();
  // 1분 이내 호출만 유지
  while (callTimestamps.length && callTimestamps[0] < now - THROTTLE_WINDOW_MS) {
    callTimestamps.shift();
  }
  return callTimestamps.length >= THROTTLE_MAX;
}

function recordCall() {
  callTimestamps.push(Date.now());
}

interface Props {
  onSelect?: (spotifyId: string) => void;
}

export default function FloatingSearch({ onSelect }: Props = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [throttleMsg, setThrottleMsg] = useState("");
  const [localIndex, setLocalIndex] = useState<SearchEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // v5-layout과 v5-details를 머지하여 동적 로컬 검색망 구축
  useEffect(() => {
    Promise.all([
      fetch("/data/v5-layout.json").then((r) => r.json()),
      fetch("/data/v5-details.json").then((r) => r.json()),
    ])
      .then(([layoutData, detailsData]) => {
        const arr = Object.values(layoutData.nodes).map((n: any) => ({
          spotifyId: n.id, // V6.5 mbid를 폼폼 호환용으로 매핑
          name: n.nameKo || n.name,
          imageUrl: detailsData[n.id]?.image || null,
          genres: detailsData[n.id]?.genres || [],
        }));
        setLocalIndex(arr);
      })
      .catch(() => {
        /* 로드 실패 무시 */
      });
  }, []);

  // 패널 열릴 때 input 자동 포커스
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setThrottleMsg("");

    if (!value.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      // 1. 로컬 인덱스 우선 검색
      const q = value.toLowerCase();
      const local = localIndex.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.spotifyId.toLowerCase().includes(q)
      ).slice(0, 8);

      setResults(local);

      // 2. 로컬 결과가 3개 미만일 때만 Spotify 호출 (throttle 체크)
      if (local.length < 3) {
        if (isThrottled()) {
          setThrottleMsg("잠시 후 다시 시도해주세요 (검색 횟수 제한)");
          return;
        }
        setIsSearching(true);
        try {
          recordCall();
          const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(value)}`);
          if (res.ok) {
            const remote: SearchEntry[] = await res.json();
            // 로컬에 없는 결과만 추가 (중복 방지)
            const localIds = new Set(local.map(a => a.spotifyId));
            const merged = [...local, ...remote.filter(a => !localIds.has(a.spotifyId))].slice(0, 8);
            setResults(merged);
          }
        } catch {
          /* 검색 실패는 조용히 처리 */
        } finally {
          setIsSearching(false);
        }
      }
    }, 320);
  }, [localIndex]);

  const handleSelect = useCallback(async (spotifyId: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);

    if (onSelect) {
      onSelect(spotifyId);
      return;
    }

    // pre-baked JSON이 있는지 먼저 확인 (HEAD 요청)
    try {
      const check = await fetch(`/data/hub/${spotifyId}.json`, { method: "HEAD" });
      if (check.ok) {
        // 있으면 홈에서 우주 교체 (향후 Step 5에서 구현) — 지금은 from 페이지로
        router.push(`/from/${spotifyId}`);
        return;
      }
    } catch { /* 없으면 그냥 from 페이지 */ }

    router.push(`/from/${spotifyId}`);
  }, [router, onSelect]);

  return (
    <>
      {/* ── 플로팅 검색 버튼 (우상단) ─────────────── */}
      <button
        id="floating-search-btn"
        aria-label="아티스트 검색"
        onClick={() => setOpen(v => !v)}
        style={{
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 200,
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: open
            ? "rgba(167,139,250,0.25)"
            : "rgba(10,14,26,0.7)",
          border: `1px solid ${open ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.12)"}`,
          backdropFilter: "blur(12px)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.25s ease",
          boxShadow: open ? "0 0 16px rgba(167,139,250,0.3)" : "none",
        }}
      >
        {open ? (
          // ✕ 닫기
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,0.9)" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          // 🔍 검색
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(200,190,255,0.8)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}
      </button>

      {/* ── 검색 패널 (슬라이드 다운) ──────────────── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 190,
          transform: open ? "translateY(0)" : "translateY(-110%)",
          opacity: open ? 1 : 0,
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease",
          background: "rgba(7,9,18,0.94)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(167,139,250,0.15)",
          padding: "68px 16px 16px",
        }}
      >
        {/* 검색 입력 */}
        <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="rgba(167,139,250,0.5)" strokeWidth="2" strokeLinecap="round"
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            id="search-input"
            type="search"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && results.length > 0) {
                e.preventDefault();
                handleSelect(results[0].spotifyId);
              }
            }}
            placeholder="아티스트 검색... (BTS, 아이유, 혁오...)"
            autoComplete="off"
            className="search-input"
            style={{
              width: "100%",
              padding: "12px 16px 12px 40px",
              fontSize: 15,
              boxSizing: "border-box",
            }}
          />
          {isSearching && (
            <div style={{
              position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
              width: 16, height: 16,
              border: "2px solid var(--accent-core)",
              borderTop: "2px solid transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
          )}
        </div>

        {/* throttle 경고 */}
        {throttleMsg && (
          <p style={{ textAlign: "center", fontSize: 12, color: "#fb923c", marginTop: 8 }}>
            ⚠️ {throttleMsg}
          </p>
        )}

        {/* 검색 결과 */}
        {results.length > 0 && (
          <div style={{ maxWidth: 480, margin: "10px auto 0", display: "flex", flexDirection: "column", gap: 2 }}>
            {results.map(artist => (
              <button
                key={artist.spotifyId}
                onClick={() => handleSelect(artist.spotifyId)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  background: "rgba(167,139,250,0.04)",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.1)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(167,139,250,0.04)")}
              >
                {/* 아바타 */}
                {artist.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={artist.imageUrl}
                    alt={artist.name}
                    width={36}
                    height={36}
                    style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "rgba(167,139,250,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, color: "var(--accent-core)", flexShrink: 0,
                  }}>
                    {artist.name.charAt(0)}
                  </div>
                )}
                {/* 이름 + 장르 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
                    {artist.name}
                  </div>
                  {artist.genres?.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {artist.genres.slice(0, 2).join(" · ")}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "rgba(167,139,250,0.5)" }}>→</span>
              </button>
            ))}
          </div>
        )}

        {/* 결과 없음 */}
        {query.trim() && !isSearching && results.length === 0 && (
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 16 }}>
            "{query}" 검색 결과가 없습니다
          </p>
        )}
      </div>

      {/* 패널 열렸을 때 배경 클릭으로 닫기 */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 180,
            background: "transparent",
          }}
        />
      )}

      <style>{`
        @keyframes spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </>
  );
}
