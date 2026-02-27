-- Fix: handle_new_user() trigger failed with "relation profiles does not exist"
-- because the SECURITY DEFINER function had no search_path set. When running
-- in the auth schema context, the unqualified "profiles" table could not be
-- resolved. This adds SET search_path = public and qualifies the table name.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
