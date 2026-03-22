"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SearchEntry {
  spotifyId: string;
  name: string;
  searchTokens: string[];
  imageUrl: string | null;
  genres: string[];
}

const ALIAS_MAP: Record<string, string[]> = {
  // ── 글로벌 공식명 유지 아티스트 (한글 검색 지원) ──
  "BLACKPINK": ["블랙핑크", "블핑"],
  "BTS": ["방탄소년단", "방탄"],
  "TWICE": ["트와이스"],
  "EXO": ["엑소"],
  "BIGBANG": ["빅뱅"],
  "SEVENTEEN": ["세븐틴"],
  "NRG": ["엔알지"],
  "S.E.S.": ["에스이에스"],
  "H.O.T.": ["에이치오티"],
  "NCT 127": ["엔시티"],
  "NCT DREAM": ["엔시티드림"],
  "DJ DOC": ["디제이독"],
  "R.ef": ["알이에프"],
  "AOA": ["에이오에이"],
  "pH-1": ["피에이치원"],
  "H2O": ["에이치투오"],
  "HERD": ["허드"],
  "TRPP": ["티알피피"],
  "YTC": ["와이티씨"],
  "B612": ["비육일이"],
  "Y2K": ["와이투케이"],

  // ── 한글 대표명 아티스트 (영문 검색 지원) ──
  "아이유": ["IU", "이지은"],
  "악동뮤지션": ["AKMU", "악뮤"],
  "지드래곤": ["G-DRAGON", "GD", "권지용"],
  "지코": ["ZICO", "우지호"],
  "태연": ["TAEYEON", "김태연"],
  "이센스": ["E SENS", "강민호"],
  "검정치마": ["The Black Skirts", "black skirt", "조휴일"],
  "백아": ["Baek A"],
  "최재훈": ["Choi Jae Hoon"],
  "안재욱": ["An Jaewook"],
  "이지형": ["Lee Ji Hyung"],
  "현진영": ["HYUN JIN YOUNG"],
  "전인권": ["In Kwon Jeon"],
  "김현정": ["Kim Hyun Jung"],
  "김경호": ["Kim Kyung Ho"],
  "김장훈": ["Kim Jang-Hoon"],
  "김정미": ["Kim Jung Mi"],
  "김수철": ["Kim Soo Cheol"],
  "김원준": ["Kim Won Jun"],
  "민해경": ["Min Hae Kyung"],
  "노사연": ["No Sa Yeon"],
  "태진아": ["TAE JIN AH"],
  "이상은": ["Lee Sang Eun"],
  "이지훈": ["Lee Ji Hoon"],
  "이정선": ["Lee Jeong Seon"],
  "박혜경": ["Park Hye Kyung"],
  "신효범": ["Shin Hyobum"],
  "신중현과 뮤직파워": ["Shin Joong Hyun"],
  "송골매": ["Songolmae"],
  "클론": ["Clon"],
  "패닉": ["Panic"],
  "윤도현밴드": ["YB", "윤도현"],
  "갤럭시 익스프레스": ["Galaxy Express"],
  "델리스파이스": ["DELISPICE"],
  "공중도둑": ["Mid-Air Thief"],
  "파란노을": ["Parannoul"],
  "한로로": ["HANRORO"],
  "정밀아": ["JEONGMILLA"],
  "자이언티": ["Zion.T"],
  "조PD": ["ZoPD"],
  "양파": ["Yangpa"],
  "롤러코스터": ["Rollercoaster"],
  "러브홀릭": ["Loveholics"],
  "브로큰 발렌타인": ["Broken Valentine"],
  "술탄 오브 더 디스코": ["Sultan of the Disco"],
  "더 크로스": ["The Cross"],
  "더 로즈": ["The Rose"],
  "해파리": ["HAEPAARY"],
  "달빛요정역전만루홈런": ["Moonlight Fairy"],
  "씨엔블루": ["CNBLUE"],
  "공일오비": ["015B"],
  "글렌체크": ["Glen Check"],
  "이랑": ["Lang Lee"],
  "보수동쿨러": ["Bosudongcooler"],
  "에픽하이": ["Epik High"],
  "다이나믹 듀오": ["Dynamic Duo"],
  "크러쉬": ["Crush"],
  "딘": ["Dean"],
  "헤이즈": ["Heize"],
  "현아": ["HyunA"],
  "비": ["Rain"],
  "보아": ["BoA"],
  "이효리": ["Lee Hyori"],
  "싸이": ["Psy"],
  "동방신기": ["TVXQ"],
  "소녀시대": ["Girls Generation", "SNSD"],
  "샤이니": ["SHINee"],
  "레드벨벳": ["Red Velvet"],
  "마마무": ["MAMAMOO"],
  "박재범": ["Jay Park"],
  "선미": ["SUNMI"],
  "청하": ["Chungha"],
  "르세라핌": ["LE SSERAFIM"],
  "뉴진스": ["NewJeans"],
  "에스파": ["aespa"],
  "스트레이 키즈": ["Stray Kids", "SKZ"],
  "있지": ["ITZY"],
  "여자아이들": ["(G)I-DLE", "GIDLE"],
  "RM": ["김남준", "알엠"],
  "JIN": ["김석진", "진"],
  "SUGA": ["민윤기", "슈가", "Agust D"],
  "J-HOPE": ["정호석", "제이홉"],
  "JIMIN": ["박지민", "지민"],
  "V": ["김태형", "뷔"],
  "JUNG KOOK": ["전정국", "정국"],
};

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
        const arr = Object.values(layoutData.nodes).map((n: any) => {
          const primaryName = n.nameKo || n.name;
          const aliases = ALIAS_MAP[n.name] || ALIAS_MAP[primaryName] || [];
          
          return {
            spotifyId: n.id,
            name: primaryName,
            searchTokens: [n.name, n.nameKo, ...aliases]
              .filter(Boolean)
              .map((t: string) => t.toLowerCase().replace(/\s+/g, "")),
            imageUrl: detailsData[n.id]?.image || null,
            genres: detailsData[n.id]?.genres || [],
          };
        });
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
      // 1. 로컬 인덱스 검색 (토큰 기반)
      const q = value.toLowerCase().replace(/\s+/g, "");
      const local = localIndex.filter(a =>
        a.searchTokens.some(token => token.includes(q)) ||
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
