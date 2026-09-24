-- Aggregate-only public API for a caller-supplied set of display-group member
-- keys. It intentionally returns neither user IDs nor individual ratings.
-- SECURITY DEFINER is required because user_ratings and episode_ratings are
-- protected by owner-only RLS, while this function exposes only the same kind
-- of public aggregate already exposed by podcast_rating_combined_public_stats.
create or replace function public.get_display_group_community_stats(p_groups jsonb)
returns table (
  display_group_id text,
  average_rating numeric,
  rating_count integer
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
with requested_groups as (
  select
    request.id as display_group_id,
    array_agg(distinct member_keys.member_key) filter (where member_keys.member_key <> '') as podcast_keys
  from jsonb_to_recordset(coalesce(p_groups, '[]'::jsonb))
    as request(id text, podcast_keys text[])
  cross join lateral unnest(coalesce(request.podcast_keys, '{}'::text[])) as member_keys(member_key)
  where request.id <> ''
  group by request.id
),
requested_keys as (
  select requested_groups.display_group_id, member_key.podcast_key
  from requested_groups
  cross join lateral unnest(requested_groups.podcast_keys) as member_key(podcast_key)
),
direct_ratings as (
  select ratings.user_id, ratings.podcast_key, ratings.rating
  from public.user_ratings as ratings
  join (select distinct podcast_key from requested_keys) as requested
    on requested.podcast_key = ratings.podcast_key
),
episode_user_ratings as (
  select episode_ratings.user_id, episodes.podcast_key, avg(episode_ratings.rating) as rating
  from public.episode_ratings as episode_ratings
  join public.podcast_episodes as episodes
    on episodes.id = episode_ratings.episode_id
  join (select distinct podcast_key from requested_keys) as requested
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
    requested_keys.display_group_id,
    effective_user_ratings.user_id,
    avg(effective_user_ratings.rating) as user_average_rating
  from requested_keys
  join effective_user_ratings
    on effective_user_ratings.podcast_key = requested_keys.podcast_key
  group by requested_keys.display_group_id, effective_user_ratings.user_id
)
select
  requested_groups.display_group_id,
  avg(per_user_group_ratings.user_average_rating) as average_rating,
  count(per_user_group_ratings.user_id)::integer as rating_count
from requested_groups
left join per_user_group_ratings
  on per_user_group_ratings.display_group_id = requested_groups.display_group_id
group by requested_groups.display_group_id;
$$;

revoke all on function public.get_display_group_community_stats(jsonb) from public;
grant execute on function public.get_display_group_community_stats(jsonb) to anon, authenticated;
