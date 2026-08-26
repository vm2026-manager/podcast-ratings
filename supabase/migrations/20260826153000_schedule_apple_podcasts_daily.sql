create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- pg_cron itself runs in UTC. The local-time guard makes this a single,
-- DST-safe 07:30 Europe/Copenhagen daily invocation using Vault secrets.
select cron.unschedule('apple-mads-og-a-holdet-daily')
where exists (select 1 from cron.job where jobname = 'apple-mads-og-a-holdet-daily');

select cron.unschedule('apple-podcasts-daily')
where exists (select 1 from cron.job where jobname = 'apple-podcasts-daily');

select cron.schedule(
  'apple-podcasts-daily',
  '30 5,6 * * *',
  $$
  select case
    when (now() at time zone 'Europe/Copenhagen')::time >= time '07:30'
      and (now() at time zone 'Europe/Copenhagen')::time < time '07:31' then
      net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_function_url'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'episode_import_secret')
        ),
        body := jsonb_build_object('feed', 'apple_all')
      )
    else null
  end;
  $$
);
