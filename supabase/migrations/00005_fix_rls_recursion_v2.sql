-- Migration: Fix RLS infinite recursion on group_members / profiles
--
-- Root cause: The profiles SELECT policy (from 00003/00004) calls shares_group_with()
-- which queries group_members. The group_members SELECT policy self-references
-- group_members. When triggered from another table's policy context, PostgreSQL
-- detects this as infinite recursion.
--
-- Fix: Replace the self-referencing group_members SELECT policy with a
-- SECURITY DEFINER function that bypasses RLS entirely.

-- 1. Create a SECURITY DEFINER helper for group_members SELECT
--    This checks if the current user shares a group with the target row.
CREATE OR REPLACE FUNCTION is_group_member(check_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Replace group_members SELECT policy to use the function (no self-reference)
DROP POLICY IF EXISTS "Group members can view members" ON group_members;
CREATE POLICY "Group members can view members"
  ON group_members FOR SELECT
  USING (is_group_member(group_id));

-- 3. Also fix group_members INSERT/UPDATE/DELETE policies that self-reference
CREATE OR REPLACE FUNCTION is_group_admin(check_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id AND user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Group admins can insert members" ON group_members;
CREATE POLICY "Group admins can insert members"
  ON group_members FOR INSERT
  WITH CHECK (
    is_group_admin(group_id)
    OR NOT EXISTS (
      SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id
    )
  );

DROP POLICY IF EXISTS "Group admins can update members" ON group_members;
CREATE POLICY "Group admins can update members"
  ON group_members FOR UPDATE
  USING (is_group_admin(group_id));

DROP POLICY IF EXISTS "Group admins can remove members" ON group_members;
CREATE POLICY "Group admins can remove members"
  ON group_members FOR DELETE
  USING (is_group_admin(group_id));

-- 4. Ensure profiles SELECT policy uses the SECURITY DEFINER function
DROP POLICY IF EXISTS "Users can view own profile and group members" ON profiles;
CREATE POLICY "Users can view own profile and group members"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR shares_group_with(id));
