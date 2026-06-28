-- ============================================================
-- Migration 004: whatalbum_daily_cards + whatalbum_user_activity
-- whatalbum.vercel.app 전용 — 매일의 "오늘의 앨범" 큐레이션
-- 같은 Supabase 프로젝트 내에서 frompangyo와 DB 공유
-- ============================================================

-- ============================================================
-- 매일의 큐레이션 앨범 카드 (핵심 테이블)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatalbum_daily_cards (
  id              SERIAL PRIMARY KEY,

  -- 날짜 & 순서
  display_date    DATE NOT NULL,          -- 표시할 날짜 (오늘의 앨범 날짜)
  display_order   INT NOT NULL DEFAULT 1, -- 1~5 순서 (Admin이 지정)

  -- 앨범 정보 (해외 앨범 포함 → artist_id 없을 수 있음)
  album_title     TEXT NOT NULL,
  album_title_ko  TEXT,
  artist_name     TEXT NOT NULL,
  artist_name_ko  TEXT,
  release_year    INT NOT NULL,           -- 원래 발매 연도
  release_date    DATE,                   -- 정확한 발매일
  album_cover_url TEXT,                   -- 앨범 커버 이미지 URL (Spotify 640px)

  -- 설명 (AI 생성 + Admin 수정)
  description     TEXT,                   -- 앨범 설명 (AI 초안 → Admin 수정)
  artist_bio      TEXT,                   -- 아티스트 간략 소개
  ai_generated    BOOLEAN DEFAULT true,   -- AI가 생성한 초안인지
  admin_edited    BOOLEAN DEFAULT false,  -- Admin이 수정했는지

  -- 미리듣기 (Spotify 30초 프리뷰)
  preview_url     TEXT,                   -- Spotify 30초 미리듣기 URL
  preview_track_name TEXT,                -- 미리듣기 트랙명 (표시용)
  spotify_album_id TEXT,                  -- Spotify Album ID

  -- 스트리밍 링크
  spotify_url     TEXT,
  apple_music_url TEXT,
  youtube_music_url TEXT,

  -- 메타
  genre           TEXT,                   -- 장르 태그 (Hip-Hop, Rock, K-Pop 등)
  language        TEXT DEFAULT 'ko',      -- ko, en, ja, es 등
  tags            TEXT[],                 -- 추가 태그 (legendary, debut 등)
  status          TEXT DEFAULT 'draft',   -- draft | published | archived

  -- 소셜 공유용 OG 메타
  og_title        TEXT,
  og_description  TEXT,

  -- 기존 Jitigravity 연동 (선택)
  kculture_artist_id TEXT,               -- Neo4j 노드 ID (K-Pop만, 해외는 NULL)
  album_release_id   INT REFERENCES album_releases(id), -- 기존 테이블 참조

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(display_date, display_order)    -- 같은 날 같은 순서 중복 방지
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_whatalbum_date
  ON whatalbum_daily_cards(display_date);

CREATE INDEX IF NOT EXISTS idx_whatalbum_status
  ON whatalbum_daily_cards(status, display_date);

CREATE INDEX IF NOT EXISTS idx_whatalbum_language
  ON whatalbum_daily_cards(language);

-- ============================================================
-- 유저 활동 로그 (나중에 분석용, 선택적)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatalbum_user_activity (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT,                       -- user_profiles.id (비로그인은 NULL)
  card_id     INT REFERENCES whatalbum_daily_cards(id),
  action      TEXT NOT NULL,              -- view | swipe | play | share | link_click
  metadata    JSONB,                      -- { platform: 'spotify', duration: 15 }
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatalbum_activity_card
  ON whatalbum_user_activity(card_id);

CREATE INDEX IF NOT EXISTS idx_whatalbum_activity_user
  ON whatalbum_user_activity(user_id);

-- ============================================================
-- Trigger: whatalbum_daily_cards.updated_at 자동 갱신
-- (update_updated_at_column 함수는 003에서 이미 생성됨)
-- ============================================================
CREATE TRIGGER whatalbum_daily_cards_updated_at
  BEFORE UPDATE ON whatalbum_daily_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS (Row Level Security)
-- 조회: 모두 허용 (published 카드는 누구나)
-- 수정: 서비스 Role만 (Admin API Route에서 사용)
-- ============================================================
ALTER TABLE whatalbum_daily_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatalbum_user_activity ENABLE ROW LEVEL SECURITY;

-- 카드: published만 일반 유저에게 노출
CREATE POLICY "whatalbum_cards_read_published"
  ON whatalbum_daily_cards FOR SELECT
  USING (status = 'published' OR auth.role() = 'service_role');

CREATE POLICY "whatalbum_cards_service_write"
  ON whatalbum_daily_cards FOR ALL
  USING (auth.role() = 'service_role');

-- 활동 로그: 삽입은 누구나 (비로그인도), 조회는 서비스만
CREATE POLICY "whatalbum_activity_insert"
  ON whatalbum_user_activity FOR INSERT
  WITH CHECK (true);

CREATE POLICY "whatalbum_activity_service_read"
  ON whatalbum_user_activity FOR SELECT
  USING (auth.role() = 'service_role');
