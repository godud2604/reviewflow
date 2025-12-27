-- =============================================
-- ReviewFlow Supabase Tables / Feedback Messages
-- =============================================

CREATE TABLE IF NOT EXISTS feedback_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own feedback" ON feedback_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own feedback" ON feedback_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" ON feedback_messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_user_id ON feedback_messages(user_id);
