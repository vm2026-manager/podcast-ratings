# #83 - Sæsonscore i brugeraggregat

Status: read-only audit complete; SQL below is a reviewed proposal only. This
file is documentation, not a migration, and is not applied by the repository's
migration tooling.

## Baseline and dry run

Rechecked against production on 9 November 2026. The active function MD5 matches
the supplied baseline exactly: `b5e4c284238d0c52a22e7520282e3d9b`.

The dry run used the active function's private member mapping and rating
sources. It compared the current direct-first per-user rule against the
proposed Kirsten-only season-first rule. For other group IDs it kept the active
calculation unchanged.

| Display group | Current score / users | Proposed score / users | Direct only | Season only | Direct + season | Episode only |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Kirsten ringer til Rasmus | 8.3000 / 2 | 8.3000 / 2 | 0 | 2 | 0 | 0 |
| Narkobetjenten | 7.3286 / 1 | 7.3286 / 1 | 0 | 1 | 0 | 0 |
| Unknown group ID | no row / 0 | no row / 0 | 0 | 0 | 0 | 0 |

All three groups also had 0 season+episode users and 0 direct+episode users.
The Kirsten-specific baseline is 0 direct rows/users, 2 explicit season rows
for 2 users, 0 overlaps, and 0 episode-rating users. There are six member keys,
13 episode identities, and 0 episode-rating rows for those keys. A direct
read-only call to the active function returned 8.3000 / 2 for Kirsten and
7.3286 / 1 for Narkobetjenten; the unknown ID returned no row.

MD5 fingerprints (sorted inputs; no underlying identifiers or ratings are
included in this document):

- Active SQL function definition: `b5e4c284238d0c52a22e7520282e3d9b`
- Kirsten member podcast keys: `7a83782cd5585676f5964afe1cbdbb75`
- Kirsten member and direct-group `user_ratings` rows: `ae9c0637989b1e8bf4385e2b0c19d8e4`
- Kirsten member `episode_ratings` rows (empty set): `d41d8cd98f00b204e9800998ecf8427e`
- Kirsten member episode IDs and podcast keys: `90506fb4581bce5811c0afc579e4a840`

The rating fingerprints combine user ID, podcast/episode key, and rating to
detect changes without disclosing row contents. No rows were read back as
individual records or changed.

## Active function behavior

- `direct_group_ratings` loads only the explicit Kirsten group key.
- `direct_ratings` loads explicit `user_ratings` for the private member keys.
- `episode_user_ratings` averages active episode ratings per user and parent
  podcast key.
- `effective_user_ratings` combines those sources per key, preferring an
  explicit season row over that season's episode fallback.
- `group_user_ids` groups effective member ratings by user and unions direct
  group raters, so a user enters the final set once.
- `per_user_group_ratings` currently gives the direct group row precedence over
  the average of effective member ratings. The final function averages those
  per-user scores and counts users.

The proposed branch checks `direct_ratings` separately. Only a stored explicit
season row counts as a season rating. If at least one exists, the group score
is the average of those season rows, one row per member season. Episode ratings
cannot satisfy this check. If no explicit season row exists, the current
direct-group-first behavior remains, followed by the existing episode-derived
fallback. `group_user_ids`, final count, member mapping, and unknown-group
filter remain unchanged.

## Security and rights

The active function is `LANGUAGE sql`, `STABLE`, `SECURITY DEFINER`, with an
empty `search_path`. Its ACL is `EXECUTE` for `anon`, `authenticated`,
`postgres`, and `service_role`; `PUBLIC` has no execute grant. The proposal
keeps the function signature, owner, execution settings, and ACL. It adds no
tables, policies, grants, revokes, or data DML.

## Proposed function

Do not execute this block from CI or a production deploy. Before applying it,
confirm the current function fingerprint, the exact approved SQL, a fresh
backup/snapshot, and the owner's explicit approval for this function change.
The migration ledger must not be edited as part of an ad hoc function update.

```sql
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
    case
      when group_user_ids.display_group_id = 'kirsten-ringer-til-rasmus'
       and count(direct_ratings.podcast_key) > 0
        then avg(direct_ratings.rating)
      else coalesce(max(direct_group_ratings.rating), avg(effective_user_ratings.rating))
    end as user_average_rating
  from group_user_ids
  left join direct_group_ratings
    on direct_group_ratings.display_group_id = group_user_ids.display_group_id
   and direct_group_ratings.user_id = group_user_ids.user_id
  left join requested_members
    on requested_members.display_group_id = group_user_ids.display_group_id
  left join effective_user_ratings
    on effective_user_ratings.podcast_key = requested_members.podcast_key
   and effective_user_ratings.user_id = group_user_ids.user_id
  left join direct_ratings
    on direct_ratings.podcast_key = requested_members.podcast_key
   and direct_ratings.user_id = group_user_ids.user_id
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
```

## Owner authorization needed for a production write

No production SQL, migration ledger, rating row, or episode identity has been
changed. Production application requires explicit owner approval of the exact
function body above, tied to the then-current function fingerprint and a fresh
read-only dry run/backup. After approval, verify the function definition and
ACL, compare current/proposed aggregates and fingerprints, and confirm the
unchanged rating and episode counts before/after. The current dry-run results
are not approval to write.
