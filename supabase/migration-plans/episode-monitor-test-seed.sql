-- Synthetic data only. 250k noise rows make the existing composite index
-- choice measurable without copying production identifiers or logs.
INSERT INTO public.episode_import_runs (source, podcast_key, started_at, status, error_message)
SELECT 'synthetic-ci',
  'synthetic-' || (i % 5000),
  statement_timestamp() - ((i % 45) || ' days')::interval - ((i % 86400) || ' seconds')::interval,
  CASE i % 31 WHEN 0 THEN 'failed' WHEN 1 THEN 'partial' ELSE 'success' END,
  CASE WHEN i % 31 = 0 THEN 'synthetic-error-do-not-return' ELSE NULL END
FROM generate_series(1, 250000) AS generated(i);

INSERT INTO public.episode_import_runs (source, podcast_key, started_at, status, error_message)
VALUES
  ('synthetic-ci', 'monitor-one-success', now() - interval '2 hours', 'success', 'SYNTHETIC_PRIVATE_ERROR'),
  ('synthetic-ci', 'monitor-two-failures', now() - interval '5 days', 'success', 'SYNTHETIC_PRIVATE_ERROR'),
  ('synthetic-ci', 'monitor-two-failures', now() - interval '2 hours', 'failed', 'SYNTHETIC_PRIVATE_ERROR'),
  ('synthetic-ci', 'monitor-two-failures', now() - interval '1 hour', 'failed', 'SYNTHETIC_PRIVATE_ERROR'),
  ('synthetic-ci', 'monitor-recovery', now() - interval '2 hours', 'failed', 'SYNTHETIC_PRIVATE_ERROR'),
  ('synthetic-ci', 'monitor-recovery', now() - interval '1 hour', 'failed', 'SYNTHETIC_PRIVATE_ERROR'),
  ('synthetic-ci', 'monitor-recovery', now() - interval '20 minutes', 'success', 'SYNTHETIC_PRIVATE_ERROR'),
  ('synthetic-ci', 'monitor-partial', now() - interval '2 hours', 'success', 'SYNTHETIC_PRIVATE_ERROR'),
  ('synthetic-ci', 'monitor-partial', now() - interval '1 hour', 'partial', 'SYNTHETIC_PRIVATE_ERROR'),
  ('synthetic-ci', 'monitor-running', now() - interval '1 hour', 'running', 'SYNTHETIC_PRIVATE_ERROR');

INSERT INTO public.episode_import_runs (source, podcast_key, started_at, status, error_message)
VALUES
  ('synthetic-ci', 'monitor-newer-activation', now() - interval '3 hours', 'failed', 'SYNTHETIC_PRIVATE_ERROR'),
  ('synthetic-ci', 'monitor-newer-activation', now() - interval '1 hour', 'success', 'SYNTHETIC_PRIVATE_ERROR'),
  ('synthetic-ci', 'monitor-import-before-activation', now() - interval '3 days', 'success', 'SYNTHETIC_PRIVATE_ERROR'),
  ('synthetic-ci', 'monitor-old-activation-no-recent-runs', now() - interval '20 days', 'success', 'SYNTHETIC_PRIVATE_ERROR');

ANALYZE public.episode_import_runs;
