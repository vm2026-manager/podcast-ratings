-- Test-harness-only setup for the isolated local Supabase Postgres instance.
-- Supabase applies roles.sql during privileged database bootstrap.
DO $baseline_test_role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    EXECUTE 'CREATE ROLE supabase_admin NOLOGIN';
  END IF;
END
$baseline_test_role$;

GRANT supabase_admin TO postgres;
