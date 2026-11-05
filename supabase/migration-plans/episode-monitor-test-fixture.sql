-- Synthetic PostgreSQL 17 fixture only. Never run against a Supabase project.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'episode-monitor-ci-db-password';
GRANT anon, authenticated TO authenticator;

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $auth_uid$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  )
$auth_uid$;
GRANT USAGE ON SCHEMA auth TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

CREATE TABLE public.episode_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text,
  podcast_key text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'partial', 'running')),
  fetched_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX episode_import_runs_podcast_key_started_at_idx
  ON public.episode_import_runs (podcast_key, started_at DESC);
ALTER TABLE public.episode_import_runs ENABLE ROW LEVEL SECURITY;

-- Start with adversarial grants, including a column grant, to verify that the
-- migration removes both table-level and per-column direct access.
GRANT SELECT ON TABLE public.episode_import_runs TO anon;
GRANT SELECT (error_message) ON TABLE public.episode_import_runs TO authenticated;
