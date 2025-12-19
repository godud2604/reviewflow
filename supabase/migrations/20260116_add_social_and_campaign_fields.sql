-- =============================================
-- user_profiles 테이블에 SNS 계정과 최근 캠페인 컬럼 추가
-- =============================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS sns_blog TEXT,
  ADD COLUMN IF NOT EXISTS sns_threads TEXT,
  ADD COLUMN IF NOT EXISTS sns_instagram TEXT,
  ADD COLUMN IF NOT EXISTS sns_tiktok TEXT,
  ADD COLUMN IF NOT EXISTS sns_youtube TEXT,
  ADD COLUMN IF NOT EXISTS recent_campaigns JSONB DEFAULT '[]'::jsonb NOT NULL;
