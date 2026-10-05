# Krop til salg: identity-preserving Podimo sync

## Read-only audit, 2026-10-04

Base: `origin/main` at `82ea006e`. The catalogue row is in
`data/podcasts.json`, `Podcast-ID = krop til salg`,
`catalogue_id = catalogue-v1-5372337b`. Its four `manualEpisodes` titles are
unchanged. Their canonical records were introduced in
`migrations/20260830105704_manual_catalogue_episode_canonicalization.sql`.

Production contains four active `podcast_episodes` rows under
`manual_catalogue_v1`, four `manual_catalogue_episode_map` entries, and one
`episode_ratings` row on episode 1. Both referencing tables have foreign keys
to `podcast_episodes.id` with `ON DELETE RESTRICT`. Ratings use the internal
UUID, not the title or provider GUID. No existing Podimo records or duplicate
records were found for this podcast. Only SELECT queries were executed.

The existing `fetchPodimoEpisodes` adapter obtains structured metadata from
`https://graphql.podimo.com/graphql`, using `openPodcastEpisodesByPodcastId`
with podcast UUID `616ec836-7d90-4c98-8ad3-9cea17e067e1`. It returned ten
episodes in one page. Fields: `id`, `title`, `description`, `publishedOn`,
`duration` (seconds), `coverImage`, `playAvailable`. The existing mapper builds
episode URLs as `https://podimo.com/dk/shows/krop-til-salg/episode/<UUID>`.
No browser scraping or playback extraction is added.

## Reviewed identity mapping

The manual rows have neither publication dates nor durations. The four
exceptions therefore pin a reviewed pair of internal UUID and Podimo UUID,
supported by the full distinctive title (including part 1:2 versus 2:2),
immutable catalogue episode number, and Podimo's explicit S1-E1 through S1-E4
prefixes. Each initial link additionally validates the captured Podimo date and
duration. This is not an automatic title-only heuristic or array-order match.
Dates below are UTC. The fixture captures all ten source IDs/titles/dates/durations.

| Episode | Preserved internal UUID | Podimo UUID | Date | Seconds | Existing ratings |
| --- | --- | --- | --- | ---: | ---: |
| 1: Den lykkelige luder, “Nogle af os…” (1:2) | `92566dbb-4767-5566-818e-612932f25ddc` | `264f5717-330e-4606-bc1c-3d74c366061e` | 2026-08-07 | 2510 | 1 |
| 2: Den lykkelige luder, “Du er da…” (2:2) | `c4f21452-68c6-588f-8d5a-b4fcd558bea1` | `17f26c96-4b4b-4321-8ac2-0d666ffd8ce9` | 2026-08-07 | 2461 | 0 |
| 3: Peter er sexkunde | `0ad775dc-b1dd-52c9-819f-3b5a0c4d0a17` | `e61aa60f-f615-483d-82da-8802ff938e84` | 2026-08-14 | 3243 | 0 |
| 4: Fra overklasse til gadeluder (1:2) | `2085daca-5d2c-5fd5-b705-c47ca0816d77` | `f5d187f2-ad31-4e2e-881a-2037ca0975a9` | 2026-08-21 | 1949 | 0 |

All four match the reviewed guards. No unmatched or ambiguous episodes were
found in this snapshot. Six subsequent episodes are new; the latest is S1-E10,
published 2026-10-02. No production episode ID or rating has been replaced.

## Implementation and invariants

- `feed-config.ts`: adds one static Podimo source. Runtime sheet merging already
  respects static podcast ownership, preventing a second importer for this key.
- `manual-podimo.ts`: plans reconciliation from the complete paginated podcast
  inventory, including inactive records and every source. Exact provider identity
  comes first; initial legacy links require the reviewed guards above. Other
  manual matches require a unique normalized title plus UTC publication date,
  and equal duration when both values exist. Normalization only removes the
  explicit season/episode prefix, escaped/smart quotation marks and extra spaces.
