-- Add phone verification + daily summary settings to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verification_code TEXT,
  ADD COLUMN IF NOT EXISTS phone_verification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daily_summary_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS daily_summary_hour INT DEFAULT 8,
  ADD COLUMN IF NOT EXISTS daily_summary_minute INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_summary_last_sent_at TIMESTAMPTZ;
