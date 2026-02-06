-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  default_tee_preference TEXT,
  current_handicap_index NUMERIC(4,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- COURSES
-- ============================================================
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  num_holes INT NOT NULL DEFAULT 18,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view courses"
  ON courses FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create courses"
  ON courses FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Creator can update courses"
  ON courses FOR UPDATE
  USING (auth.uid() = created_by);

-- ============================================================
-- TEE BOXES
-- ============================================================
CREATE TABLE tee_boxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  slope_rating NUMERIC(5,1) NOT NULL,
  course_rating NUMERIC(4,1) NOT NULL,
  total_yardage INT
);

ALTER TABLE tee_boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tee boxes"
  ON tee_boxes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create tee boxes"
  ON tee_boxes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Course creator can update tee boxes"
  ON tee_boxes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM courses WHERE courses.id = tee_boxes.course_id AND courses.created_by = auth.uid()
    )
  );

-- ============================================================
-- HOLES
-- ============================================================
CREATE TABLE holes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tee_box_id UUID NOT NULL REFERENCES tee_boxes(id) ON DELETE CASCADE,
  hole_number INT NOT NULL,
  par INT NOT NULL CHECK (par >= 3 AND par <= 6),
  yardage INT,
  handicap_index INT NOT NULL CHECK (handicap_index >= 1 AND handicap_index <= 18),
  UNIQUE (tee_box_id, hole_number)
);

ALTER TABLE holes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view holes"
  ON holes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create holes"
  ON holes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Course creator can update holes"
  ON holes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tee_boxes
      JOIN courses ON courses.id = tee_boxes.course_id
      WHERE tee_boxes.id = holes.tee_box_id AND courses.created_by = auth.uid()
    )
  );

CREATE POLICY "Course creator can delete holes"
  ON holes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tee_boxes
      JOIN courses ON courses.id = tee_boxes.course_id
      WHERE tee_boxes.id = holes.tee_box_id AND courses.created_by = auth.uid()
    )
  );

-- ============================================================
-- GROUPS
-- ============================================================
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  default_course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GROUP MEMBERS
-- ============================================================
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Group RLS policies (depend on group_members)
CREATE POLICY "Group members can view group"
  ON groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members WHERE group_members.group_id = groups.id AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Group admins can update group"
  ON groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id AND group_members.user_id = auth.uid() AND group_members.role = 'admin'
    )
  );

CREATE POLICY "Group admins can delete group"
  ON groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id AND group_members.user_id = auth.uid() AND group_members.role = 'admin'
    )
  );

-- Group members RLS
CREATE POLICY "Group members can view members"
  ON group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group admins can insert members"
  ON group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
    OR
    -- Allow first member (the creator) to add themselves
    NOT EXISTS (
      SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id
    )
  );

CREATE POLICY "Group admins can update members"
  ON group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

CREATE POLICY "Group admins can remove members"
  ON group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

-- ============================================================
-- ROUNDS
-- ============================================================
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id),
  tee_box_id UUID NOT NULL REFERENCES tee_boxes(id),
  round_date DATE NOT NULL,
  tee_time TIME,
  status TEXT NOT NULL CHECK (status IN ('upcoming', 'in_progress', 'completed')) DEFAULT 'upcoming',
  scoring_mode TEXT NOT NULL CHECK (scoring_mode IN ('shared', 'scorekeeper')) DEFAULT 'shared',
  scorekeeper_id UUID REFERENCES profiles(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view rounds"
  ON rounds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members WHERE group_members.group_id = rounds.group_id AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create rounds"
  ON rounds FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members WHERE group_members.group_id = rounds.group_id AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Round creator or admin can update rounds"
  ON rounds FOR UPDATE
  USING (
    rounds.created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = rounds.group_id AND group_members.user_id = auth.uid() AND group_members.role = 'admin'
    )
  );

