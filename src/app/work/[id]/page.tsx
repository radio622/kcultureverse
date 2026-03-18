/**
 * /work/[id] — 작품 상세 페이지 (Server Component)
 * URL 형태: /work/movie-12345  또는 /work/tv-67890
 * TMDb 영화 또는 드라마 상세 정보를 표시합니다.
 */
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import { getMovieDetail, getShowDetail, getTmdbImage } from "@/lib/tmdb";
import type { Metadata } from "next";
import { ArrowLeft, Star, Clock, Calendar, Globe, Users } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [type, tmdbId] = id.split("-") as ["movie" | "tv", string];
  const work =
    type === "movie"
      ? await getMovieDetail(Number(tmdbId))
      : await getShowDetail(Number(tmdbId));
  if (!work) return { title: "작품 정보 없음" };
  const title = work.title ?? work.name ?? "";
  return {
    title,
    description:
      work.overview?.slice(0, 150) ||
      `${title}의 K-Culture 연결 관계를 탐험하세요.`,
  };
}

export default async function WorkPage({ params }: Props) {
  const { id } = await params;
  const parts = id.split("-");
  const type = parts[0] as "movie" | "tv";
  const tmdbId = Number(parts.slice(1).join("-")); // 하이픈이 id에도 있을 수 있음

  const work =
    type === "movie"
      ? await getMovieDetail(tmdbId)
      : await getShowDetail(tmdbId);
  if (!work) notFound();

  const title = work.title ?? work.name ?? "제목 없음";
  const year = (work.release_date ?? work.first_air_date ?? "").slice(0, 4);
  const backdropImg = getTmdbImage(work.backdrop_path, "original");
  const posterImg = getTmdbImage(work.poster_path, "w500");
  const isMovie = type === "movie";

  // 출연진 상위 12명
  const cast = work.credits?.cast?.slice(0, 12) ?? [];

  return (
    <>
      <Header />
      <div style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>

        {/* ── 배경 배너 이미지 ── */}
        {backdropImg && (
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 0,
              pointerEvents: "none",
            }}
          >
            <Image
              src={backdropImg}
              alt=""
              fill
              style={{ objectFit: "cover", filter: "blur(60px) brightness(0.12)", transform: "scale(1.05)" }}
              priority
            />
          </div>
        )}
        {backdropImg && (
          <div
            aria-hidden="true"
            style={{
              position: "relative",
              width: "100%",
              height: "clamp(200px, 35vw, 420px)",
              overflow: "hidden",
              zIndex: 1,
            }}
          >
            <Image
              src={backdropImg}
              alt={`${title} 백드롭`}
              fill
              style={{ objectFit: "cover" }}
              priority
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to bottom, rgba(10,14,26,0.1) 0%, rgba(10,14,26,0.7) 70%, var(--bg-base) 100%)",
              }}
            />
          </div>
        )}

        <div
          className="container page-content"
          style={{
            position: "relative",
            zIndex: 1,
            paddingTop: backdropImg ? 0 : 40,
            paddingBottom: 80,
            marginTop: backdropImg ? "-120px" : 0,
          }}
        >
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
          >
            <ArrowLeft size={16} />
            탐색으로 돌아가기
          </Link>

          {/* ── 작품 헤더 ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "36px",
              marginBottom: 48,
              alignItems: "start",
            }}
          >
            {/* 포스터 */}
            <div
              style={{
                width: "clamp(120px, 18vw, 200px)",
                borderRadius: 16,
                overflow: "hidden",
                border: "2px solid var(--border)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                flexShrink: 0,
              }}
            >
              {posterImg ? (
                <div style={{ aspectRatio: "2/3", position: "relative" }}>
                  <Image
                    src={posterImg}
                    alt={`${title} 포스터`}
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
                  {isMovie ? "🎬" : "📺"}
                </div>
              )}
            </div>

            {/* 작품 정보 */}
            <div style={{ paddingTop: 8 }}>
              <span
                className={`badge ${isMovie ? "badge-movie" : "badge-drama"}`}
                style={{ marginBottom: 14 }}
              >
                {isMovie ? "🎬 영화" : "📺 드라마"}
              </span>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
                  fontWeight: 700,
                  lineHeight: 1.15,
                  marginBottom: 8,
                }}
              >
                {title}
              </h1>

              {work.tagline && (
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontStyle: "italic",
                    fontSize: "1rem",
                    marginBottom: 20,
                  }}
                >
                  &ldquo;{work.tagline}&rdquo;
                </p>
              )}

              {/* 메타 배지 */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px", marginBottom: 20 }}>
                {work.vote_average > 0 && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem", color: "#fcd34d" }}>
                    <Star size={14} fill="#fcd34d" />
                    {work.vote_average.toFixed(1)} / 10
                    {work.vote_count > 0 && (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                        ({work.vote_count.toLocaleString()}명)
                      </span>
                    )}
                  </span>
                )}
                {year && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                    <Calendar size={14} color="var(--text-muted)" />
                    {year}
                  </span>
                )}
                {isMovie && work.runtime && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                    <Clock size={14} color="var(--text-muted)" />
                    {work.runtime}분
                  </span>
                )}
                {!isMovie && work.number_of_seasons && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                    <Clock size={14} color="var(--text-muted)" />
                    {work.number_of_seasons}시즌 · {work.number_of_episodes}화
                  </span>
                )}
                {work.production_countries?.[0] && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                    <Globe size={14} color="var(--text-muted)" />
                    {work.production_countries[0].name}
                  </span>
                )}
              </div>

              {/* 장르 */}
              {work.genres?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
                  {work.genres.map((g) => (
                    <span
                      key={g.id}
                      style={{
                        padding: "3px 12px",
                        borderRadius: 100,
                        background: "var(--bg-glass)",
                        border: "1px solid var(--border)",
                        fontSize: "0.8rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {/* 줄거리 */}
              {work.overview && (
                <p
                  style={{
                    fontSize: "0.92rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.8,
                    maxWidth: 640,
                  }}
                >
                  {work.overview}
                </p>
              )}
            </div>
          </div>

          {/* ── 출연진 섹션 ── */}
          {cast.length > 0 && (
            <section aria-labelledby="cast-heading">
              <h2
                id="cast-heading"
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
                <Users size={20} color="var(--primary-light)" />
                출연진
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: 16,
                }}
              >
                {cast.map((actor) => {
                  const actorImg = getTmdbImage(actor.profile_path, "w185");
                  return (
                    <Link
                      key={actor.id}
                      href={`/person/${actor.id}`}
                      style={{ display: "block", textDecoration: "none" }}
                    >
                      <div
                        className="glass-card hover-effect"
                        style={{
                          overflow: "hidden",
                          padding: 0,
                        }}
                      >
                        <div
                          style={{
                            aspectRatio: "1/1",
                            position: "relative",
                            background: "var(--bg-elevated)",
                            overflow: "hidden",
                          }}
                        >
                          {actorImg ? (
                            <Image
                              src={actorImg}
                              alt={actor.name}
                              fill
                              sizes="130px"
                              style={{ objectFit: "cover", objectPosition: "top" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "2rem",
                              }}
                            >
                              🎭
                            </div>
                          )}
                        </div>
                        <div style={{ padding: "8px 10px" }}>
                          <p
                            style={{
                              fontWeight: 600,
                              fontSize: "0.78rem",
                              color: "var(--text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {actor.name}
                          </p>
                          {actor.character && (
                            <p
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--text-muted)",
                                marginTop: 2,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {actor.character}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
