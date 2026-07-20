-- ============================================================
-- SOLO PLAY  ("Tee It Up Now" — Type A)
-- ============================================================
-- Adds the "implicit personal group" model so a single user can start a
-- solo round with no group ceremony, plus a round_type marker to tell solo
-- rounds apart from group rounds.
--
-- Design decision (see docs/phase1-type-a-spec.md): rounds.group_id stays
-- NOT NULL. Rather than rework every group-gated RLS policy, each user gets
-- one auto-provisioned "personal" group that their solo rounds hang off of.
-- All existing RLS "just works" because the user is a member of that group.
-- ============================================================

-- 1. PERSONAL GROUP FLAG -------------------------------------------------
ALTER TABLE groups
  ADD COLUMN is_personal BOOLEAN NOT NULL DEFAULT false;

-- Enforce at most one personal group per user (the group's creator owns it).
CREATE UNIQUE INDEX idx_groups_one_personal_per_user
  ON groups(created_by) WHERE is_personal;

-- 2. ROUND TYPE ----------------------------------------------------------
ALTER TABLE rounds
  ADD COLUMN round_type TEXT NOT NULL DEFAULT 'group'
    CHECK (round_type IN ('group', 'solo'));

-- Fast "my recent rounds / recently played courses" lookups.
CREATE INDEX idx_rounds_created_by_date
  ON rounds(created_by, round_date DESC);

-- 3. GET-OR-CREATE PERSONAL GROUP ---------------------------------------
-- SECURITY DEFINER so it can create the group + admin membership atomically
-- regardless of the caller's RLS context. Returns the caller's personal
-- group id, creating it on first use. Idempotent — safe to call every time
-- "Tee It Up Now" starts a round.
CREATE OR REPLACE FUNCTION get_or_create_personal_group()
RETURNS UUID AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_group UUID;
  v_name  TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_group
  FROM public.groups
  WHERE created_by = v_user AND is_personal
  LIMIT 1;

  IF v_group IS NOT NULL THEN
    RETURN v_group;
  END IF;

  SELECT COALESCE(display_name, 'My') INTO v_name
  FROM public.profiles WHERE id = v_user;

  INSERT INTO public.groups (name, description, is_personal, created_by)
  VALUES (v_name || '''s Solo Rounds', 'Personal solo rounds', true, v_user)
  RETURNING id INTO v_group;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group, v_user, 'admin')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN v_group;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. AUTO-CREATE PERSONAL GROUP ON SIGNUP -------------------------------
-- Extend handle_new_user (preserving the 00002 search_path fix and the
-- 00008 profile_completed=false onboarding flag) to seed a personal group +
-- admin membership for every new user, so the group exists before their
-- first "Tee It Up Now".
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_group UUID;
  v_name  TEXT;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, display_name, email, profile_completed)
  VALUES (NEW.id, v_name, NEW.email, false);

  INSERT INTO public.groups (name, description, is_personal, created_by)
  VALUES (v_name || '''s Solo Rounds', 'Personal solo rounds', true, NEW.id)
  RETURNING id INTO v_group;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group, NEW.id, 'admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. BACKFILL EXISTING USERS --------------------------------------------
-- Give every existing user a personal group if they don't already have one.
INSERT INTO public.groups (name, description, is_personal, created_by)
SELECT COALESCE(p.display_name, 'My') || '''s Solo Rounds', 'Personal solo rounds', true, p.id
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.groups g WHERE g.created_by = p.id AND g.is_personal
);

INSERT INTO public.group_members (group_id, user_id, role)
SELECT g.id, g.created_by, 'admin'
FROM public.groups g
WHERE g.is_personal
  AND NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = g.id AND gm.user_id = g.created_by
  );
