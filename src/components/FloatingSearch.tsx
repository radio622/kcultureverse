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
  while (callTimestamps.length && callTimestamps[0] < now - THROTTLE_WINDOW_MS) {
    callTimestamps.shift();
  }
  return callTimestamps.length >= THROTTLE_MAX;
}
function recordCall() { callTimestamps.push(Date.now()); }

interface Props {
  onSelect?: (spotifyId: string) => void;
  /** 듀얼 관계 탐색: A↔B 경로 요청 */
  onDualSelect?: (idA: string, idB: string) => void;
}

// ── 미니 단일 아티스트 검색 서브컴포넌트 (듀얼 탭에서 재사용) ──────────
function MiniSearch({
  label,
  selected,
  localIndex,
  onSelect,
  onClear,
}: {
  label: string;
  selected: SearchEntry | null;
  localIndex: SearchEntry[];
  onSelect: (e: SearchEntry) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchEntry[]>([]);
  const ref = useRef<HTMLInputElement>(null);

  const search = useCallback((val: string) => {
    setQ(val);
    if (!val.trim()) { setHits([]); return; }
    const tok = val.toLowerCase().replace(/\s+/g, "");
    setHits(
      localIndex
        .filter(a => a.searchTokens.some(t => t.includes(tok)) || a.spotifyId.includes(tok))
        .slice(0, 5)
    );
  }, [localIndex]);

  if (selected) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
        background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.25)",
        borderRadius: 12,
      }}>
        {selected.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected.imageUrl} alt={selected.name}
            width={28} height={28} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(167,139,250,0.6)", marginBottom: 1 }}>{label}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{selected.name}</div>
        </div>
        <button onClick={onClear} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.3)",
          cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 4px",
        }}>×</button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ fontSize: 11, color: "rgba(167,139,250,0.55)", marginBottom: 5, letterSpacing: "0.06em" }}>
        {label}
      </div>
      <input
        ref={ref}
        value={q}
        onChange={e => search(e.target.value)}
        placeholder="아티스트 이름 검색..."
        autoComplete="off"
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "9px 12px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(167,139,250,0.2)",
          borderRadius: 10, fontSize: 13, color: "#fff", outline: "none",
        }}
      />
      {hits.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
          marginTop: 4, background: "rgba(7,9,20,0.97)",
          border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10,
          overflow: "hidden",
        }}>
          {hits.map(h => (
            <button key={h.spotifyId} onClick={() => { onSelect(h); setQ(""); setHits([]); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", background: "none", border: "none",
                cursor: "pointer", textAlign: "left", color: "#fff",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              {h.imageUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={h.imageUrl} alt={h.name} width={24} height={24}
                    style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 24, height: 24, borderRadius: "50%",
                    background: "rgba(167,139,250,0.15)", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "var(--accent-core)" }}>{h.name.charAt(0)}</div>
              }
              <span style={{ fontSize: 13 }}>{h.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function FloatingSearch({ onSelect, onDualSelect }: Props = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"single" | "dual">("single");

  // 단일 검색 상태
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [throttleMsg, setThrottleMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 듀얼 검색 상태
  const [dualA, setDualA] = useState<SearchEntry | null>(null);
  const [dualB, setDualB] = useState<SearchEntry | null>(null);

  // 로컬 인덱스
  const [localIndex, setLocalIndex] = useState<SearchEntry[]>([]);

  // v5-layout + v5-details 머지
  useEffect(() => {
    Promise.all([
      fetch("/data/v5-layout.json").then(r => r.json()),
      fetch("/data/v5-details.json").then(r => r.json()),
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
      .catch(() => {});
  }, []);

  // 패널 열릴 때 포커스
  useEffect(() => {
    if (open && activeTab === "single") setTimeout(() => inputRef.current?.focus(), 80);
  }, [open, activeTab]);

  // ESC 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 단일 검색
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setThrottleMsg("");
    if (!value.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      const q = value.toLowerCase().replace(/\s+/g, "");
      const local = localIndex
        .filter(a => a.searchTokens.some(t => t.includes(q)) || a.spotifyId.toLowerCase().includes(q))
        .slice(0, 8);
      setResults(local);

      if (local.length < 3) {
        if (isThrottled()) { setThrottleMsg("잠시 후 다시 시도해주세요 (검색 횟수 제한)"); return; }
        setIsSearching(true);
        try {
          recordCall();
          const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(value)}`);
          if (res.ok) {
            const remote: SearchEntry[] = await res.json();
            const localIds = new Set(local.map(a => a.spotifyId));
            setResults([...local, ...remote.filter(a => !localIds.has(a.spotifyId))].slice(0, 8));
          }
        } catch { /* 조용히 처리 */ } finally { setIsSearching(false); }
      }
    }, 320);
  }, [localIndex]);

  const handleSelect = useCallback(async (spotifyId: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    if (onSelect) { onSelect(spotifyId); return; }
    try {
      const check = await fetch(`/data/hub/${spotifyId}.json`, { method: "HEAD" });
      if (check.ok) { router.push(`/from/${spotifyId}`); return; }
    } catch { /* 없으면 from 페이지 */ }
    router.push(`/from/${spotifyId}`);
  }, [router, onSelect]);

  // 듀얼 관계 탐색 확정
  const handleDualSearch = useCallback(() => {
    if (!dualA || !dualB || !onDualSelect) return;
    onDualSelect(dualA.spotifyId, dualB.spotifyId);
    setOpen(false);
  }, [dualA, dualB, onDualSelect]);

  return (
    <>
      {/* ── 플로팅 검색 버튼 ─────────────────────────── */}
      <button
        id="floating-search-btn"
        aria-label="아티스트 검색"
        onClick={() => setOpen(v => !v)}
        style={{
          position: "fixed", top: 16, left: 16, zIndex: 200,
          width: 42, height: 42, borderRadius: "50%",
          background: open ? "rgba(167,139,250,0.25)" : "rgba(10,14,26,0.7)",
          border: `1px solid ${open ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.12)"}`,
          backdropFilter: "blur(12px)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.25s ease",
          boxShadow: open ? "0 0 16px rgba(167,139,250,0.3)" : "none",
        }}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,0.9)" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(200,190,255,0.8)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}
      </button>

      {/* ── 검색 패널 ─────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 190,
        transform: open ? "translateY(0)" : "translateY(-110%)",
        opacity: open ? 1 : 0,
        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease",
        background: "rgba(7,9,18,0.96)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(167,139,250,0.15)",
        padding: "68px 16px 20px",
      }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>

          {/* 탭 선택 */}
          <div style={{ display: "flex", gap: 0, marginBottom: 16, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 3 }}>
            {([
              { key: "single", icon: "🔍", label: "아티스트 탐색" },
              { key: "dual",   icon: "🔗", label: "관계 탐색 A↔B" },
            ] as const).map(tab => (
              <button
                key={tab.key}
                id={`search-tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, padding: "7px 12px", borderRadius: 9, border: "none",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.2s",
                  background: activeTab === tab.key
                    ? "rgba(167,139,250,0.18)"
                    : "transparent",
                  color: activeTab === tab.key
                    ? "#c084fc"
                    : "rgba(255,255,255,0.4)",
                  borderBottom: activeTab === tab.key
                    ? "2px solid #c084fc"
                    : "2px solid transparent",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* ── 탭 1: 단일 검색 ── */}
          {activeTab === "single" && (<>
            <div style={{ position: "relative" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="rgba(167,139,250,0.5)" strokeWidth="2" strokeLinecap="round"
                style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
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
                style={{ width: "100%", padding: "12px 16px 12px 40px", fontSize: 15, boxSizing: "border-box" }}
              />
              {isSearching && (
                <div style={{
                  position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                  width: 16, height: 16, border: "2px solid var(--accent-core)",
                  borderTop: "2px solid transparent", borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }} />
              )}
            </div>

            {throttleMsg && <p style={{ textAlign: "center", fontSize: 12, color: "#fb923c", marginTop: 8 }}>⚠️ {throttleMsg}</p>}

            {results.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
                {results.map(artist => (
                  <button key={artist.spotifyId} onClick={() => handleSelect(artist.spotifyId)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px", background: "rgba(167,139,250,0.04)",
                      border: "none", borderRadius: 10, cursor: "pointer", textAlign: "left",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.1)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(167,139,250,0.04)")}
                  >
                    {artist.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={artist.imageUrl} alt={artist.name} width={36} height={36}
                        style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: "50%",
                        background: "rgba(167,139,250,0.15)", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, color: "var(--accent-core)", }}>
                        {artist.name.charAt(0)}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{artist.name}</div>
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

            {query.trim() && !isSearching && results.length === 0 && (
              <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 16 }}>
                &ldquo;{query}&rdquo; 검색 결과가 없습니다
              </p>
            )}
          </>)}

          {/* ── 탭 2: 듀얼 관계 탐색 ── */}
          {activeTab === "dual" && (
            <div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 14, lineHeight: 1.6 }}>
                두 아티스트를 선택하면 우주에서 연결 경로를 찾아 하이라이트합니다.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <MiniSearch
                  label="아티스트 A"
                  selected={dualA}
                  localIndex={localIndex}
                  onSelect={setDualA}
                  onClear={() => setDualA(null)}
                />

                {/* 연결 아이콘 */}
                <div style={{ textAlign: "center", fontSize: 18, color: "rgba(167,139,250,0.5)", margin: "-2px 0" }}>↕</div>

                <MiniSearch
                  label="아티스트 B"
                  selected={dualB}
                  localIndex={localIndex}
                  onSelect={setDualB}
                  onClear={() => setDualB(null)}
                />
              </div>

              {/* 관계 탐색 실행 버튼 */}
              <button
                id="dual-search-go-btn"
                onClick={handleDualSearch}
                disabled={!dualA || !dualB}
                style={{
                  marginTop: 16, width: "100%", padding: "12px",
                  borderRadius: 12, border: "none", fontSize: 14, fontWeight: 700,
                  background: dualA && dualB
                    ? "linear-gradient(135deg, #a78bfa, #c084fc)"
                    : "rgba(255,255,255,0.06)",
                  color: dualA && dualB ? "#fff" : "rgba(255,255,255,0.25)",
                  cursor: dualA && dualB ? "pointer" : "not-allowed",
                  transition: "all 0.2s",
                }}
              >
                {dualA && dualB
                  ? `🔗 ${dualA.name} ↔ ${dualB.name} 관계 탐색`
                  : "두 아티스트를 모두 선택하세요"}
              </button>

              {/* 힌트: 그래프에 없는 아티스트 안내 */}
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 10, textAlign: "center", lineHeight: 1.6 }}>
                우주에 등록된 아티스트만 경로 탐색이 가능합니다.<br />
                연결 경로가 없으면 가장 가까운 공통 허브를 표시합니다.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* 배경 클릭으로 닫기 */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 180, background: "transparent" }} />
      )}

      <style>{`
        @keyframes spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </>
  );
}
