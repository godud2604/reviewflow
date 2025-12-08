-- =============================================
-- ReviewFlow Supabase Tables
-- =============================================

-- 1. Schedules 테이블
CREATE TABLE IF NOT EXISTS schedules (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '선정됨',
  platform TEXT,
  review_type TEXT,
  channel TEXT,
  category TEXT,
  region TEXT,
  visit_date TEXT,
  deadline TEXT,
  benefit INTEGER DEFAULT 0,
  income INTEGER DEFAULT 0,
  cost INTEGER DEFAULT 0,
  posting_link TEXT DEFAULT '',
  purchase_link TEXT DEFAULT '',
  guide_files JSONB DEFAULT '[]',
  memo TEXT DEFAULT '',
  reconfirm_reason TEXT,
  visit_review_checklist JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Todos 테이블
CREATE TABLE IF NOT EXISTS todos (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Channels 테이블 - 인플루언서의 SNS/블로그 채널 정보를 저장하는 테이블
CREATE TABLE IF NOT EXISTS channels (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  followers INTEGER DEFAULT 0,
  monthly_visitors INTEGER,
  avg_views INTEGER,
  avg_reach INTEGER,
  avg_engagement DECIMAL(5,2),
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Featured Posts 테이블 - 대표 게시글 관리 (포트폴리오/어필용)
CREATE TABLE IF NOT EXISTS featured_posts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  thumbnail TEXT,
  url TEXT,
  views INTEGER DEFAULT 0,
  channel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Extra Incomes 테이블 - 체험단 외 추가 수입 관리 
CREATE TABLE IF NOT EXISTS extra_incomes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  date TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Row Level Security (RLS) 정책
-- =============================================

-- 기존 정책 삭제 (있을 경우)
DROP POLICY IF EXISTS "Users can view own schedules" ON schedules;
DROP POLICY IF EXISTS "Users can insert own schedules" ON schedules;
DROP POLICY IF EXISTS "Users can update own schedules" ON schedules;
DROP POLICY IF EXISTS "Users can delete own schedules" ON schedules;

DROP POLICY IF EXISTS "Users can view own todos" ON todos;
DROP POLICY IF EXISTS "Users can insert own todos" ON todos;
DROP POLICY IF EXISTS "Users can update own todos" ON todos;
DROP POLICY IF EXISTS "Users can delete own todos" ON todos;

DROP POLICY IF EXISTS "Users can view own channels" ON channels;
DROP POLICY IF EXISTS "Users can insert own channels" ON channels;
DROP POLICY IF EXISTS "Users can update own channels" ON channels;
DROP POLICY IF EXISTS "Users can delete own channels" ON channels;

DROP POLICY IF EXISTS "Users can view own featured_posts" ON featured_posts;
DROP POLICY IF EXISTS "Users can insert own featured_posts" ON featured_posts;
DROP POLICY IF EXISTS "Users can update own featured_posts" ON featured_posts;
DROP POLICY IF EXISTS "Users can delete own featured_posts" ON featured_posts;

DROP POLICY IF EXISTS "Users can view own extra_incomes" ON extra_incomes;
DROP POLICY IF EXISTS "Users can insert own extra_incomes" ON extra_incomes;
DROP POLICY IF EXISTS "Users can update own extra_incomes" ON extra_incomes;
DROP POLICY IF EXISTS "Users can delete own extra_incomes" ON extra_incomes;

-- Schedules RLS
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedules" ON schedules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedules" ON schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedules" ON schedules
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedules" ON schedules
  FOR DELETE USING (auth.uid() = user_id);

-- Todos RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own todos" ON todos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own todos" ON todos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own todos" ON todos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own todos" ON todos
  FOR DELETE USING (auth.uid() = user_id);

-- Channels RLS
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own channels" ON channels
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own channels" ON channels
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own channels" ON channels
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own channels" ON channels
  FOR DELETE USING (auth.uid() = user_id);

-- Featured Posts RLS
ALTER TABLE featured_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own featured_posts" ON featured_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own featured_posts" ON featured_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own featured_posts" ON featured_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own featured_posts" ON featured_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Extra Incomes RLS
ALTER TABLE extra_incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extra_incomes" ON extra_incomes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own extra_incomes" ON extra_incomes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own extra_incomes" ON extra_incomes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own extra_incomes" ON extra_incomes
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 인덱스
-- =============================================

CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_deadline ON schedules(deadline);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);

CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);

CREATE INDEX IF NOT EXISTS idx_channels_user_id ON channels(user_id);

CREATE INDEX IF NOT EXISTS idx_featured_posts_user_id ON featured_posts(user_id);

CREATE INDEX IF NOT EXISTS idx_extra_incomes_user_id ON extra_incomes(user_id);

-- =============================================
-- Updated_at 자동 업데이트 트리거
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 기존 트리거 삭제 (있을 경우)
DROP TRIGGER IF EXISTS update_schedules_updated_at ON schedules;
DROP TRIGGER IF EXISTS update_todos_updated_at ON todos;
DROP TRIGGER IF EXISTS update_channels_updated_at ON channels;
DROP TRIGGER IF EXISTS update_featured_posts_updated_at ON featured_posts;
DROP TRIGGER IF EXISTS update_extra_incomes_updated_at ON extra_incomes;

CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_featured_posts_updated_at
  BEFORE UPDATE ON featured_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_extra_incomes_updated_at
  BEFORE UPDATE ON extra_incomes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
