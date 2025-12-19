-- =============================================
-- user_profiles 테이블에 등급 관련 컬럼 추가
-- =============================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS tier_duration_months INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMPTZ;

-- 이미 존재하는 사용자에 대해서는 tier 값을 명시적으로 채웁니다.
UPDATE user_profiles
SET tier = 'free'
WHERE tier IS NULL;

UPDATE user_profiles
SET tier_duration_months = 0
WHERE tier_duration_months IS NULL;

UPDATE user_profiles
SET tier_expires_at = NULL
WHERE tier_expires_at IS NULL;
