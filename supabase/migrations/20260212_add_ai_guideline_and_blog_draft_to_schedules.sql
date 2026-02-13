ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS guideline_analysis JSONB,
  ADD COLUMN IF NOT EXISTS original_guideline_text TEXT,
  ADD COLUMN IF NOT EXISTS blog_draft TEXT,
  ADD COLUMN IF NOT EXISTS blog_draft_options JSONB,
  ADD COLUMN IF NOT EXISTS blog_draft_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_schedules_blog_draft_updated_at ON schedules(blog_draft_updated_at);
