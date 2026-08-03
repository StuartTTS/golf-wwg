-- Let you see the profile of anyone you share a ROUND with.
--
-- "Game Time" / roster rounds live on the creator's PERSONAL group, so players
-- added from a roster are not group members of each other. The profiles SELECT
-- policy only exposed your own profile + group-mates (shares_group_with), so a
-- registered member's profile embed came back NULL for a viewer who shared only
-- the round (not a group) with them. That crashed the scorecard / play pages
-- (which dereferenced rp.profiles.id without a guard) and showed round-mates as
-- "Unknown" on other pages.
--
-- SECURITY DEFINER so the round_players lookup bypasses RLS (no policy
-- recursion), mirroring shares_group_with (migrations 00004/00005).

CREATE OR REPLACE FUNCTION public.shares_round_with(target uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.round_players me
    JOIN public.round_players them ON them.round_id = me.round_id
    WHERE me.user_id = auth.uid()
      AND them.user_id = target
  );
$$;

GRANT EXECUTE ON FUNCTION public.shares_round_with(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile and group members" ON public.profiles;
CREATE POLICY "Users can view own profile and group members"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR shares_group_with(id)
    OR shares_round_with(id)
  );
