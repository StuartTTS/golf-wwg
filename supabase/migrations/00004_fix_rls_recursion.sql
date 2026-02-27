-- Migration: Fix RLS recursion between profiles and group_members
--
-- The profiles SELECT policy from 00003 queries group_members, which creates
-- a cross-table RLS recursion chain when inserting into group_members.
-- Fix: use a SECURITY DEFINER function that bypasses RLS on group_members.

-- Helper function: bypasses RLS to check group co-membership
CREATE OR REPLACE FUNCTION shares_group_with(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = target_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Replace the profiles SELECT policy to use the function
DROP POLICY IF EXISTS "Users can view own profile and group members" ON profiles;
CREATE POLICY "Users can view own profile and group members"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR shares_group_with(profiles.id));
