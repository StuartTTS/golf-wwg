-- Add registration status to rounds table
ALTER TABLE rounds
  ADD COLUMN registration_status TEXT NOT NULL DEFAULT 'open';

ALTER TABLE rounds
  ADD CONSTRAINT rounds_registration_status_check
  CHECK (registration_status IN ('open', 'closed'));
