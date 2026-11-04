-- PREPARED ONLY. Do not apply to production without explicit owner approval.
-- Replace this test-only identity UUID with the specifically provisioned reader
-- identity only in an approved, reviewed deployment. Never create this Auth
-- identity or a GitHub credential as part of this migration.
--
-- Keep episode_monitor_private out of Supabase's exposed API schemas.

BEGIN;

DO $migration$
BEGIN
  IF to_regclass('public.episode_import_runs') IS NULL THEN
    RAISE EXCEPTION 'episode_import_runs is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'episode_import_runs' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'episode_import_runs must keep RLS enabled';
  END IF;
END;
$migration$;

CREATE ROLE episode_monitor_rpc_owner
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

CREATE SCHEMA episode_monitor_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA episode_monitor_private FROM PUBLIC, anon, authenticated;
GRANT USAGE, CREATE ON SCHEMA episode_monitor_private TO episode_monitor_rpc_owner;
GRANT USAGE ON SCHEMA episode_monitor_private TO authenticated;
GRANT USAGE ON SCHEMA public, auth TO episode_monitor_rpc_owner;

-- Remove direct table-level access if present. The monitoring role receives
-- only the three columns used by the bounded aggregation below.
REVOKE SELECT ON TABLE public.episode_import_runs FROM PUBLIC, anon, authenticated;
REVOKE SELECT (podcast_key, started_at, status)
  ON TABLE public.episode_import_runs FROM PUBLIC, anon, authenticated;
DO $revoke_column_select$
DECLARE
  v_column name;
BEGIN
  FOR v_column IN
    SELECT a.attname
    FROM pg_attribute AS a
    WHERE a.attrelid = 'public.episode_import_runs'::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped
  LOOP
    EXECUTE format(
      'REVOKE SELECT (%I) ON TABLE public.episode_import_runs FROM PUBLIC, anon, authenticated',
      v_column
    );
  END LOOP;
END;
$revoke_column_select$;
GRANT SELECT (podcast_key, started_at, status)
  ON TABLE public.episode_import_runs TO episode_monitor_rpc_owner;
GRANT EXECUTE ON FUNCTION auth.uid() TO episode_monitor_rpc_owner;

CREATE POLICY episode_monitor_rpc_owner_identity_read
  ON public.episode_import_runs
  FOR SELECT
  TO episode_monitor_rpc_owner
  USING (auth.uid() = '00000000-0000-4000-8000-000000000061'::uuid);

