-- ============================================================
-- Migration 003: album_releases + daily_verification_logs
-- Phase 3 — "오늘의 우주" 기능
-- ============================================================

-- 앨범 발매일 테이블
CREATE TABLE IF NOT EXISTS album_releases (
  id                  SERIAL PRIMARY KEY,
  artist_id           TEXT        NOT NULL,          -- v5-layout.json 노드 id
  artist_name         TEXT        NOT NULL,          -- 영문 공식명
  artist_name_ko      TEXT,                          -- 한글 공식명
  album_title         TEXT        NOT NULL,
  album_title_ko      TEXT,                          -- 한글 앨범명 (있으면)
  album_type          TEXT        DEFAULT 'Album',   -- Album | Single | EP | Compilation | OST
  release_date        DATE        NOT NULL,          -- first-release-date (MusicBrainz 기준)
  mbid                TEXT,                          -- MusicBrainz 릴리즈 MBID
  source              TEXT        DEFAULT 'musicbrainz', -- musicbrainz | manual | admin
  verified            BOOLEAN     DEFAULT false,
  verified_at         TIMESTAMPTZ,
  verification_source TEXT,                          -- 'cron_gpt', 'admin_manual', 'namu_wiki' 등
  verification_note   TEXT,                          -- 검증 메모
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 월/일 기준 빠른 조회를 위한 인덱스 (오늘의 우주 핵심)
CREATE INDEX IF NOT EXISTS idx_album_mmdd
  ON album_releases (
    EXTRACT(MONTH FROM release_date),
    EXTRACT(DAY FROM release_date)
  );

CREATE INDEX IF NOT EXISTS idx_album_artist_id
  ON album_releases (artist_id);

CREATE INDEX IF NOT EXISTS idx_album_verified
  ON album_releases (verified, release_date);

-- ============================================================
-- CRON 일일 검증 로그
-- Vercel CRON: 하루 5건씩 순차 처리 (Hobby 10초 제한 대응)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_verification_logs (
  id            SERIAL PRIMARY KEY,
  run_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  total_albums  INT         DEFAULT 0,   -- 검증 대상 총수
  verified      INT         DEFAULT 0,   -- 이번 배치 검증 완료
  corrected     INT         DEFAULT 0,   -- 날짜 수정된 건수
  status        TEXT        DEFAULT 'pending', -- pending | running | done | error
  llm_model     TEXT,                    -- 사용한 LLM 모델명
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  log_text      TEXT,                    -- 상세 로그 (JSON 문자열)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Trigger: album_releases.updated_at 자동 갱신
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER album_releases_updated_at
  BEFORE UPDATE ON album_releases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS (Row Level Security)
-- 조회는 모두 허용, 수정은 서비스 Role만
-- ============================================================
ALTER TABLE album_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_verification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "album_releases_read_all"
  ON album_releases FOR SELECT USING (true);

CREATE POLICY "album_releases_service_write"
  ON album_releases FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "verif_logs_read_all"
  ON daily_verification_logs FOR SELECT USING (true);

CREATE POLICY "verif_logs_service_write"
  ON daily_verification_logs FOR ALL
  USING (auth.role() = 'service_role');
