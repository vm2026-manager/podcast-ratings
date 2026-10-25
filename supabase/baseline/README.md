# Schema-only Supabase bootstrap baseline

`schema_only.sql` is a schema-only snapshot assembled from a read-only query of
the production PostgreSQL catalogs on 2026-10-25. It is a bootstrap artifact for
a disposable or new Supabase project. It is deliberately outside
`supabase/migrations`, so normal migration discovery and production `db push`
cannot apply it.

The snapshot contains the application schemas' current tables, constraints,
indexes, functions, views, RLS flags and policies, triggers, object ACLs, and
the `public` schema's default object privileges. Supabase-managed roles and the
`auth.users` table are supplied by the Supabase Postgres image; the test does
not start the Auth service and no auth data is copied. Cron jobs and other
operational records are excluded.

## Historical source and later effects

The original production statements are preserved byte-for-byte in
`../migration-history/production/`:

| Source | Bytes | MD5 |
| --- | ---: | --- |
| Migration `20260719203000`, statement #2 (`podcast_episodes`) | 875 | `f6339b8536db9d54594b8353b117ef9d` |
| Migration `20260719203000`, statement #8 (`episode_ratings`) | 498 | `db2446ce1cb1370dcab9fd1ba13a2879` |

These archived statements are provenance artifacts, not active migrations.
The current catalog snapshot has the later `episode_ratings_episode_id_fkey`
behavior `ON DELETE RESTRICT`; statement #8 originally specified
`ON DELETE CASCADE`. The snapshot uses the current catalog definition.

The production ledger has no `CREATE TABLE public.manual_catalogue_episode_map`
statement. Its current definition was extracted from `pg_catalog` and included
in the snapshot. The local review-only data migration is not treated as proof of
how the production table was provisioned and none of its data statements are
included.

## Data and rollout boundaries

The baseline contains no table rows, user IDs, episode UUIDs, ratings, manual
episode mappings or aliases, sequence values, or migration-ledger rows. It does
not replay rescue-rating inserts, identity rewrites, catalogue backfills, or
cron scheduling statements. The only SQL that writes to tables is inside
version-controlled function definitions, which preserve application behavior;
those functions are not invoked during the empty-database replay.

`public.episode_identity_history` has RLS disabled in this snapshot because
that is the audited production state. PR #335's RLS migration remains separate
and draft. No production database, migration history, or user data was changed
to produce or test this baseline.

The GitHub Actions workflow creates a temporary Supabase project on an
ephemeral runner, starts only the local Postgres service,
copies this file into that temporary project's migration directory, and runs
`supabase db reset --local --no-seed` twice. The source file itself never enters
the repository's active migration directory.