- Existing manual rows keep their internal UUID, `source`, `external_guid`,
  title, active state, catalogue keys, aliases, and all existing metadata.
  `external_episode_id` receives the Podimo UUID; the old external ID is retained
  in `metadata.original_external_episode_id`. `metadata.sync_source` identifies
  the importer. Descriptive metadata is refreshed without erasing missing fields.
- `repository.ts`: adds paginated inventory reads and guarded UUID-targeted
  metadata updates. Updates check the previous external ID and both historical
  identity keys; a stale identity fails that episode. There is no delete/merge,
  rating write, mapping write, or schema migration. New rows use the existing
  unique `(source, external_guid)` upsert convention.
- Ambiguous candidates, duplicate manual/provider records, two incoming claims
  on one record, missing expected manual records, and conflicting evidence are
  reported without overwriting. Unknown manual records block new inserts until
  reviewed. Unlinked source episodes without a valid date later than the known
  manual archive (2026-08-21) also require review: a renamed old episode must not
  be guessed to be new. Safe matches and unrelated new episodes still proceed.
- `core.ts`: only the configured migration uses reconciliation. Each write is
  isolated so one failure cannot abort the rest. The shared Podimo fetcher now
  passes malformed individual entries to its existing per-item mapper instead
  of aborting pagination. Missing duration stays null. Repeated pages, duplicate
  pagination IDs, API errors and request timeouts retain their safeguards.
- `app.js`: adds the normal Supabase archive configuration. Both old and new
  rows are read using the same canonical podcast key. It does not append the
  manual catalogue again, so there is no duplicate UI list. Rating logic is unchanged.
- Import-run details record matched/created/unchanged counts, invalid entries,
  identity issues, unmatched manual IDs, failed writes, and preserved UUIDs.

## Validation

`node scripts/critical-regression-gate.mjs` passes, including two added checks:

- `node --experimental-strip-types scripts/test-krop-podimo-migration.mjs`
- `node --experimental-strip-types scripts/test-podimo-grebet-routing.mjs`

The new regression runs the real importer and repository against an in-memory
Supabase test client, with separate episode, rating and manual-mapping tables.
It checks the ID-X invariant with ratings from two users, four guarded links,
six inserts, repeat/reordered sync with zero writes, duplicate preservation,
title-only rejection, title/date matching, missing/mutated identities, invalid
items through the real fetcher, optional fields, individual write failures,
inventory pagination beyond 200 rows, stale-update rejection, static source
ownership, mixed RSS/Podimo imports, and the actual frontend configuration.
These tests do not execute production writes or claim a production migration run.

Additional Deno 2.9.7 checks were run against both this branch and a clean export
of base `82ea006e`:

- `deno test --no-check --allow-read --allow-env supabase/functions/import-podcast-episodes/`:
  **23 pass / 3 fail on both**. Existing failures are the Mediano URL-order
  assertion (`core.test.ts:123`), Apple dry-run fixture with no valid episode
  links, and umbrella-conflict fixture (`umbrella-routing.test.ts:156`).
- Checked Deno tests: **the same ten existing type diagnostics on both**
  (`apple-podcasts.ts` inference, optional routing details in `core.test.ts`,
  nullable content and missing `fetchPodimo` option type in `core.ts`). No new
  diagnostics. These unrelated baseline issues are not changed here.

## Rollout after review

This PR is not merged and no Edge Function or production data was deployed.
After review/merge, deploy `import-podcast-episodes` with its new module via the
normal Edge Function deployment process. No SQL migration or new cron job is
needed. The six existing active all-feed shards run every twelve hours and
will include the new static feed once the function is deployed.

Run the feed `podimo_krop_til_salg` twice and inspect `episode_import_runs`.
Against the audited snapshot the first run should report four updates and six
inserts; the next should report zero updates/inserts. Recheck all four UUIDs,
the four manual mappings, and the rating on episode 1. Any later added ratings
must likewise remain untouched. The existing HTTP `dry_run` reports source
metadata only; it does not validate database identity reconciliation.

If the source or legacy records drift before deployment, review the logged
identity issues; never delete records or relax guards just to make counts match.
To suspend future sync, disable this feed and redeploy, leaving all persisted
episodes and ratings intact.