CREATE FUNCTION episode_monitor_private.status_for_podcasts(
  p_podcast_ids text[],
  p_activated_after timestamptz
)
RETURNS TABLE (
  podcast_key text,
  latest_run_status text,
  latest_run_started_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failure_count smallint,
  run_count smallint,
  imported_after_activation boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET row_security = on
AS $function$
DECLARE
  v_now timestamptz := statement_timestamp();
  v_cutoff timestamptz := greatest(p_activated_after, statement_timestamp() - interval '14 days');
BEGIN
  IF auth.uid() IS DISTINCT FROM '00000000-0000-4000-8000-000000000061'::uuid THEN
    RAISE EXCEPTION 'episode status unavailable' USING ERRCODE = '42501';
  END IF;

  IF p_podcast_ids IS NULL OR cardinality(p_podcast_ids) < 1 OR cardinality(p_podcast_ids) > 10
    OR p_activated_after IS NULL
    OR p_activated_after < v_now - interval '14 days'
    OR p_activated_after > v_now
    OR EXISTS (SELECT 1 FROM unnest(p_podcast_ids) AS supplied(id)
      WHERE supplied.id IS NULL OR btrim(supplied.id) = '' OR length(supplied.id) > 300)
    OR cardinality(p_podcast_ids) <> (SELECT count(DISTINCT supplied.id)
      FROM unnest(p_podcast_ids) AS supplied(id)) THEN
    RAISE EXCEPTION 'episode status unavailable' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH requested AS (
    SELECT supplied.id AS podcast_key
    FROM unnest(p_podcast_ids) AS supplied(id)
  )
  SELECT requested.podcast_key,
    latest.latest_status,
    latest.latest_started_at,
    succeeded.started_at,
    failed.started_at,
    CASE
      WHEN latest.statuses[1] = 'failed' AND latest.statuses[2] = 'failed' THEN 2::smallint
      WHEN latest.statuses[1] = 'failed' THEN 1::smallint
      ELSE 0::smallint
    END,
    coalesce(latest.run_count, 0)::smallint,
    coalesce(latest.run_count, 0) > 0
  FROM requested
  LEFT JOIN LATERAL (
    SELECT array_agg(two.status ORDER BY two.started_at DESC) AS statuses,
      (array_agg(two.status ORDER BY two.started_at DESC))[1] AS latest_status,
      max(two.started_at) AS latest_started_at,
      count(*)::smallint AS run_count
    FROM (
      SELECT r.status, r.started_at
      FROM public.episode_import_runs AS r
      WHERE r.podcast_key = requested.podcast_key
        AND r.started_at >= v_cutoff
        AND r.started_at <= v_now
      ORDER BY r.started_at DESC
      LIMIT 2
    ) AS two
  ) AS latest ON true
  LEFT JOIN LATERAL (
    SELECT r.started_at
    FROM public.episode_import_runs AS r
    WHERE r.podcast_key = requested.podcast_key
      AND r.started_at >= v_cutoff
      AND r.started_at <= v_now
      AND r.status = 'success'
    ORDER BY r.started_at DESC
    LIMIT 1
  ) AS succeeded ON true
  LEFT JOIN LATERAL (
    SELECT r.started_at
    FROM public.episode_import_runs AS r
    WHERE r.podcast_key = requested.podcast_key
      AND r.started_at >= v_cutoff
      AND r.started_at <= v_now
      AND r.status = 'failed'
    ORDER BY r.started_at DESC
    LIMIT 1
  ) AS failed ON true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'episode status unavailable' USING ERRCODE = 'P0001';
END;
$function$;

ALTER FUNCTION episode_monitor_private.status_for_podcasts(text[], timestamptz)
  OWNER TO episode_monitor_rpc_owner;
REVOKE CREATE ON SCHEMA episode_monitor_private FROM episode_monitor_rpc_owner;
REVOKE ALL ON FUNCTION episode_monitor_private.status_for_podcasts(text[], timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION episode_monitor_private.status_for_podcasts(text[], timestamptz)
  TO authenticated;

CREATE FUNCTION public.episode_import_monitor_status(
  p_podcast_ids text[],
  p_activated_after timestamptz
)
RETURNS TABLE (
  podcast_key text,
  latest_run_status text,
  latest_run_started_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failure_count smallint,
  run_count smallint,
  imported_after_activation boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
SET row_security = on
AS $function$
BEGIN
  IF auth.uid() IS DISTINCT FROM '00000000-0000-4000-8000-000000000061'::uuid THEN
    RAISE EXCEPTION 'episode status unavailable' USING ERRCODE = '42501';
  END IF;

  IF p_podcast_ids IS NULL OR cardinality(p_podcast_ids) < 1 OR cardinality(p_podcast_ids) > 10
    OR p_activated_after IS NULL
    OR p_activated_after < statement_timestamp() - interval '14 days'
    OR p_activated_after > statement_timestamp()
    OR EXISTS (SELECT 1 FROM unnest(p_podcast_ids) AS supplied(id)
      WHERE supplied.id IS NULL OR btrim(supplied.id) = '' OR length(supplied.id) > 300)
    OR cardinality(p_podcast_ids) <> (SELECT count(DISTINCT supplied.id)
      FROM unnest(p_podcast_ids) AS supplied(id)) THEN
    RAISE EXCEPTION 'episode status unavailable' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT * FROM episode_monitor_private.status_for_podcasts(p_podcast_ids, p_activated_after);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'episode status unavailable' USING ERRCODE = 'P0001';
END;
$function$;

REVOKE ALL ON FUNCTION public.episode_import_monitor_status(text[], timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.episode_import_monitor_status(text[], timestamptz)
  TO authenticated;

DO $verification$
BEGIN
  IF has_any_column_privilege('anon', 'public.episode_import_runs', 'SELECT')
    OR has_any_column_privilege('authenticated', 'public.episode_import_runs', 'SELECT')
    OR has_table_privilege('episode_monitor_rpc_owner', 'public.episode_import_runs', 'SELECT') THEN
    RAISE EXCEPTION 'unexpected table-level SELECT grant';
  END IF;
  IF NOT has_column_privilege('episode_monitor_rpc_owner', 'public.episode_import_runs', 'podcast_key', 'SELECT')
    OR NOT has_column_privilege('episode_monitor_rpc_owner', 'public.episode_import_runs', 'started_at', 'SELECT')
    OR NOT has_column_privilege('episode_monitor_rpc_owner', 'public.episode_import_runs', 'status', 'SELECT') THEN
    RAISE EXCEPTION 'required aggregate column grant missing';
  END IF;
  IF (SELECT rolcanlogin OR rolbypassrls OR rolsuper FROM pg_roles
      WHERE rolname = 'episode_monitor_rpc_owner') THEN
    RAISE EXCEPTION 'monitor function role is over-privileged';
  END IF;
END;
$verification$;

COMMIT;
