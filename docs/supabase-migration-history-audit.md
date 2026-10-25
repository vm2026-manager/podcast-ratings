# Supabase migration history audit (read-only, 2026-10-25)

## Current evidence

- Production ledger: 32 versions. Repository `main`: 15 active SQL migration
  files. Five version IDs are present in both; 27 production versions are absent
  from the active directory; 10 local versions are absent from the production
  ledger. Archiving a historical source does not change those counts.
- The five shared version IDs have matching database effects after review of
  their statements and local SQL: Apple daily scheduling, combined-rating
  deduplication, public rating momentum, private display-group membership/RPC,
  and the six Kirsten season-membership additions. Raw bytes differ because the
  ledger stores split/normalized statements and the local files include their
  own comments/formatting; the version ID alone is not treated as proof.
- Six local-only versions have same-name production counterparts at different
  timestamps. Five reviewed pairs are effect-equivalent: the 120-second hourly
  feed timeout, six staggered feed shards, 24 Narkobetjenten season memberships,
  Bakspejl episode routing with existing episode identities retained, and
  positive-episode activity in the public aggregate. The `protect_manual_episode_identities`
  pair is **not** equivalent to the final production state by itself: production
  also applied `20261008100113_harden_mapped_manual_episode_identity`, which
  extends protection to active canonical mappings and has no local counterpart.
- Four local-only migrations have no same-name production ledger entry:
  `20260830105704_manual_catalogue_episode_canonicalization.sql`,
  `20260830105706_rescued_manual_episode_ratings_CORRECTED.sql`,
  `20260906202235_backfill_rateable_manual_catalogue_episode_mappings.sql`, and
  `20260910145126_create_editorial_episode_reviews.sql`. Their execution or
  equivalence is not inferred from current row counts. In particular, the
  rescue migration contains real user/episode rating values and must not be
  replayed as a baseline migration.
- The other 21 production-only versions still have no verified local source or
  proven effect-equivalent counterpart. They include the original project
  setup/security migrations, the 20261008093915 manual-episode canonicalization,
  the mapped-identity hardening above, and two daily rating-snapshot migrations.
- The historical SQL for production version
  `20261008093805_protect_episode_identity_and_ratings` is archived verbatim in
  `supabase/migration-history/production/`. Its byte length and MD5 are tested.
  It is not active in the CLI migration directory.

## Fresh replay and rollout blockers

The active local migration set does not create the foundational
`public.podcast_episodes` or `public.episode_ratings` tables. Therefore restoring
the one recovered source does not form a self-contained fresh-database baseline.
The local `20261008112000` migration supersedes its historical trigger, but the
production-only hardening migration is still absent. A complete canonical
baseline cannot be safely declared from this audit alone.

This worktree has no Docker, local PostgreSQL client/server, or
`supabase/config.toml`. A real isolated Supabase CLI replay and dry-run could not
be performed. No `db push`, `db reset`, or migration repair command was run.
Production ledger, schema, privileges, triggers, user data, and ratings were
not modified.

## Production RLS dependency preflight

Read-only production checks found `public.episode_identity_history` has RLS off,
0 rows, no policies, only its primary key, and ACL entries for `postgres` and
`service_role`. `anon` and `authenticated` have no table CRUD privileges.
`protect_episode_identity_and_ratings()` is owned by `postgres`, is
`SECURITY DEFINER`, and has no attached trigger. The active
`podcast_episodes_protect_identity` trigger uses
`protect_podcast_episode_identity()`; `podcast_episodes_set_updated_at` is the
other user trigger. The RLS draft remains separate and must not be deployed
without explicit production approval.
