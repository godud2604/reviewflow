-- User profile categories (multi-select)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT ARRAY[]::text[];

-- Backfill nulls to empty array
UPDATE user_profiles
SET categories = ARRAY[]::text[]
WHERE categories IS NULL;
