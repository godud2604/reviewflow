ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS last_guideline_analysis_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_blog_draft_generated_at TIMESTAMPTZ;
