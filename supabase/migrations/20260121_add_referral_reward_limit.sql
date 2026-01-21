-- =============================================
-- 친구 초대 보상 월 1회 제한용 컬럼 추가
-- =============================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS launch_event_referral_rewarded_at TIMESTAMPTZ;
