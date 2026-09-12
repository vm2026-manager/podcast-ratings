create or replace view public.podcast_rating_combined_public_stats as
with direct_ratings as (
  select user_id, podcast_key, rating
  from public.user_ratings
),
episode_user_ratings as (
  select er.user_id, pe.podcast_key, avg(er.rating) as rating
  from public.episode_ratings er
  join public.podcast_episodes pe on pe.id = er.episode_id
  where pe.is_active = true
  group by er.user_id, pe.podcast_key
),
effective_user_ratings as (
  select coalesce(d.user_id, e.user_id) as user_id,
         coalesce(d.podcast_key, e.podcast_key) as podcast_key,
         coalesce(d.rating, e.rating) as rating
  from direct_ratings d
  full join episode_user_ratings e
    on e.user_id = d.user_id and e.podcast_key = d.podcast_key
)
select podcast_key, avg(rating) as average_rating, count(*)::integer as rating_count
from effective_user_ratings
group by podcast_key;
