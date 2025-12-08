-- =============================================
-- User Profiles 테이블 추가
-- =============================================

-- User Profiles 테이블 - 유저 프로필 및 플랫폼 관리
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  platforms TEXT[] DEFAULT ARRAY['레뷰', '리뷰노트', '스타일씨', '리뷰플레이스'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Row Level Security (RLS) 정책
-- =============================================

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- Updated_at 자동 업데이트 트리거
-- =============================================

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 유저 생성 시 자동으로 프로필 생성하는 트리거
-- =============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, platforms)
  VALUES (NEW.id, ARRAY['레뷰', '리뷰노트', '스타일씨', '리뷰플레이스']);
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 기존 유저에 대해 프로필 생성 (이미 있는 유저용)
-- =============================================

INSERT INTO user_profiles (id, platforms)
SELECT id, ARRAY['레뷰', '리뷰노트', '스타일씨', '리뷰플레이스']
FROM auth.users
WHERE id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO NOTHING;

-- 기존 프로필 중 빈 platforms 배열을 가진 경우 기본값으로 업데이트
UPDATE user_profiles
SET platforms = ARRAY['레뷰', '리뷰노트', '스타일씨', '리뷰플레이스']
WHERE platforms = '{}' OR platforms IS NULL;