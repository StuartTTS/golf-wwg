-- Migration: Fix groups SELECT policy to allow creator to see their own group
--
-- Root cause: createGroup() inserts a group then calls .select().single().
-- PostgREST applies the SELECT RLS policy to the returned row, but the
-- creator hasn't been added to group_members yet (that happens after the
-- insert). Result: SELECT returns 0 rows and .single() errors.
--
-- Fix: Allow the group creator (created_by = auth.uid()) to always SELECT
-- their group, and use the SECURITY DEFINER is_group_member() function
-- (from migration 00005) instead of an inline EXISTS to avoid RLS recursion.

DROP POLICY IF EXISTS "Group members can view group" ON groups;
CREATE POLICY "Group members can view group"
  ON groups FOR SELECT
  USING (
    created_by = auth.uid()
    OR is_group_member(id)
  );
