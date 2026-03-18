"use client";

/**
 * /connect — 케빈 베이컨 6단계 연결 탐색기
 *
 * 두 인물을 선택하면 Neo4j shortestPath 알고리즘으로
 * A → [공유 작품] → C → [공유 작품] → B 형태의 연결 고리를 찾아 시각화합니다.
 */
import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import { Search, Loader2, Shuffle, ArrowRight, ChevronRight } from "lucide-react";
import type { TmdbPerson } from "@/lib/tmdb";

// ── 타입 ─────────────────────────────────────────────
interface PathNode {
  type: "person" | "work";
  tmdbId: number;
  name: string;
  img: string | null; // raw TMDb path e.g. /abc.jpg
}

interface PathResult {
  found: boolean;
  hops: number;
  path: PathNode[];
  error?: string;
}

interface SelectedPerson {
  tmdbId: number;
  name: string;
  profilePath: string | null;
}

// ── 이미지 URL 빌더 ───────────────────────────────────
const TMDB_IMG = "https://image.tmdb.org/t/p";
function tmdbImg(path: string | null, size = "w185") {
  if (!path) return null;
  return `${TMDB_IMG}/${size}${path}`;
}

// ── 예시 쌍 (버튼 클릭 시 자동 채우기) ────────────────
const EXAMPLE_PAIRS = [
  {
    a: { tmdbId: 21684, name: "송강호", profilePath: null },
    b: { tmdbId: 969, name: "Tom Hanks", profilePath: null },
  },
  {
    a: { tmdbId: 21685, name: "이병헌", profilePath: null },
    b: { tmdbId: 287, name: "Brad Pitt", profilePath: null },
  },
];

