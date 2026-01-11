-- Add deadline_templates to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS deadline_templates JSONB DEFAULT '[]';

-- Replace old deadline columns with new additional_deadlines column in schedules table
ALTER TABLE schedules 
DROP COLUMN IF EXISTS draft_deadline,
DROP COLUMN IF EXISTS revision_deadline,
ADD COLUMN IF NOT EXISTS additional_deadlines JSONB DEFAULT '[]';

-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_schedules_draft_deadline;
DROP INDEX IF EXISTS idx_schedules_revision_deadline;

-- Add index for better query performance on additional_deadlines
CREATE INDEX IF NOT EXISTS idx_schedules_additional_deadlines ON schedules USING GIN (additional_deadlines);
