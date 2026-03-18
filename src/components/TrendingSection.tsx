/**
 * TrendingSection — 트렌딩 인물 & 작품 섹션
 * Server Component: 데이터를 직접 fetch (Next.js 캐싱 활용)
 */
import Link from "next/link";
import Image from "next/image";
import {
  getTrendingKoreanPeople,
  getTrendingKoreanMovies,
  getTrendingKoreanShows,
  getTmdbImage,
  type TmdbPerson,
  type TmdbWork,
} from "@/lib/tmdb";
import { Star, Tv, Film, Mic } from "lucide-react";

// ── 인물 카드 ─────────────────────────────────────────
function PersonCard({ person }: { person: TmdbPerson }) {
  const imgSrc = getTmdbImage(person.profile_path, "w342");
  const dept = person.known_for_department;
  const deptLabel = dept === "Acting" ? "배우" : dept === "Directing" ? "감독" : "아티스트";
  const badgeClass = dept === "Acting" ? "badge-actor" : "badge-singer";

  return (
    <Link
      href={`/person/${person.id}`}
      aria-label={`${person.name} 상세 보기`}
      title={person.name}
      style={{
        display: "block",
        cursor: "pointer",
        textDecoration: "none",
      }}
    >
      <article
        className="glass-card"
        style={{ overflow: "hidden", padding: 0 }}
      >
        {/* 프로필 이미지 */}
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
              alt={`${person.name} 프로필 사진`}
              fill
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 160px"
              style={{ objectFit: "cover" }}
              loading="lazy"
            />
          ) : (
            /* 이미지 없을 때 플레이스홀더 */
            <div style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))",
            }}>
              <Mic size={40} color="var(--primary-light)" aria-hidden="true" />
            </div>
          )}

          {/* 하단 그라디언트 오버레이 */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(10,14,26,0.95) 0%, transparent 45%)",
          }} aria-hidden="true" />

          {/* 부서 배지 */}
          <div style={{ position: "absolute", bottom: 10, left: 10 }}>
            <span className={`badge ${badgeClass}`} style={{ fontSize: "0.7rem" }}>
              {deptLabel}
            </span>
          </div>
        </div>

        {/* 텍스트 정보 */}
        <div style={{ padding: "12px 14px" }}>
          <h3 style={{
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: "0.9rem",
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {person.name}
          </h3>
          {person.known_for?.[0] && (
            <p style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              marginTop: 4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {person.known_for[0].title ?? person.known_for[0].name}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}

// ── 작품 카드 ─────────────────────────────────────────
function WorkCard({ work, type }: { work: TmdbWork; type: "movie" | "tv" }) {
  const imgSrc = getTmdbImage(work.poster_path, "w342");
  const title = work.title ?? work.name ?? "제목 없음";
  const year = (work.release_date ?? work.first_air_date ?? "").slice(0, 4);
  const Icon = type === "movie" ? Film : Tv;
  const badgeClass = type === "movie" ? "badge-movie" : "badge-drama";
  const label = type === "movie" ? "영화" : "드라마";

  return (
    <Link
      href={`/work/${type}-${work.id}`}
      aria-label={`${title} 상세 보기`}
      title={title}
      style={{ display: "block", cursor: "pointer", textDecoration: "none" }}
    >
      <article className="glass-card" style={{ overflow: "hidden", padding: 0 }}>
        <div style={{
          aspectRatio: "2/3",
          position: "relative",
          background: "var(--bg-elevated)",
          overflow: "hidden",
        }}>
          {imgSrc ? (
            <Image
              src={imgSrc}
              alt={`${title} 포스터`}
              fill
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 160px"
              style={{ objectFit: "cover" }}
              loading="lazy"
            />
          ) : (
            <div style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(124,58,237,0.1))",
            }}>
              <Icon size={40} color="var(--accent-gold)" aria-hidden="true" />
            </div>
          )}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(10,14,26,0.95) 0%, transparent 45%)",
          }} aria-hidden="true" />

          <div style={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}>
            <span style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              background: "rgba(0,0,0,0.7)",
              borderRadius: 6,
              padding: "3px 7px",
              fontSize: "0.72rem",
              color: "#fcd34d",
              fontWeight: 600,
            }}>
              <Star size={10} fill="#fcd34d" aria-hidden="true" />
              {work.vote_average.toFixed(1)}
            </span>
          </div>

          <div style={{ position: "absolute", bottom: 10, left: 10 }}>
            <span className={`badge ${badgeClass}`} style={{ fontSize: "0.7rem" }}>
              {label}
            </span>
          </div>
        </div>

        <div style={{ padding: "12px 14px" }}>
          <h3 style={{
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: "0.9rem",
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {title}
          </h3>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
            {year}
          </p>
        </div>
      </article>
    </Link>
  );
}

// ── 섹션 헤더 ─────────────────────────────────────────
function SectionHeader({ id, title, subtitle }: {
  id: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 id={id} style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)",
        fontWeight: 700,
        marginBottom: 6,
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>{subtitle}</p>
      )}
    </div>
  );
}

// ── 메인 트렌딩 섹션 (Server Component) ───────────────
export default async function TrendingSection() {
  // 병렬 fetch (nextjs-best-practices: 여러 요청 동시 실행)
  const [people, movies, shows] = await Promise.all([
    getTrendingKoreanPeople(),
    getTrendingKoreanMovies(),
    getTrendingKoreanShows(),
  ]);

  const topPeople = people.slice(0, 8);
  const topMovies = movies.slice(0, 6);
  const topShows  = shows.slice(0, 6);

  const GRID_STYLE: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: "20px",
  };

  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      {/* 구분선 */}
      <div className="divider" aria-hidden="true" />

      {/* 인물 트렌딩 */}
      <section
        aria-labelledby="trending-people-heading"
        style={{ padding: "60px 0 40px" }}
      >
        <div className="container">
          <SectionHeader
            id="trending-people-heading"
            title="🔥 트렌딩 인물"
            subtitle="이번 주 가장 주목받는 K-Culture 아이콘"
          />
          {topPeople.length > 0 ? (
            <div style={GRID_STYLE}>
              {topPeople.map((p) => (
                <PersonCard key={p.id} person={p} />
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>현재 데이터를 불러오는 중입니다.</p>
          )}
        </div>
      </section>

      <div className="divider" aria-hidden="true" />

      {/* 영화 트렌딩 */}
      <section
        aria-labelledby="trending-movies-heading"
        style={{ padding: "60px 0 40px" }}
      >
        <div className="container">
          <SectionHeader
            id="trending-movies-heading"
            title="🎬 트렌딩 한국 영화"
            subtitle="지금 전 세계가 주목하는 한국 영화"
          />
          {topMovies.length > 0 ? (
            <div style={GRID_STYLE}>
              {topMovies.map((m) => (
                <WorkCard key={m.id} work={m} type="movie" />
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>현재 데이터를 불러오는 중입니다.</p>
          )}
        </div>
      </section>

      <div className="divider" aria-hidden="true" />

      {/* 드라마 트렌딩 */}
      <section
        aria-labelledby="trending-shows-heading"
        style={{ padding: "60px 0" }}
      >
        <div className="container">
          <SectionHeader
            id="trending-shows-heading"
            title="📺 트렌딩 K-드라마"
            subtitle="지금 화제인 한국 드라마"
          />
          {topShows.length > 0 ? (
            <div style={GRID_STYLE}>
              {topShows.map((s) => (
                <WorkCard key={s.id} work={s} type="tv" />
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>현재 데이터를 불러오는 중입니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
