create extension if not exists pgcrypto;

create table if not exists public.user_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  podcast_key text not null,
  rating numeric(3,1) not null check (rating >= 0 and rating <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, podcast_key)
);

create table if not exists public.saved_podcasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  podcast_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, podcast_key)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_ratings_set_updated_at on public.user_ratings;
create trigger user_ratings_set_updated_at
before update on public.user_ratings
for each row
execute function public.set_updated_at();

alter table public.user_ratings enable row level security;
alter table public.saved_podcasts enable row level security;

grant select, insert, update, delete on public.user_ratings to authenticated;
grant select, insert, delete on public.saved_podcasts to authenticated;

drop policy if exists "Users can read own ratings" on public.user_ratings;
create policy "Users can read own ratings"
on public.user_ratings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own ratings" on public.user_ratings;
create policy "Users can insert own ratings"
on public.user_ratings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own ratings" on public.user_ratings;
create policy "Users can update own ratings"
on public.user_ratings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own ratings" on public.user_ratings;
create policy "Users can delete own ratings"
on public.user_ratings
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own saved podcasts" on public.saved_podcasts;
create policy "Users can read own saved podcasts"
on public.saved_podcasts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own saved podcasts" on public.saved_podcasts;
create policy "Users can insert own saved podcasts"
on public.saved_podcasts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own saved podcasts" on public.saved_podcasts;
create policy "Users can delete own saved podcasts"
on public.saved_podcasts
for delete
to authenticated
using (auth.uid() = user_id);

create or replace view public.rating_public_stats as
select
  podcast_key,
  round(avg(rating)::numeric, 1) as average_rating,
  count(*)::int as rating_count
from public.user_ratings
group by podcast_key;

grant select on public.rating_public_stats to anon, authenticated;
