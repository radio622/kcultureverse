"use client";

/**
 * /explore — 검색 및 탐색 페이지 (Client Component)
 * URL 쿼리 파라미터 ?q= 를 읽어 자동 검색 실행
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import { Search, Loader2, Film, Tv, Users, Star } from "lucide-react";
import type { TmdbPerson, TmdbWork } from "@/lib/tmdb";
import { getTmdbImage } from "@/lib/tmdb";

// ── 필터 탭 ──────────────────────────────────────────
type Tab = "all" | "people" | "movies" | "shows";
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "all",    label: "전체",    icon: <Star size={14} /> },
  { id: "people", label: "인물",    icon: <Users size={14} /> },
  { id: "movies", label: "영화",    icon: <Film size={14} /> },
  { id: "shows",  label: "드라마",  icon: <Tv size={14} /> },
];

// ── 검색 결과 타입 ──────────────────────────────────
interface SearchResult {
  people: TmdbPerson[];
  movies: TmdbWork[];
  shows: TmdbWork[];
}

// ── 인물 카드 ────────────────────────────────────────
function PersonCard({ person }: { person: TmdbPerson }) {
  const imgSrc = getTmdbImage(person.profile_path, "w342");
  const dept = person.known_for_department;
  const deptLabel =
    dept === "Acting" ? "배우" : dept === "Directing" ? "감독" : "아티스트";
  const badgeClass =
    dept === "Acting" ? "badge-actor" : "badge-singer";

  return (
    <Link
      href={`/person/${person.id}`}
      style={{ display: "block", textDecoration: "none" }}
    >
      <article
        className="glass-card"
        style={{
          overflow: "hidden",
          padding: 0,
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 12px 40px rgba(124,58,237,0.2)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        <div
          style={{
            aspectRatio: "2/3",
            position: "relative",
            background: "var(--bg-elevated)",
            overflow: "hidden",
          }}
        >
          {imgSrc ? (
            <Image
              src={imgSrc}
              alt={`${person.name} 프로필`}
              fill
              sizes="(max-width: 640px) 45vw, 200px"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))",
                fontSize: "3rem",
              }}
            >
              🎭
            </div>
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(10,14,26,0.95) 0%, transparent 50%)",
            }}
          />
          <div style={{ position: "absolute", bottom: 8, left: 8 }}>
            <span className={`badge ${badgeClass}`} style={{ fontSize: "0.65rem" }}>
              {deptLabel}
            </span>
          </div>
        </div>
        <div style={{ padding: "12px 14px" }}>
          <h3
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: "0.88rem",
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {person.name}
          </h3>
          {person.known_for?.[0] && (
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                marginTop: 3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {person.known_for[0].title ?? person.known_for[0].name}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}

// ── 작품 카드 ────────────────────────────────────────
function WorkCard({ work, type }: { work: TmdbWork; type: "movie" | "tv" }) {
  const imgSrc = getTmdbImage(work.poster_path, "w342");
  const title = work.title ?? work.name ?? "제목 없음";
  const year = (work.release_date ?? work.first_air_date ?? "").slice(0, 4);
  const badgeClass = type === "movie" ? "badge-movie" : "badge-drama";
  const label = type === "movie" ? "영화" : "드라마";

  return (
    <Link
      href={`/work/${type}-${work.id}`}
      style={{ display: "block", textDecoration: "none" }}
    >
      <article
        className="glass-card"
        style={{
          overflow: "hidden",
          padding: 0,
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 12px 40px rgba(6,182,212,0.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        <div
          style={{
            aspectRatio: "2/3",
            position: "relative",
            background: "var(--bg-elevated)",
            overflow: "hidden",
          }}
        >
          {imgSrc ? (
            <Image
              src={imgSrc}
              alt={`${title} 포스터`}
              fill
              sizes="(max-width: 640px) 45vw, 200px"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(124,58,237,0.1))",
                fontSize: "3rem",
              }}
            >
              🎬
            </div>
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(10,14,26,0.95) 0%, transparent 50%)",
            }}
          />
          {work.vote_average > 0 && (
            <div
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                display: "flex",
                alignItems: "center",
                gap: 3,
                background: "rgba(0,0,0,0.7)",
                borderRadius: 6,
                padding: "3px 7px",
                fontSize: "0.7rem",
                color: "#fcd34d",
                fontWeight: 600,
              }}
            >
              <Star size={9} fill="#fcd34d" /> {work.vote_average.toFixed(1)}
            </div>
          )}
          <div style={{ position: "absolute", bottom: 8, left: 8 }}>
            <span className={`badge ${badgeClass}`} style={{ fontSize: "0.65rem" }}>
              {label}
            </span>
          </div>
        </div>
        <div style={{ padding: "12px 14px" }}>
          <h3
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: "0.88rem",
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </h3>
          {year && (
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 3 }}>
              {year}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}

// ── 스켈레톤 ─────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 20 }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i}>
          <div className="skeleton" style={{ aspectRatio: "2/3", borderRadius: 12, marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 16, width: "80%", marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 12, width: "50%" }} />
        </div>
      ))}
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────
export default function ExplorePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);
  const [inputVal, setInputVal] = useState(initialQ);
  const [tab, setTab] = useState<Tab>("all");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 검색 실행 ────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      if (!res.ok) throw new Error("검색 실패");
      const data: SearchResult = await res.json();
      setResults(data);
    } catch {
      setError("검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  // URL ?q= 변경 시 자동 검색
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setQuery(q);
    setInputVal(q);
    if (q) doSearch(q);
  }, [searchParams, doSearch]);

  // 입력 디바운스
  const handleInput = (val: string) => {
    setInputVal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(val);
      router.replace(val.trim() ? `/explore?q=${encodeURIComponent(val.trim())}` : "/explore", { scroll: false });
    }, 400);
  };

  // 탭에 따라 표시할 아이템
  const people  = results?.people ?? [];
  const movies  = results?.movies ?? [];
  const shows   = results?.shows  ?? [];
  const totalCount = people.length + movies.length + shows.length;

  const GRID: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: "20px",
  };

  return (
    <>
      <Header />
      <div className="page-content" style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>
        <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>

          {/* ── 페이지 헤더 ── */}
          <div style={{ marginBottom: 32 }}>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.5rem, 3vw, 2rem)",
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              🔍 탐색하기
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              배우, 가수, 영화, 드라마를 검색해 K-Culture 유니버스를 탐험하세요
            </p>
          </div>

          {/* ── 검색창 ── */}
          <div style={{ position: "relative", maxWidth: 600, marginBottom: 32 }}>
            <div
              style={{
                position: "absolute",
                left: 18,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
              }}
            >
              {loading
                ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                : <Search size={20} />}
            </div>
            <input
              ref={inputRef}
              id="explore-search"
              type="search"
              autoComplete="off"
              className="input-field"
              value={inputVal}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  setQuery(inputVal);
                  doSearch(inputVal);
                  router.replace(
                    inputVal.trim() ? `/explore?q=${encodeURIComponent(inputVal.trim())}` : "/explore",
                    { scroll: false }
                  );
                }
              }}
              placeholder="배우, 드라마, 가수 이름 검색..."
              aria-label="K-Culture 통합 검색"
              style={{
                paddingLeft: 52,
                paddingRight: 20,
                fontSize: "1rem",
                padding: "16px 20px 16px 52px",
                borderRadius: 14,
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>

          {/* ── 필터 탭 ── */}
          {results && (
            <div
              role="tablist"
              aria-label="결과 필터"
              style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}
            >
              {TABS.map((t) => {
                const count =
                  t.id === "all"    ? totalCount :
                  t.id === "people" ? people.length :
                  t.id === "movies" ? movies.length : shows.length;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.id)}
                    className={active ? "btn btn-primary" : "btn btn-ghost"}
                    style={{
                      padding: "8px 16px",
                      fontSize: "0.85rem",
                      minHeight: 36,
                      gap: 6,
                    }}
                  >
                    {t.icon}
                    {t.label}
                    <span
                      style={{
                        background: active ? "rgba(255,255,255,0.25)" : "var(--bg-elevated)",
                        borderRadius: "100px",
                        padding: "1px 8px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── 결과 영역 ── */}
          {/* 로딩 */}
          {loading && <Skeleton />}

          {/* 에러 */}
          {!loading && error && (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "var(--accent-pink)",
                background: "rgba(236,72,153,0.08)",
                borderRadius: 16,
                border: "1px solid rgba(236,72,153,0.2)",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* 빈 상태 — 검색 전 */}
          {!loading && !error && !query.trim() && (
            <div style={{ textAlign: "center", paddingTop: 80 }}>
              <div style={{ fontSize: "4rem", marginBottom: 20 }}>🌌</div>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.4rem",
                  marginBottom: 12,
                }}
              >
                무엇이든 검색해보세요
              </h2>
              <p style={{ color: "var(--text-muted)", marginBottom: 32 }}>
                좋아하는 배우, 가수, 드라마, 영화 이름을 입력하면<br />
                K-Culture 유니버스에서 찾아드립니다
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {["기생충", "블랙핑크", "BTS", "이준기", "오징어게임", "송강호"].map((ex) => (
                  <button
                    key={ex}
                    className="btn btn-ghost"
                    onClick={() => {
                      setInputVal(ex);
                      handleInput(ex);
                    }}
                    style={{ borderRadius: 100, fontSize: "0.85rem" }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 결과 없음 */}
          {!loading && !error && query.trim() && results && totalCount === 0 && (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔭</div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", marginBottom: 8 }}>
                &apos;{query}&apos; 에 대한 결과가 없습니다
              </h2>
              <p style={{ color: "var(--text-muted)" }}>
                다른 검색어로 시도해보세요
              </p>
            </div>
          )}

          {/* 실제 결과 */}
          {!loading && !error && results && totalCount > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>

              {/* 인물 */}
              {(tab === "all" || tab === "people") && people.length > 0 && (
                <section aria-labelledby="result-people-heading">
                  <h2
                    id="result-people-heading"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "1.1rem",
                      marginBottom: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Users size={18} color="var(--primary-light)" />
                    인물
                    <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.9rem" }}>
                      ({people.length}명)
                    </span>
                  </h2>
                  <div style={GRID}>
                    {people.map((p) => (
                      <PersonCard key={p.id} person={p} />
                    ))}
                  </div>
                </section>
              )}

              {/* 영화 */}
              {(tab === "all" || tab === "movies") && movies.length > 0 && (
                <section aria-labelledby="result-movies-heading">
                  <h2
                    id="result-movies-heading"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "1.1rem",
                      marginBottom: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Film size={18} color="var(--accent-gold)" />
                    영화
                    <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.9rem" }}>
                      ({movies.length}편)
                    </span>
                  </h2>
                  <div style={GRID}>
                    {movies.map((m) => (
                      <WorkCard key={m.id} work={m} type="movie" />
                    ))}
                  </div>
                </section>
              )}

              {/* 드라마 */}
              {(tab === "all" || tab === "shows") && shows.length > 0 && (
                <section aria-labelledby="result-shows-heading">
                  <h2
                    id="result-shows-heading"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "1.1rem",
                      marginBottom: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Tv size={18} color="var(--accent-pink)" />
                    드라마
                    <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.9rem" }}>
                      ({shows.length}편)
                    </span>
                  </h2>
                  <div style={GRID}>
                    {shows.map((s) => (
                      <WorkCard key={s.id} work={s} type="tv" />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
