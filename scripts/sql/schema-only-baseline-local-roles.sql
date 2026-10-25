-- Test-harness-only setup for the isolated local Supabase Postgres instance.
-- The current production catalog has default ACLs owned by supabase_admin,
-- while a fresh local stack may not contain that cloud-managed role.
DO $baseline_test_role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    EXECUTE 'CREATE ROLE supabase_admin NOLOGIN ROLE postgres';
  END IF;
END
$baseline_test_role$;