-- ============================================================
-- ROUND PLAYERS
-- ============================================================
CREATE TABLE round_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  tee_box_id UUID NOT NULL REFERENCES tee_boxes(id),
  handicap_index_at_round NUMERIC(4,1),
  course_handicap INT,
  playing_handicap INT,
  status TEXT NOT NULL CHECK (status IN ('registered', 'confirmed', 'playing', 'completed', 'withdrawn')) DEFAULT 'registered',
  UNIQUE (round_id, user_id)
);

ALTER TABLE round_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view round players"
  ON round_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rounds
      JOIN group_members ON group_members.group_id = rounds.group_id
      WHERE rounds.id = round_players.round_id AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can join rounds"
  ON round_players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rounds
      JOIN group_members ON group_members.group_id = rounds.group_id
      WHERE rounds.id = round_players.round_id AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Round creator or admin can manage players"
  ON round_players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM rounds
      WHERE rounds.id = round_players.round_id
        AND (
          rounds.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = rounds.group_id AND group_members.user_id = auth.uid() AND group_members.role = 'admin'
          )
        )
    )
  );

CREATE POLICY "Round creator or admin can remove players"
  ON round_players FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM rounds
      WHERE rounds.id = round_players.round_id
        AND (
          rounds.created_by = auth.uid()
          OR round_players.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = rounds.group_id AND group_members.user_id = auth.uid() AND group_members.role = 'admin'
          )
        )
    )
  );

-- ============================================================
-- SCORES
-- ============================================================
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id),
  hole_number INT NOT NULL CHECK (hole_number >= 1 AND hole_number <= 36),
  strokes INT CHECK (strokes >= 1 AND strokes <= 20),
  putts INT CHECK (putts >= 0 AND putts <= 10),
  fairway_hit BOOLEAN,
  gir BOOLEAN,
  up_and_down BOOLEAN,
  entered_by UUID NOT NULL REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, player_id, hole_number)
);

CREATE INDEX idx_scores_round ON scores(round_id);
CREATE INDEX idx_scores_player ON scores(player_id);

ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Enable Realtime for scores
ALTER PUBLICATION supabase_realtime ADD TABLE scores;

CREATE POLICY "Group members can view scores"
  ON scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rounds
      JOIN group_members ON group_members.group_id = rounds.group_id
      WHERE rounds.id = scores.round_id AND group_members.user_id = auth.uid()
    )
  );

-- Shared mode: any round player can upsert
CREATE POLICY "Round players can upsert scores in shared mode"
  ON scores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rounds
      JOIN round_players ON round_players.round_id = rounds.id
      WHERE rounds.id = scores.round_id
        AND rounds.scoring_mode = 'shared'
        AND round_players.user_id = auth.uid()
    )
    OR
    -- Scorekeeper mode: only the scorekeeper
    EXISTS (
      SELECT 1 FROM rounds
      WHERE rounds.id = scores.round_id
        AND rounds.scoring_mode = 'scorekeeper'
        AND rounds.scorekeeper_id = auth.uid()
    )
  );

CREATE POLICY "Score entry permissions for update"
  ON scores FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM rounds
      JOIN round_players ON round_players.round_id = rounds.id
      WHERE rounds.id = scores.round_id
        AND rounds.scoring_mode = 'shared'
        AND round_players.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM rounds
      WHERE rounds.id = scores.round_id
        AND rounds.scoring_mode = 'scorekeeper'
        AND rounds.scorekeeper_id = auth.uid()
    )
  );

-- ============================================================
-- GAMES
-- ============================================================
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  name TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  results JSONB,
  money_per_unit NUMERIC(8,2),
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'finalized')) DEFAULT 'pending',
  holes TEXT NOT NULL DEFAULT 'all',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view games"
  ON games FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rounds
      JOIN group_members ON group_members.group_id = rounds.group_id
      WHERE rounds.id = games.round_id AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create games"
  ON games FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rounds
      JOIN group_members ON group_members.group_id = rounds.group_id
      WHERE rounds.id = games.round_id AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Round creator or admin can update games"
  ON games FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM rounds
      WHERE rounds.id = games.round_id
        AND (
          rounds.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = rounds.group_id AND group_members.user_id = auth.uid() AND group_members.role = 'admin'
          )
        )
    )
  );

