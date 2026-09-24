-- Reviewed display-group membership is private database configuration, never
-- caller input. The stored keys are the exact persisted rating keys; no fuzzy
-- title matching or client-provided aliases are used for this identity map.
create schema if not exists private;

create table if not exists private.display_group_rating_members (
  display_group_id text not null,
  podcast_key text not null,
  primary key (display_group_id, podcast_key)
);

alter table private.display_group_rating_members enable row level security;
revoke all on schema private from public, anon, authenticated;
revoke all on table private.display_group_rating_members from public, anon, authenticated;

insert into private.display_group_rating_members (display_group_id, podcast_key)
values
  ('narkobetjenten', 'narkobetjenten og den kriminelle underverden sæson 1'),
  ('narkobetjenten', 'narkobetjenten og den kriminelle underverden sæson 2'),
  ('narkobetjenten', 'narkobetjenten og den kriminelle underverden sæson 3'),
  ('narkobetjenten', 'narkobetjenten og den kriminelle underverden sæson 6'),
  ('narkobetjenten', 'narkobetjenten sæson 7'),
  ('narkobetjenten', 'narkobetjenten sæson 9'),
  ('narkobetjenten', 'narkobetjenten sæson 10'),
  ('narkobetjenten', 'narkobetjenten sæson 11'),
  ('narkobetjenten', 'narkobetjenten sæson 12'),
  ('narkobetjenten', 'narkobetjenten sæson 13'),
  ('narkobetjenten', 'narkobetjenten sæson 14'),
  ('narkobetjenten', 'narkobetjenten sæson 15')
on conflict do nothing;

-- SECURITY DEFINER is necessary because the direct and episode rating rows
-- are owner-only under RLS. Its only caller input is a reviewed group ID;
-- membership comes solely from the private map and the result exposes no
-- user ID, individual rating, or per-user intermediate value.
create or replace function public.get_display_group_community_stats(p_display_group_ids text[])
returns table (
  display_group_id text,
  average_rating numeric,
  rating_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
with requested_group_ids as (
  select distinct requested_ids.display_group_id
  from unnest(coalesce(p_display_group_ids, '{}'::text[])) as requested_ids(display_group_id)
  where requested_ids.display_group_id <> ''
),
requested_members as (
  select members.display_group_id, members.podcast_key
  from private.display_group_rating_members as members
  join requested_group_ids
    on requested_group_ids.display_group_id = members.display_group_id
),
direct_ratings as (
  select ratings.user_id, ratings.podcast_key, ratings.rating
  from public.user_ratings as ratings
  join (select distinct podcast_key from requested_members) as requested
    on requested.podcast_key = ratings.podcast_key
),
episode_user_ratings as (
  select episode_ratings.user_id, episodes.podcast_key, avg(episode_ratings.rating) as rating
  from public.episode_ratings as episode_ratings
  join public.podcast_episodes as episodes
    on episodes.id = episode_ratings.episode_id
  join (select distinct podcast_key from requested_members) as requested
    on requested.podcast_key = episodes.podcast_key
  where episodes.is_active = true
  group by episode_ratings.user_id, episodes.podcast_key
),
effective_user_ratings as (
  select
    coalesce(direct_ratings.user_id, episode_user_ratings.user_id) as user_id,
    coalesce(direct_ratings.podcast_key, episode_user_ratings.podcast_key) as podcast_key,
    coalesce(direct_ratings.rating, episode_user_ratings.rating) as rating
  from direct_ratings
  full join episode_user_ratings
    on episode_user_ratings.user_id = direct_ratings.user_id
   and episode_user_ratings.podcast_key = direct_ratings.podcast_key
),
per_user_group_ratings as (
  select
    requested_members.display_group_id,
    effective_user_ratings.user_id,
    avg(effective_user_ratings.rating) as user_average_rating
  from requested_members
  join effective_user_ratings
    on effective_user_ratings.podcast_key = requested_members.podcast_key
  group by requested_members.display_group_id, effective_user_ratings.user_id
)
select
  requested_group_ids.display_group_id,
  avg(per_user_group_ratings.user_average_rating) as average_rating,
  count(per_user_group_ratings.user_id)::integer as rating_count
from requested_group_ids
join (select distinct display_group_id from requested_members) as supported_groups
  on supported_groups.display_group_id = requested_group_ids.display_group_id
left join per_user_group_ratings
  on per_user_group_ratings.display_group_id = requested_group_ids.display_group_id
group by requested_group_ids.display_group_id;
$$;

revoke all on function public.get_display_group_community_stats(text[]) from public;
grant execute on function public.get_display_group_community_stats(text[]) to anon, authenticated;
