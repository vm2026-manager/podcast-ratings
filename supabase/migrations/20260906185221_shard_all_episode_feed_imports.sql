create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Replace only the oversized normal all-feed request. Each deterministic shard
-- keeps the existing three-feed internal concurrency and is five minutes apart
-- so six Edge Function workers are never started together.
select cron.unschedule('all-episode-feeds-hourly')
where exists (select 1 from cron.job where jobname = 'all-episode-feeds-hourly');

select cron.unschedule('all-episode-feeds-hourly-shard-0') where exists (select 1 from cron.job where jobname = 'all-episode-feeds-hourly-shard-0');
select cron.unschedule('all-episode-feeds-hourly-shard-1') where exists (select 1 from cron.job where jobname = 'all-episode-feeds-hourly-shard-1');
select cron.unschedule('all-episode-feeds-hourly-shard-2') where exists (select 1 from cron.job where jobname = 'all-episode-feeds-hourly-shard-2');
select cron.unschedule('all-episode-feeds-hourly-shard-3') where exists (select 1 from cron.job where jobname = 'all-episode-feeds-hourly-shard-3');
select cron.unschedule('all-episode-feeds-hourly-shard-4') where exists (select 1 from cron.job where jobname = 'all-episode-feeds-hourly-shard-4');
select cron.unschedule('all-episode-feeds-hourly-shard-5') where exists (select 1 from cron.job where jobname = 'all-episode-feeds-hourly-shard-5');

select cron.schedule(
  'all-episode-feeds-hourly-shard-0', '20 * * * *',
  $$select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_function_url'), headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_secret')), body := jsonb_build_object('feed', 'all', 'shard_index', 0, 'shard_count', 6), timeout_milliseconds := 120000);$$
);
select cron.schedule(
  'all-episode-feeds-hourly-shard-1', '25 * * * *',
  $$select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_function_url'), headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_secret')), body := jsonb_build_object('feed', 'all', 'shard_index', 1, 'shard_count', 6), timeout_milliseconds := 120000);$$
);
select cron.schedule(
  'all-episode-feeds-hourly-shard-2', '30 * * * *',
  $$select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_function_url'), headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_secret')), body := jsonb_build_object('feed', 'all', 'shard_index', 2, 'shard_count', 6), timeout_milliseconds := 120000);$$
);
select cron.schedule(
  'all-episode-feeds-hourly-shard-3', '35 * * * *',
  $$select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_function_url'), headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_secret')), body := jsonb_build_object('feed', 'all', 'shard_index', 3, 'shard_count', 6), timeout_milliseconds := 120000);$$
);
select cron.schedule(
  'all-episode-feeds-hourly-shard-4', '40 * * * *',
  $$select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_function_url'), headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_secret')), body := jsonb_build_object('feed', 'all', 'shard_index', 4, 'shard_count', 6), timeout_milliseconds := 120000);$$
);
select cron.schedule(
  'all-episode-feeds-hourly-shard-5', '45 * * * *',
  $$select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_function_url'), headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_secret')), body := jsonb_build_object('feed', 'all', 'shard_index', 5, 'shard_count', 6), timeout_milliseconds := 120000);$$
);
