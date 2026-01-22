-- =============================================
-- 쿠폰 재등록(영구) 방지를 위한 이력 테이블
-- =============================================

CREATE TABLE IF NOT EXISTS launch_event_referral_redemptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE launch_event_referral_redemptions ENABLE ROW LEVEL SECURITY;

-- 유저별 동일 코드 영구 중복 금지
CREATE UNIQUE INDEX IF NOT EXISTS launch_event_referral_redemptions_user_code_idx
  ON launch_event_referral_redemptions(user_id, code);

CREATE INDEX IF NOT EXISTS launch_event_referral_redemptions_user_id_idx
  ON launch_event_referral_redemptions(user_id);

CREATE INDEX IF NOT EXISTS launch_event_referral_redemptions_code_idx
  ON launch_event_referral_redemptions(code);
