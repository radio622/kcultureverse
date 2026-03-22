-- ================================================================
-- V7.0.1 긴급 수정 패치 (2026-03-22)
-- Supabase SQL Editor에서 실행하세요
-- ================================================================

-- 1. nickname NOT NULL 제약 제거 (온보딩 전에도 행 생성 가능하도록)
ALTER TABLE user_profiles ALTER COLUMN nickname DROP NOT NULL;

-- 2. email NOT NULL은 유지하되, 중복 허용 (구글 가족 계정 대비)
-- (변경 없음)

-- 3. 현재 가입된 계정의 role을 admin으로 업데이트
-- 아래 이메일을 본인 구글 이메일로 바꾸세요!
UPDATE user_profiles
SET role = 'admin', membership = 'full'
WHERE email = 'YOUR_EMAIL@gmail.com';  -- ← 여기를 본인 이메일로 변경

-- 4. 확인
SELECT id, email, nickname, role, membership FROM user_profiles;
