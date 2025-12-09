-- Add visit_time column for 방문형 스케줄 시간 기록
ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS visit_time TEXT;