// ── 인물 검색창 컴포넌트 ─────────────────────────────
function PersonSearchBox({
  label,
  selected,
  onSelect,
  placeholder,
  accentColor,
}: {
  label: string;
  selected: SelectedPerson | null;
  onSelect: (p: SelectedPerson) => void;
  placeholder: string;
  accentColor: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults((data.people ?? []).slice(0, 6));
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const handleSelect = (p: TmdbPerson) => {
    onSelect({ tmdbId: p.id, name: p.name, profilePath: p.profile_path });
    setQuery(p.name);
    setOpen(false);
    setResults([]);
  };

  return (
    <div style={{ position: "relative", flex: 1 }}>
      {/* 레이블 */}
      <p style={{
        fontSize: "0.78rem",
        fontWeight: 600,
        color: accentColor,
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}>
        {label}
      </p>

      {/* 선택된 인물 카드 표시 */}
      {selected ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}05)`,
            border: `1px solid ${accentColor}40`,
            borderRadius: 14,
            cursor: "pointer",
          }}
          onClick={() => { onSelect({ tmdbId: 0, name: "", profilePath: null }); setQuery(""); }}
        >
          {selected.profilePath ? (
            <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: `2px solid ${accentColor}` }}>
              <Image src={tmdbImg(selected.profilePath, "w185")!} alt={selected.name} width={40} height={40} style={{ objectFit: "cover" }} />
            </div>
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${accentColor}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
              🎭
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {selected.name}
            </p>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>클릭하면 변경</p>
          </div>
          <span style={{ color: `${accentColor}`, fontSize: "1.2rem" }}>✓</span>
        </div>
      ) : (
        /* 검색 입력창 */
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", display: "flex" }}>
            {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={16} />}
          </div>
          <input
            className="input-field"
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder}
            style={{
              paddingLeft: 42,
              borderRadius: 14,
              borderColor: open ? accentColor : undefined,
              boxShadow: open ? `0 0 0 3px ${accentColor}20` : undefined,
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          {/* 드롭다운 결과 */}
          {open && results.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                right: 0,
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
                zIndex: 50,
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}
            >
              {results.map((p) => (
                <button
                  key={p.id}
                  onMouseDown={() => handleSelect(p)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s",
                    color: "var(--text-primary)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {p.profile_path ? (
                    <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                      <Image src={tmdbImg(p.profile_path, "w185")!} alt={p.name} width={36} height={36} style={{ objectFit: "cover" }} />
                    </div>
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🎭</div>
                  )}
                  <div>
                    <p style={{ fontSize: "0.88rem", fontWeight: 600 }}>{p.name}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {p.known_for_department === "Acting" ? "배우" : p.known_for_department === "Directing" ? "감독" : "아티스트"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 경로 노드 카드 ───────────────────────────────────
function PathNodeCard({ node, isHighlight }: { node: PathNode; isHighlight: boolean }) {
  const imgUrl = tmdbImg(node.img, "w185");
  const isPerson = node.type === "person";
  const href = isPerson ? `/person/${node.tmdbId}` : undefined;

  const card = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "16px 12px",
        borderRadius: 16,
        background: isHighlight
          ? "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))"
          : "var(--bg-glass)",
        border: `1px solid ${isHighlight ? "rgba(124,58,237,0.4)" : "var(--border)"}`,
        minWidth: 100,
        maxWidth: 130,
        cursor: isPerson ? "pointer" : "default",
        transition: "transform 0.2s, box-shadow 0.2s",
        backdropFilter: "blur(12px)",
      }}
      onMouseEnter={(e) => {
        if (isPerson) {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(124,58,237,0.25)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* 이미지 */}
      <div
        style={{
          width: isPerson ? 72 : 56,
          height: isPerson ? 72 : 80,
          borderRadius: isPerson ? "50%" : 8,
          overflow: "hidden",
          border: `2px solid ${isPerson
            ? isHighlight ? "rgba(157,111,247,0.8)" : "rgba(157,111,247,0.4)"
            : "rgba(245,158,11,0.4)"}`,
          flexShrink: 0,
          boxShadow: isHighlight ? "0 0 20px rgba(124,58,237,0.5)" : "none",
        }}
      >
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={node.name}
            width={isPerson ? 72 : 56}
            height={isPerson ? 72 : 80}
            style={{ objectFit: "cover", objectPosition: isPerson ? "top" : "center" }}
          />
        ) : (
          <div style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isPerson ? "rgba(124,58,237,0.2)" : "rgba(245,158,11,0.2)",
            fontSize: "1.8rem",
          }}>
            {isPerson ? "🎭" : "🎬"}
          </div>
        )}
      </div>

      {/* 뱃지 */}
      <span style={{
        fontSize: "0.6rem",
        padding: "2px 8px",
        borderRadius: 100,
        background: isPerson ? "rgba(124,58,237,0.2)" : "rgba(245,158,11,0.15)",
        color: isPerson ? "#c4b5fd" : "#fcd34d",
        border: `1px solid ${isPerson ? "rgba(124,58,237,0.3)" : "rgba(245,158,11,0.3)"}`,
        fontWeight: 600,
        letterSpacing: "0.05em",
      }}>
        {isPerson ? "인물" : "작품"}
      </span>

      {/* 이름 */}
      <p style={{
        fontSize: "0.78rem",
        fontWeight: 700,
        color: "var(--text-primary)",
        textAlign: "center",
        lineHeight: 1.35,
        wordBreak: "break-word",
      }}>
        {node.name}
      </p>
    </div>
  );

  if (href) return <Link href={href} style={{ textDecoration: "none" }}>{card}</Link>;
  return card;
}

// ── 메인 페이지 ──────────────────────────────────────
export default function ConnectPage() {
  const [personA, setPersonA] = useState<SelectedPerson | null>(null);
  const [personB, setPersonB] = useState<SelectedPerson | null>(null);
  const [result, setResult]   = useState<PathResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSetA = (p: SelectedPerson) => { if (p.tmdbId === 0) setPersonA(null); else setPersonA(p); setResult(null); };
  const handleSetB = (p: SelectedPerson) => { if (p.tmdbId === 0) setPersonB(null); else setPersonB(p); setResult(null); };

  const findConnection = useCallback(async () => {
    if (!personA || !personB) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/graph/path?from=${personA.tmdbId}&to=${personB.tmdbId}`);
      const data: PathResult = await res.json();
      setResult(data);
    } catch {
      setResult({ found: false, hops: -1, path: [], error: "서버 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  }, [personA, personB]);

  const loadExample = (pair: typeof EXAMPLE_PAIRS[0]) => {
    setPersonA(pair.a);
    setPersonB(pair.b);
    setResult(null);
  };

  const canSearch = personA && personA.tmdbId > 0 && personB && personB.tmdbId > 0;

  return (
    <>
      <Header />
      <div className="page-content" style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>

        {/* ── 배경 장식 ── */}
        <div aria-hidden style={{
          position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at 30% 40%, rgba(124,58,237,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(6,182,212,0.06) 0%, transparent 60%)",
        }} />

        <div className="container" style={{ paddingTop: 48, paddingBottom: 80, position: "relative", zIndex: 1 }}>

          {/* ── 페이지 헤더 ── */}
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div className="badge badge-actor" style={{ marginBottom: 20, fontSize: "0.78rem" }}>
              🔗 케빈 베이컨의 6단계 법칙
            </div>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.8rem, 4vw, 3rem)",
              fontWeight: 700,
              lineHeight: 1.15,
              marginBottom: 16,
            }}>
              두 스타 사이의{" "}
              <span className="gradient-text">숨겨진 연결 고리</span>를
              <br />찾아보세요
            </h1>
            <p style={{ color: "var(--text-muted)", maxWidth: 520, margin: "0 auto", fontSize: "0.95rem", lineHeight: 1.7 }}>
              배우 A와 배우 B는 몇 단계를 거쳐 이어질까요?
              하나의 공유 작품이 우주를 잇는 다리가 됩니다.
            </p>
          </div>

          {/* ── 인물 선택 카드 ── */}
          <div
            className="glass-card"
            style={{ padding: "32px 36px", marginBottom: 24, maxWidth: 800, margin: "0 auto 24px" }}
          >
            {/* 두 검색창 */}
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap" }}>
              <PersonSearchBox
                label="스타 A"
                selected={personA?.tmdbId ? personA : null}
                onSelect={handleSetA}
                placeholder="첫 번째 배우나 감독..."
                accentColor="var(--primary)"
              />
              {/* 중간 연결 아이콘 */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                paddingTop: 36, color: "var(--text-muted)",
              }}>
                <ArrowRight size={24} />
              </div>
              <PersonSearchBox
                label="스타 B"
                selected={personB?.tmdbId ? personB : null}
                onSelect={handleSetB}
                placeholder="두 번째 배우나 감독..."
                accentColor="var(--secondary)"
              />
            </div>

            {/* 버튼 영역 */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                id="find-connection-btn"
                onClick={findConnection}
                disabled={!canSearch || loading}
                className="btn btn-primary"
                style={{
                  padding: "14px 36px",
                  fontSize: "1rem",
                  opacity: (!canSearch || loading) ? 0.5 : 1,
                  cursor: (!canSearch || loading) ? "not-allowed" : "pointer",
                  gap: 10,
                }}
              >
                {loading
                  ? <><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> 연결 탐색 중...</>
                  : <><Search size={18} /> 연결 고리 찾기</>
                }
              </button>
            </div>
          </div>

          {/* ── 예시 쌍 ── */}
          <div style={{ textAlign: "center", marginBottom: 48, maxWidth: 800, margin: "0 auto 48px" }}>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 12 }}>
              예시로 시작해보기
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {EXAMPLE_PAIRS.map((pair, i) => (
                <button
                  key={i}
                  onClick={() => loadExample(pair)}
                  className="btn btn-ghost"
                  style={{ fontSize: "0.82rem", borderRadius: 100, gap: 6 }}
                >
                  <Shuffle size={13} />
                  {pair.a.name} ↔ {pair.b.name}
                </button>
              ))}
            </div>
          </div>

          {/* ── 결과 영역 ── */}
          {loading && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: "3rem", marginBottom: 20, animation: "spin 3s linear infinite" }}>🌌</div>
              <p style={{ color: "var(--text-muted)" }}>우주를 가로질러 연결 고리를 찾는 중...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {!loading && result && (
            <div style={{ maxWidth: 900, margin: "0 auto", animation: "fadeInUp 0.5s ease forwards" }}>
              {result.error && (
                <div style={{ textAlign: "center", padding: "40px", background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.2)", borderRadius: 16, color: "var(--accent-pink)" }}>
                  ⚠️ {result.error}
                </div>
              )}

              {!result.error && !result.found && (
                <div
                  className="glass-card animate-fade-in-up"
                  style={{ padding: "52px 40px", textAlign: "center" }}
                >
                  <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>🔭</div>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", marginBottom: 12 }}>
                    연결 고리를 찾지 못했습니다
                  </h2>
                  <p style={{ color: "var(--text-muted)", maxWidth: 380, margin: "0 auto", lineHeight: 1.7 }}>
                    두 인물이 너무 멀리 떨어져 있거나,
                    아직 데이터베이스에 연결 정보가 없습니다.
                    <br />더 많은 데이터가 쌓이면 연결될 수 있습니다!
                  </p>
                </div>
              )}

              {!result.error && result.found && result.path.length > 0 && (
                <div>
                  {/* 결과 배너 */}
                  <div
                    className="glass-card animate-fade-in-up"
                    style={{
                      padding: "28px 36px",
                      marginBottom: 32,
                      textAlign: "center",
                      background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(6,182,212,0.1) 100%)",
                      border: "1px solid rgba(124,58,237,0.3)",
                    }}
                  >
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 8 }}>연결 거리</div>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "clamp(2.5rem, 6vw, 4rem)",
                        fontWeight: 800,
                        background: "linear-gradient(135deg, var(--primary-light), var(--secondary))",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        lineHeight: 1,
                      }}>
                        {result.hops}
                      </span>
                      <span style={{ fontSize: "1.2rem", color: "var(--text-secondary)", fontWeight: 600 }}>단계</span>
                    </div>
                    <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                      {result.hops === 1
                        ? "🎉 직접 연결! 같은 작품에 출연했습니다."
                        : result.hops <= 2
                        ? "⚡ 이주 가까운 사이! 한 사람만 거치면 됩니다."
                        : result.hops <= 4
                        ? "🌟 꽤 가까운 우주적 연결입니다."
                        : "🌌 먼 거리지만 연결됩니다!"}
                    </p>
                  </div>

                  {/* 경로 비주얼 체인 */}
                  <div style={{ overflowX: "auto", paddingBottom: 16 }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: "max-content",
                      padding: "8px 4px",
                    }}>
                      {result.path.map((node, idx) => {
                        const isFirst = idx === 0;
                        const isLast  = idx === result.path.length - 1;
                        const isHighlightNode = (isFirst || isLast) && node.type === "person";

                        return (
                          <div key={`${node.type}-${node.tmdbId}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <PathNodeCard node={node} isHighlight={isHighlightNode} />
                            {idx < result.path.length - 1 && (
                              <ChevronRight
                                size={20}
                                color={idx % 2 === 0 ? "var(--primary-light)" : "var(--secondary)"}
                                style={{ flexShrink: 0 }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 연결 설명 텍스트 */}
                  <div
                    className="glass-card"
                    style={{ padding: "20px 24px", marginTop: 24 }}
                  >
                    <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                      {result.path
                        .filter((n) => n.type === "work")
                        .map((n, i) => (
                          <span key={i}>
                            {i > 0 && " → "}
                            <strong style={{ color: "var(--accent-gold)" }}>「{n.name}」</strong>
                          </span>
                        ))}{" "}
                      을(를) 거쳐{" "}
                      <strong style={{ color: "var(--primary-light)" }}>
                        {result.path.find((n) => n.type === "person")?.name}
                      </strong>
                      {"  "}→{"  "}
                      <strong style={{ color: "var(--secondary)" }}>
                        {[...result.path].reverse().find((n) => n.type === "person")?.name}
                      </strong>
                      이 연결됩니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 처음 방문 도움말 ── */}
          {!loading && !result && (
            <div style={{ textAlign: "center", paddingTop: 20, maxWidth: 640, margin: "0 auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 32, textAlign: "left" }}>
                {[
                  { icon: "🔍", title: "검색", desc: "위에서 두 인물을 각각 검색하세요" },
                  { icon: "⚡", title: "탐색", desc: "\"연결 고리 찾기\" 버튼을 누르세요" },
                  { icon: "🌌", title: "발견", desc: "공유 작품을 통한 연결 경로가 나타납니다" },
                ].map((s) => (
                  <div
                    key={s.title}
                    className="glass-card"
                    style={{ padding: "20px 18px" }}
                  >
                    <div style={{ fontSize: "1.6rem", marginBottom: 10 }}>{s.icon}</div>
                    <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)", marginBottom: 4 }}>{s.title}</p>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
