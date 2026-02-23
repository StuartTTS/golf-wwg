-- Add 'invited' and 'declined' to round_players status check constraint
ALTER TABLE round_players DROP CONSTRAINT IF EXISTS round_players_status_check;
ALTER TABLE round_players ADD CONSTRAINT round_players_status_check
  CHECK (status IN ('invited', 'registered', 'confirmed', 'declined', 'playing', 'completed', 'withdrawn'));

-- RLS: Allow users to insert themselves as a round player when accepting a round invitation
-- (They must have a valid pending invitation for this round)
CREATE POLICY "Users can join round via invitation"
  ON round_players FOR INSERT
  WITH CHECK (
    round_players.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM invitations
      WHERE invitations.round_id = round_players.round_id
        AND invitations.type = 'round'
        AND invitations.email = (SELECT email FROM profiles WHERE id = auth.uid())
        AND invitations.status = 'pending'
    )
  );

-- RLS: Allow users to update their own round_player status (for RSVP accept/decline)
CREATE POLICY "Users can update own round player status"
  ON round_players FOR UPDATE
  USING (round_players.user_id = auth.uid());
