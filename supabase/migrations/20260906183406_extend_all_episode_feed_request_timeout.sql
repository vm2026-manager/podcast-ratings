create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Keep the hourly cadence unchanged. The shared importer processes the runtime
-- feed set in bounded batches, so its pg_net caller must wait longer than the
-- extension default instead of reporting a timeout while the function runs.
select cron.unschedule('all-episode-feeds-hourly')
where exists (select 1 from cron.job where jobname = 'all-episode-feeds-hourly');

select cron.schedule(
  'all-episode-feeds-hourly',
  '20 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_secret')
    ),
    body := jsonb_build_object('feed', 'all'),
    timeout_milliseconds := 120000
  );
  $$
);
