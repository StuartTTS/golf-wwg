-- Add profile_completed column so new users can be redirected to complete setup.
-- Default true so existing users are unaffected.
ALTER TABLE profiles ADD COLUMN profile_completed BOOLEAN NOT NULL DEFAULT true;

-- Update trigger: new registrations start with profile_completed = false
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, profile_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
