-- Keep daily registration totals outside API-exposed schemas.
create table if not exists private.admin_user_count_history (
  snapshot_date date primary key,
  user_count bigint not null check (user_count >= 0),
  captured_at timestamptz not null default now()
);

alter table private.admin_user_count_history enable row level security;
revoke all on table private.admin_user_count_history from public, anon, authenticated;

-- Start the history with today's verified total. Earlier totals cannot be
-- reconstructed, so the chart grows from this first snapshot.
insert into private.admin_user_count_history (snapshot_date, user_count, captured_at)
select (now() at time zone 'Europe/Copenhagen')::date, count(*), now()
from auth.users
on conflict (snapshot_date) do update
set user_count = excluded.user_count,
    captured_at = excluded.captured_at;

create or replace function private.capture_admin_user_count_snapshot()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.admin_user_count_history (snapshot_date, user_count, captured_at)
  select (now() at time zone 'Europe/Copenhagen')::date, count(*), now()
  from auth.users
  on conflict (snapshot_date) do update
  set user_count = excluded.user_count,
      captured_at = excluded.captured_at;
$$;

revoke all on function private.capture_admin_user_count_snapshot() from public, anon, authenticated;

create or replace function private.admin_user_count_history(p_period text)
returns table (snapshot_date date, user_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket text;
  v_start_date date;
begin
  if auth.uid() is null
    or lower(coalesce(auth.jwt() ->> 'email', '')) <> 'aspmads@hotmail.com' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_period = 'week' then
    v_bucket := 'week';
    v_start_date := current_date - 11 * 7;
  elsif p_period = 'month' then
    v_bucket := 'month';
    v_start_date := (date_trunc('month', current_date::timestamp) - interval '11 months')::date;
  else
    raise exception 'Invalid period' using errcode = '22023';
  end if;

  return query
  select history.bucket_date, history.user_count
  from (
    select distinct on (date_trunc(v_bucket, h.snapshot_date::timestamp)::date)
      date_trunc(v_bucket, h.snapshot_date::timestamp)::date as bucket_date,
      h.snapshot_date,
      h.user_count
    from private.admin_user_count_history h
    where h.snapshot_date >= v_start_date
    order by date_trunc(v_bucket, h.snapshot_date::timestamp)::date, h.snapshot_date desc
  ) history
  order by history.bucket_date;
end;
$$;

revoke all on function private.admin_user_count_history(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.admin_user_count_history(text) to authenticated;

create or replace function public.admin_user_count_history(p_period text)
returns table (snapshot_date date, user_count bigint)
language sql
security invoker
set search_path = ''
as $$
  select * from private.admin_user_count_history(p_period);
$$;

revoke all on function public.admin_user_count_history(text) from public, anon;
grant execute on function public.admin_user_count_history(text) to authenticated;

-- Supabase Cron (pg_cron) is already enabled in this project.
select cron.schedule(
  'admin-user-count-daily-snapshot',
  '15 3 * * *',
  'select private.capture_admin_user_count_snapshot();'
);
