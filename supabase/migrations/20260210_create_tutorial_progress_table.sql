-- =============================================
-- Tutorial Progress Table
-- =============================================

CREATE TABLE IF NOT EXISTS tutorial_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutorial_key TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, tutorial_key)
);

ALTER TABLE tutorial_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tutorial progress" ON tutorial_progress;
DROP POLICY IF EXISTS "Users can insert own tutorial progress" ON tutorial_progress;
DROP POLICY IF EXISTS "Users can update own tutorial progress" ON tutorial_progress;
DROP POLICY IF EXISTS "Users can delete own tutorial progress" ON tutorial_progress;

CREATE POLICY "Users can view own tutorial progress" ON tutorial_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tutorial progress" ON tutorial_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tutorial progress" ON tutorial_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tutorial progress" ON tutorial_progress
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tutorial_progress_user_id ON tutorial_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_progress_key ON tutorial_progress(tutorial_key);
