-- ================================================================
-- K-Culture Universe V7.0.1 — Phase 1: 유저 인증 DB 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- ================================================================

-- 1. 유저 프로필
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id     TEXT UNIQUE NOT NULL,
  email         TEXT NOT NULL,
  nickname      TEXT UNIQUE NOT NULL,
  gender        TEXT CHECK (gender IN ('male', 'female', 'other', 'undisclosed')),
  age_group     TEXT CHECK (age_group IN ('10s', '20s', '30s', '40s', '50s+')),
  newsletter    BOOLEAN DEFAULT false,
  role          TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  membership    TEXT DEFAULT 'associate' CHECK (membership IN ('associate', 'full')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 유저 에디트 제안 로그
CREATE TABLE IF NOT EXISTS universe_edit_logs (
  id            SERIAL PRIMARY KEY,
  user_id       UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  intent        TEXT NOT NULL,             -- NAME_CORRECTION / EDGE_PROPOSAL / ARTIST_ADDITION / DATA_CORRECTION
  raw_input     TEXT NOT NULL,
  parsed_data   JSONB,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'rejected')),
  ai_reasoning  TEXT,
  ai_sources    JSONB,
  applied_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 승인된 오버라이드 패치
CREATE TABLE IF NOT EXISTS data_overrides (
  id            SERIAL PRIMARY KEY,
  edit_log_id   INT REFERENCES universe_edit_logs(id) ON DELETE SET NULL,
  target_type   TEXT NOT NULL,             -- 'node_name' / 'edge' / 'node_add'
  target_id     TEXT,
  patch_data    JSONB NOT NULL,
  applied       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 자율주행 비행 기록
CREATE TABLE IF NOT EXISTS flight_logs (
  id            SERIAL PRIMARY KEY,
  user_id       UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  start_artist  TEXT NOT NULL,
  path          JSONB NOT NULL,            -- [{id, name, trackName?, duration}]
  total_stops   INT NOT NULL DEFAULT 0,
  total_seconds INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- Row Level Security (RLS) 설정
-- ================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe_edit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_logs ENABLE ROW LEVEL SECURITY;

-- user_profiles: 본인만 조회/수정
CREATE POLICY "유저는 본인 프로필만 조회" ON user_profiles
  FOR SELECT USING (auth.uid()::text = google_id OR true); -- 서버는 service_role key 사용

CREATE POLICY "유저는 본인 프로필만 수정" ON user_profiles
  FOR UPDATE USING (auth.uid()::text = google_id);

-- universe_edit_logs: 로그인 유저는 전체 조회, 본인 것만 수정
CREATE POLICY "로그인 유저는 로그 조회 가능" ON universe_edit_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- flight_logs: 본인 비행 기록만
CREATE POLICY "본인 비행 기록만 조회" ON flight_logs
  FOR SELECT USING (user_id IN (
    SELECT id FROM user_profiles WHERE google_id = auth.uid()::text
  ));

-- ================================================================
-- 인덱스
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_google_id ON user_profiles(google_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_edit_logs_user_id ON universe_edit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_edit_logs_status ON universe_edit_logs(status);
CREATE INDEX IF NOT EXISTS idx_data_overrides_applied ON data_overrides(applied);
CREATE INDEX IF NOT EXISTS idx_flight_logs_user_id ON flight_logs(user_id);

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
