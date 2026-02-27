-- Add external_id and source columns for API-imported courses
ALTER TABLE courses ADD COLUMN external_id TEXT;
ALTER TABLE courses ADD COLUMN source TEXT DEFAULT 'manual';

-- Index for looking up by external_id
CREATE INDEX idx_courses_external_id ON courses(external_id) WHERE external_id IS NOT NULL;
