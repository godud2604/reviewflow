-- =============================================
-- Add schedule channels column to user_profiles
-- =============================================

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS schedule_channels TEXT[] DEFAULT ARRAY[
  '네이버블로그',
  '인스타그램',
  '인스타그램 reels',
  '네이버클립',
  '유튜브 shorts',
  '구매평'
]::text[];

-- Backfill any existing rows that lack schedule channels
UPDATE user_profiles
SET schedule_channels = ARRAY[
  '네이버블로그',
  '인스타그램',
  '인스타그램 reels',
  '네이버클립',
  '유튜브 shorts',
  '구매평'
]::text[]
WHERE schedule_channels IS NULL OR schedule_channels = '{}'::text[];
