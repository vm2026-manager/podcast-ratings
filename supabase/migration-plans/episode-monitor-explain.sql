-- Same bounded lateral query shape as status_for_podcasts, executed as its
-- actual NOBYPASSRLS function-owner role against synthetic CI rows.
BEGIN;
SET LOCAL ROLE episode_monitor_rpc_owner;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000061","role":"authenticated"}';
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
WITH requested AS (
  SELECT supplied.podcast_key, supplied.activated_after
  FROM unnest(ARRAY[
    'synthetic-1', 'synthetic-2', 'synthetic-3', 'synthetic-4', 'synthetic-5',
    'synthetic-6', 'synthetic-7', 'synthetic-8', 'synthetic-9', 'synthetic-10'
  ]::text[], ARRAY[
    statement_timestamp() - interval '14 days',
    statement_timestamp() - interval '10 days',
    statement_timestamp() - interval '7 days',
    statement_timestamp() - interval '3 days',
    statement_timestamp() - interval '1 day',
    statement_timestamp() - interval '12 hours',
    statement_timestamp() - interval '6 hours',
    statement_timestamp() - interval '3 hours',
    statement_timestamp() - interval '1 hour',
    statement_timestamp() - interval '5 minutes'
  ]::timestamptz[]) AS supplied(podcast_key, activated_after)
)
SELECT requested.podcast_key,
  latest.latest_status,
  latest.latest_started_at,
  succeeded.started_at AS last_success_at,
  failed.started_at AS last_failure_at,
  CASE
    WHEN latest.statuses[1] = 'failed' AND latest.statuses[2] = 'failed' THEN 2::smallint
    WHEN latest.statuses[1] = 'failed' THEN 1::smallint
    ELSE 0::smallint
  END AS consecutive_failure_count,
  coalesce(latest.run_count, 0)::smallint AS run_count,
  coalesce(latest.run_count, 0) > 0 AS imported_after_activation
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
      AND r.started_at >= greatest(requested.activated_after, statement_timestamp() - interval '14 days')
      AND r.started_at <= statement_timestamp()
    ORDER BY r.started_at DESC
    LIMIT 2
  ) AS two
) AS latest ON true
LEFT JOIN LATERAL (
  SELECT r.started_at
  FROM public.episode_import_runs AS r
  WHERE r.podcast_key = requested.podcast_key
    AND r.started_at >= greatest(requested.activated_after, statement_timestamp() - interval '14 days')
    AND r.started_at <= statement_timestamp()
    AND r.status = 'success'
  ORDER BY r.started_at DESC
  LIMIT 1
) AS succeeded ON true
LEFT JOIN LATERAL (
  SELECT r.started_at
  FROM public.episode_import_runs AS r
  WHERE r.podcast_key = requested.podcast_key
    AND r.started_at >= greatest(requested.activated_after, statement_timestamp() - interval '14 days')
    AND r.started_at <= statement_timestamp()
    AND r.status = 'failed'
  ORDER BY r.started_at DESC
  LIMIT 1
) AS failed ON true;
ROLLBACK;
