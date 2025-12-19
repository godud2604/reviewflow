-- =============================================
-- user_profiles 테이블에 프로필 이미지 경로 컬럼 추가
-- =============================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS profile_image_path TEXT;
