begin;

create temporary table rescued_manual_episode_ratings (
  user_id uuid not null,
  episode_id uuid not null,
  rating numeric not null check (rating >= 0 and rating <= 10),
  updated_at timestamptz not null,
  primary key (user_id, episode_id)
) on commit drop;

insert into rescued_manual_episode_ratings (user_id, episode_id, rating, updated_at)
values
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, 'c7599019-1106-5e7e-a5f1-893306e57790'::uuid, 8.3::numeric, '2026-08-17T19:15:03.657Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, '00a1b3cb-40ae-52de-8276-4d45ebf4f4c0'::uuid, 8.4::numeric, '2026-08-17T19:15:08.120Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, 'c150d333-7b03-5bcc-8c47-48c97e32d48a'::uuid, 7.4::numeric, '2026-08-17T19:15:11.223Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, '2df98b7c-0a87-50eb-bf10-069e03e57225'::uuid, 7.5::numeric, '2026-08-17T19:15:15.484Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, '95715ea8-c123-5bbb-b14c-e2c65f2ade81'::uuid, 8.5::numeric, '2026-08-17T19:15:20.921Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, '8e19963d-335b-52a8-916e-c2b30d9fe466'::uuid, 7.1::numeric, '2026-08-17T19:15:25.413Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, '12a33e5c-865a-57fb-8202-d55a2e658c01'::uuid, 4.8::numeric, '2026-08-17T19:15:34.608Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, 'faeb474e-fb2c-50c1-b5d0-bbf8de49ca1b'::uuid, 7.6::numeric, '2026-08-17T19:15:39.821Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, '9ea45188-e72e-557f-a4bc-7796fa6781e5'::uuid, 8.0::numeric, '2026-08-17T19:15:43.830Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, 'f5428bc3-1e71-5af6-8363-93cd13708f70'::uuid, 7.4::numeric, '2026-08-17T19:15:49.098Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, '5e1ff2d1-d76d-5596-b8dc-55676d7fb194'::uuid, 8.5::numeric, '2026-08-18T08:06:59.684Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, 'd8a857f0-482b-50ed-995d-dfde6081405b'::uuid, 8.2::numeric, '2026-08-18T09:25:48.712Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, '4abc9a5c-8773-5f47-b554-8f1a3b888b55'::uuid, 7.7::numeric, '2026-08-18T17:54:47.475Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, 'b857d1a5-6fdc-5d00-95f8-d84f6dd60082'::uuid, 7.8::numeric, '2026-08-18T18:24:28.013Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, '05499c1e-02cb-5f5d-b53c-99582d312e97'::uuid, 5.0::numeric, '2026-08-19T17:40:57.708Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, 'fbf212f5-c790-5780-9e03-0797cf9f725a'::uuid, 5.2::numeric, '2026-08-24T18:36:59.052Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, 'd2448d0a-4866-515f-b5e5-1d9c60a5a9b1'::uuid, 7.8::numeric, '2026-08-25T14:19:04.934Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, '13e824b2-0d17-5d2b-8445-082cdfaaddcd'::uuid, 6.8::numeric, '2026-08-27T20:20:25.438Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, 'bb1fecfa-3a23-5875-967d-3dfc4817661f'::uuid, 7.0::numeric, '2026-08-27T20:20:32.713Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, '19911bd3-3950-5d36-8d00-3d2dcb5943c0'::uuid, 7.5::numeric, '2026-08-29T17:36:07.545Z'::timestamptz),
  ('323d3e42-df9f-42d1-81f1-8ad1ede7cd2d'::uuid, 'ca9c962b-17d4-5410-ac88-68a90e8ffc3e'::uuid, 4.8::numeric, '2026-08-30T07:21:20.777Z'::timestamptz);

do $$
begin
  if (select count(*) from rescued_manual_episode_ratings) <> 21 then
    raise exception 'Expected exactly 21 rescued manual episode ratings';
  end if;

  if exists (
    select 1
    from rescued_manual_episode_ratings rescued
    left join public.podcast_episodes episode
      on episode.id = rescued.episode_id
    where episode.id is null
  ) then
    raise exception 'A rescued rating references a missing canonical episode';
  end if;
end $$;

with inserted as (
  insert into public.episode_ratings (
    user_id,
    episode_id,
    rating,
    created_at,
    updated_at
  )
  select
    user_id,
    episode_id,
    rating,
    updated_at,
    updated_at
  from rescued_manual_episode_ratings
  on conflict (user_id, episode_id) do nothing
  returning user_id, episode_id
)
select
  rescued.episode_id,
  rescued.rating,
  rescued.updated_at,
  case
    when inserted.episode_id is null then 'conflict_existing_server_rating'
    else 'inserted'
  end as outcome
from rescued_manual_episode_ratings rescued
left join inserted using (user_id, episode_id)
order by rescued.updated_at;

commit;
