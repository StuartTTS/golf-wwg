-- ============================================================
-- PROFILES: optional phone number
-- ============================================================
-- Phone is an OPTIONAL contact captured when a player sets up their profile
-- (notably when joining a game by GameID). Email stays the durable identity /
-- claim key; phone is just a contact the Commish can copy to text an invite.
-- Integrated SMS is a later premium feature. See docs/gameid-join-roles.md.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
