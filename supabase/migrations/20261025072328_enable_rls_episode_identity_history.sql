-- Defense in depth only: preserve the existing table ACL and trusted
-- SECURITY DEFINER writer while denying any future accidental client grants.
ALTER TABLE public.episode_identity_history ENABLE ROW LEVEL SECURITY;
