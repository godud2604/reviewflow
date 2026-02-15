ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS guideline_daily_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guideline_daily_count_date DATE;
