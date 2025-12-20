-- =============================================
-- 신규 가입자 프로필에 PRO 기본값 설정
-- =============================================

ALTER TABLE user_profiles
  ALTER COLUMN tier SET DEFAULT 'pro',
  ALTER COLUMN tier_duration_months SET DEFAULT 1,
  ALTER COLUMN tier_expires_at SET DEFAULT (NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month';

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
    'pro',
    1,
    (NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month'
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
