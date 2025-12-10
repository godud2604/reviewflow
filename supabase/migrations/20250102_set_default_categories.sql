-- Set default categories for user_profiles
ALTER TABLE user_profiles
  ALTER COLUMN categories SET DEFAULT ARRAY[
    '맛집/식품',
    '뷰티/바디케어',
    '출산/육아',
    '반려동물',
    '생활/리빙',
    '주방/가전'
  ]::text[];

-- Backfill empty/null categories to defaults
UPDATE user_profiles
SET categories = ARRAY[
  '맛집/식품',
  '뷰티/바디케어',
  '출산/육아',
  '반려동물',
  '생활/리빙',
  '주방/가전'
]::text[]
WHERE categories IS NULL OR categories = '{}'::text[];
