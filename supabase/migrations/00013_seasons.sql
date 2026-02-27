-- Season-long points & standings system
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  points_config JSONB NOT NULL DEFAULT '{"1st": 3, "2nd": 2, "3rd": 1}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- Group members can view seasons
CREATE POLICY "Group members can view seasons"
  ON seasons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = seasons.group_id
        AND group_members.user_id = auth.uid()
    )
  );

-- Group admins can create seasons
CREATE POLICY "Group admins can create seasons"
  ON seasons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = seasons.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.role = 'admin'
    )
  );

-- Group admins can update seasons
CREATE POLICY "Group admins can update seasons"
  ON seasons FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = seasons.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.role = 'admin'
    )
  );

-- Group admins can delete seasons
CREATE POLICY "Group admins can delete seasons"
  ON seasons FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = seasons.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.role = 'admin'
    )
  );
