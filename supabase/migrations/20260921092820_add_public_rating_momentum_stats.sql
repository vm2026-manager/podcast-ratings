-- One row per effective user/podcast rating. A direct podcast rating still
-- wins over the episode-derived average, including for its activity time.
-- Episode activity is reduced to the newest event per user/podcast so several
-- episode ratings never become several popularity events.
create or replace view public.podcast_rating_combined_public_stats as
with direct_ratings as (
  select
    user_id,
    podcast_key,
    rating,
    coalesce(updated_at, created_at) as activity_at
  from public.user_ratings
),
episode_user_ratings as (
  select
    er.user_id,
    pe.podcast_key,
    avg(er.rating) as rating,
    max(coalesce(er.updated_at, er.created_at)) as activity_at
  from public.episode_ratings er
  join public.podcast_episodes pe on pe.id = er.episode_id
  where pe.is_active = true
  group by er.user_id, pe.podcast_key
),
effective_user_ratings as (
  select
    coalesce(d.user_id, e.user_id) as user_id,
    coalesce(d.podcast_key, e.podcast_key) as podcast_key,
    coalesce(d.rating, e.rating) as rating,
    coalesce(d.activity_at, e.activity_at) as activity_at
  from direct_ratings d
  full join episode_user_ratings e
    on e.user_id = d.user_id and e.podcast_key = d.podcast_key
)
select
  podcast_key,
  avg(rating) as average_rating,
  count(*)::integer as rating_count,
  count(*) filter (where activity_at >= now() - interval '7 days')::integer as recent_users_7d,
  count(*) filter (where activity_at >= now() - interval '30 days')::integer as recent_users_30d,
  count(*) filter (where activity_at >= now() - interval '90 days')::integer as recent_users_90d,
  (
    count(*) filter (where activity_at >= now() - interval '7 days') +
    0.35 * count(*) filter (
      where activity_at >= now() - interval '30 days'
        and activity_at < now() - interval '7 days'
    ) +
    0.10 * count(*) filter (
      where activity_at >= now() - interval '90 days'
        and activity_at < now() - interval '30 days'
    )
  )::numeric as momentum_score
from effective_user_ratings
group by podcast_key;
