-- =============================================
-- 모든 사용자를 FREE로 전환 (PRO 제거)
-- =============================================

ALTER TABLE user_profiles
  ALTER COLUMN tier SET DEFAULT 'free',
  ALTER COLUMN tier_duration_months SET DEFAULT 0,
  ALTER COLUMN tier_expires_at DROP DEFAULT;

UPDATE user_profiles
SET tier = 'free',
    tier_duration_months = 0,
    tier_expires_at = NULL
WHERE tier IS DISTINCT FROM 'free'
   OR tier_duration_months IS DISTINCT FROM 0
   OR tier_expires_at IS NOT NULL;

-- =============================================
-- 트리거 함수 업데이트
-- =============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    platforms,
    tier,
    tier_duration_months,
    tier_expires_at
  )
  VALUES (
    NEW.id,
    ARRAY['레뷰', '리뷰노트', '스타일씨', '리뷰플레이스'],
    'free',
    0,
    NULL
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

