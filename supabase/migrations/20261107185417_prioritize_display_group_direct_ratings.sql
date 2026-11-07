-- Prefer a user's explicit whole-podcast rating. Otherwise retain the
-- existing season/episode-derived per-user aggregate. No rating or episode
-- rows are changed by this function replacement.
begin;

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
direct_group_ratings as (
  select requested_group_ids.display_group_id, ratings.user_id, ratings.rating
  from requested_group_ids
  join public.user_ratings as ratings
    on ratings.podcast_key = 'display-group:' || requested_group_ids.display_group_id
  where requested_group_ids.display_group_id = 'kirsten-ringer-til-rasmus'
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
group_user_ids as (
  select requested_members.display_group_id, effective_user_ratings.user_id
  from requested_members
  join effective_user_ratings
    on effective_user_ratings.podcast_key = requested_members.podcast_key
  group by requested_members.display_group_id, effective_user_ratings.user_id

  union

  select direct_group_ratings.display_group_id, direct_group_ratings.user_id
  from direct_group_ratings
),
per_user_group_ratings as (
  select
    group_user_ids.display_group_id,
    group_user_ids.user_id,
    coalesce(max(direct_group_ratings.rating), avg(effective_user_ratings.rating)) as user_average_rating
  from group_user_ids
  left join direct_group_ratings
    on direct_group_ratings.display_group_id = group_user_ids.display_group_id
   and direct_group_ratings.user_id = group_user_ids.user_id
  left join requested_members
    on requested_members.display_group_id = group_user_ids.display_group_id
  left join effective_user_ratings
    on effective_user_ratings.podcast_key = requested_members.podcast_key
   and effective_user_ratings.user_id = group_user_ids.user_id
  group by group_user_ids.display_group_id, group_user_ids.user_id
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

commit;
