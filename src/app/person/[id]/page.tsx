/**
 * /person/[id] — 인물 상세 페이지 (Server Component)
 * TMDb 인물 상세 + 출연작 목록을 표시합니다.
 */
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import GraphUniverseWrapper from "@/components/GraphUniverseWrapper";
import { getPersonDetail, getTmdbImage } from "@/lib/tmdb";
import type { Metadata } from "next";
import { ArrowLeft, Star, Calendar, MapPin, Film, Tv } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const person = await getPersonDetail(Number(id));
  if (!person) return { title: "인물 정보 없음" };
  return {
    title: person.name,
    description: person.biography?.slice(0, 150) || `${person.name}의 K-Culture 연결 관계를 탐험하세요.`,
  };
}

export default async function PersonPage({ params }: Props) {
  const { id } = await params;
  const person = await getPersonDetail(Number(id));
  if (!person) notFound();

  const profileImg = getTmdbImage(person.profile_path, "w500");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const credits = (person as any).combined_credits;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cast: any[] = credits?.cast ?? [];

  // 평점 높은 순 출연작 상위 12개
  const topWorks = [...cast]
    .filter((c) => c.poster_path && (c.media_type === "movie" || c.media_type === "tv"))
    .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
    .slice(0, 12);

  const dept = person.known_for_department;
  const deptLabel =
    dept === "Acting" ? "배우" : dept === "Directing" ? "감독" : "아티스트";
  const badgeClass =
    dept === "Acting" ? "badge-actor" : "badge-singer";

  return (
    <>
      <Header />
      <div
        className="page-content"
        style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}
      >
        {/* 배경 블러 이미지 (cinematic effect) */}
        {profileImg && (
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 0,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <Image
              src={profileImg}
              alt=""
              fill
              style={{ objectFit: "cover", filter: "blur(80px) brightness(0.15)", transform: "scale(1.1)" }}
              priority
            />
          </div>
        )}

        <div className="container" style={{ paddingTop: 40, paddingBottom: 80, position: "relative", zIndex: 1 }}>
          {/* 뒤로가기 */}
          <Link
            href="/explore"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: "var(--text-muted)",
              fontSize: "0.9rem",
              marginBottom: 32,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-primary)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
          >
            <ArrowLeft size={16} />
            탐색으로 돌아가기
          </Link>

          {/* ── 인물 헤더 섹션 ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "40px",
              marginBottom: 56,
              alignItems: "start",
            }}
          >
            {/* 프로필 이미지 */}
            <div
              style={{
                width: "clamp(140px, 20vw, 220px)",
                borderRadius: 20,
                overflow: "hidden",
                border: "2px solid var(--border)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                flexShrink: 0,
              }}
            >
              {profileImg ? (
                <div style={{ aspectRatio: "2/3", position: "relative" }}>
                  <Image
                    src={profileImg}
                    alt={`${person.name} 프로필`}
                    fill
                    style={{ objectFit: "cover" }}
                    priority
                  />
                </div>
              ) : (
                <div
                  style={{
                    aspectRatio: "2/3",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--bg-elevated)",
                    fontSize: "4rem",
                  }}
                >
                  🎭
                </div>
              )}
            </div>

            {/* 인물 정보 */}
            <div style={{ paddingTop: 8 }}>
              <span className={`badge ${badgeClass}`} style={{ marginBottom: 16 }}>
                {deptLabel}
              </span>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
                  fontWeight: 700,
                  marginBottom: 16,
                  lineHeight: 1.1,
                }}
              >
                {person.name}
              </h1>

              {/* 메타 정보 */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 24px", marginBottom: 24 }}>
                {person.birthday && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.88rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <Calendar size={14} color="var(--text-muted)" />
                    {person.birthday}
                    {person.deathday && ` ~ ${person.deathday}`}
                  </span>
                )}
                {person.place_of_birth && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.88rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <MapPin size={14} color="var(--text-muted)" />
                    {person.place_of_birth}
                  </span>
                )}
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "0.88rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  <Star size={14} color="var(--accent-gold)" />
                  인기도 {Math.round(person.popularity)}
                </span>
              </div>

              {/* 바이오그래피 */}
              {person.biography && (
                <p
                  style={{
                    fontSize: "0.92rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.8,
                    maxWidth: 640,
                    display: "-webkit-box",
                    WebkitLineClamp: 5,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {person.biography}
                </p>
              )}

              {/* 별칭 */}
              {person.also_known_as?.length > 0 && (
                <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {person.also_known_as.slice(0, 4).map((name) => (
                    <span
                      key={name}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 100,
                        background: "var(--bg-glass)",
                        border: "1px solid var(--border)",
                        fontSize: "0.78rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── 출연작 섹션 ── */}
          {topWorks.length > 0 && (
            <section aria-labelledby="works-heading">
              <h2
                id="works-heading"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  marginBottom: 24,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                🎬 주요 출연작
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: 20,
                }}
              >
                {topWorks.map((work) => {
                  const wpImg = getTmdbImage(work.poster_path, "w342");
                  const title = work.title ?? work.name ?? "제목 없음";
                  const year = (work.release_date ?? work.first_air_date ?? "").slice(0, 4);
                  const isMovie = work.media_type === "movie";

                  return (
                    <Link
                      key={`${work.media_type}-${work.id}`}
                      href={`/work/${work.media_type}-${work.id}`}
                      style={{ display: "block", textDecoration: "none" }}
                    >
                      <article
                        className="glass-card"
                        style={{ overflow: "hidden", padding: 0, transition: "transform 0.2s" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = "translateY(-4px)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = "translateY(0)")}
                      >
                        <div style={{ aspectRatio: "2/3", position: "relative", background: "var(--bg-elevated)" }}>
                          {wpImg ? (
                            <Image src={wpImg} alt={title} fill sizes="160px" style={{ objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }}>
                              {isMovie ? "🎬" : "📺"}
                            </div>
                          )}
                          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,14,26,0.9) 0%, transparent 50%)" }} />
                          {work.vote_average > 0 && (
                            <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.75)", borderRadius: 6, padding: "2px 6px", fontSize: "0.68rem", color: "#fcd34d", fontWeight: 700, display: "flex", alignItems: "center", gap: 2 }}>
                              <Star size={8} fill="#fcd34d" /> {work.vote_average.toFixed(1)}
                            </div>
                          )}
                          <div style={{ position: "absolute", bottom: 6, left: 6 }}>
                            <span className={`badge ${isMovie ? "badge-movie" : "badge-drama"}`} style={{ fontSize: "0.62rem" }}>
                              {isMovie ? <Film size={9} /> : <Tv size={9} />}
                              {isMovie ? " 영화" : " 드라마"}
                            </span>
                          </div>
                        </div>
                        <div style={{ padding: "10px 12px" }}>
                          <p style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {title}
                          </p>
                          {year && <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>{year}</p>}
                        </div>
                      </article>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── 3D 우주 관계망 섹션 ── */}
          <section aria-labelledby="graph-heading" style={{ marginTop: 56 }}>
            <div style={{ marginBottom: 24 }}>
              <h2
                id="graph-heading"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                🌌 우주 관계망
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                드래그로 회전 · 스크롤로 줌 · 클릭으로 이동 · 우클릭(인물)으로 관계망 확장
              </p>
            </div>
            <GraphUniverseWrapper initialPersonId={Number(id)} height={560} />
          </section>
        </div>
      </div>

      {/* 반응형: 모바일에서 그리드 2열 */}
      <style>{`
        @media (max-width: 640px) {
          .person-header-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
