-- =============================================
-- 후기 반려 사유 저장 컬럼 추가
-- =============================================

ALTER TABLE launch_event_mission_submissions
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
