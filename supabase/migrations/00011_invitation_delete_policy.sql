-- ============================================================
-- Migration 00011: Add DELETE RLS policy for invitations
-- ============================================================
-- Group admins need to be able to delete pending invitations.
-- The table had SELECT/INSERT/UPDATE policies but was missing
-- a DELETE policy, causing silent no-ops on delete attempts.
-- ============================================================

CREATE POLICY "Group admins can delete invitations"
  ON invitations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = invitations.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
  ));