CREATE POLICY "Round creator or admin can delete games"
  ON games FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM rounds
      WHERE rounds.id = games.round_id
        AND (
          rounds.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = rounds.group_id AND group_members.user_id = auth.uid() AND group_members.role = 'admin'
          )
        )
    )
  );

-- ============================================================
-- GAME TEAMS
-- ============================================================
CREATE TABLE game_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  team_order INT
);

ALTER TABLE game_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game viewers can view teams"
  ON game_teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM games
      JOIN rounds ON rounds.id = games.round_id
      JOIN group_members ON group_members.group_id = rounds.group_id
      WHERE games.id = game_teams.game_id AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Game creators can manage teams"
  ON game_teams FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games
      JOIN rounds ON rounds.id = games.round_id
      JOIN group_members ON group_members.group_id = rounds.group_id
      WHERE games.id = game_teams.game_id AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Game creators can delete teams"
  ON game_teams FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM games
      JOIN rounds ON rounds.id = games.round_id
      JOIN group_members ON group_members.group_id = rounds.group_id
      WHERE games.id = game_teams.game_id AND group_members.user_id = auth.uid()
    )
  );

-- ============================================================
-- GAME PLAYERS
-- ============================================================
CREATE TABLE game_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id),
  team_id UUID REFERENCES game_teams(id) ON DELETE SET NULL,
  playing_handicap INT
);

ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game viewers can view game players"
  ON game_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM games
      JOIN rounds ON rounds.id = games.round_id
      JOIN group_members ON group_members.group_id = rounds.group_id
      WHERE games.id = game_players.game_id AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Game creators can manage game players"
  ON game_players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games
      JOIN rounds ON rounds.id = games.round_id
      JOIN group_members ON group_members.group_id = rounds.group_id
      WHERE games.id = game_players.game_id AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Game creators can delete game players"
  ON game_players FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM games
      JOIN rounds ON rounds.id = games.round_id
      JOIN group_members ON group_members.group_id = rounds.group_id
      WHERE games.id = game_players.game_id AND group_members.user_id = auth.uid()
    )
  );

-- ============================================================
-- HANDICAP RECORDS
-- ============================================================
CREATE TABLE handicap_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  handicap_index NUMERIC(4,1) NOT NULL,
  differentials_used JSONB NOT NULL DEFAULT '[]',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_handicap_records_user ON handicap_records(user_id, calculated_at DESC);

ALTER TABLE handicap_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own handicap records"
  ON handicap_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert handicap records"
  ON handicap_records FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- INVITATIONS
-- ============================================================
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('group', 'round')),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  invited_by UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invited user or group admin can view invitations"
  ON invitations FOR SELECT
  USING (
    invitations.email = (SELECT email FROM profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = invitations.group_id AND group_members.user_id = auth.uid() AND group_members.role = 'admin'
    )
  );

CREATE POLICY "Group admins can create invitations"
  ON invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = invitations.group_id AND group_members.user_id = auth.uid() AND group_members.role = 'admin'
    )
  );

CREATE POLICY "Invited user or admin can update invitations"
  ON invitations FOR UPDATE
  USING (
    invitations.email = (SELECT email FROM profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = invitations.group_id AND group_members.user_id = auth.uid() AND group_members.role = 'admin'
    )
  );

-- ============================================================
-- SETTLEMENTS
-- ============================================================
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES profiles(id),
  payee_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(8,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'settled')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Involved parties can view settlements"
  ON settlements FOR SELECT
  USING (
    auth.uid() = payer_id OR auth.uid() = payee_id
    OR EXISTS (
      SELECT 1 FROM rounds
      JOIN group_members ON group_members.group_id = rounds.group_id
      WHERE rounds.id = settlements.round_id AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create settlements"
  ON settlements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rounds
      JOIN group_members ON group_members.group_id = rounds.group_id
      WHERE rounds.id = settlements.round_id AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Involved parties can update settlements"
  ON settlements FOR UPDATE
  USING (auth.uid() = payer_id OR auth.uid() = payee_id);
