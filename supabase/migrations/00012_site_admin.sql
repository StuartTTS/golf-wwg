-- ============================================================
-- Migration 00012: Add is_site_admin flag to profiles
-- ============================================================
-- Allows designated users to perform site-wide admin actions
-- like deleting user accounts.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN is_site_admin BOOLEAN NOT NULL DEFAULT false;

-- Set initial site admin (Stuart Herron)
UPDATE profiles
SET is_site_admin = true
WHERE email = 'stuart@trophytechsupport.com';
