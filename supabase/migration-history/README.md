# Supabase migration history archive

Files in `production/` are forensic copies of historical SQL recovered from
`supabase_migrations.schema_migrations`. They are **not runnable migrations** and
are intentionally outside `supabase/migrations`, so Supabase CLI discovery and
fresh-database replay do not execute them.

Do not copy an archived file into `supabase/migrations`, run it against
production, or use migration repair to make the ledger appear aligned. First
establish a complete repeatable baseline and prove the whole migration sequence
in a disposable Supabase environment.

## Recovered source

`production/20261008093805_protect_episode_identity_and_ratings.sql` is the
verbatim `statements[1]` value for production migration
`20261008093805 protect_episode_identity_and_ratings`.

- UTF-8 byte length: 3,600
- MD5: `6c2c3e22bce1097dae2abc8d05779f67`
- Effects in its historical position: creates `episode_identity_history`,
  defines the `SECURITY DEFINER` identity guard, revokes direct client table
  access, and attaches the temporary `trg_protect_episode_identity_and_ratings`
  trigger.
- Supersession: production migration `20261008095631` drops that trigger and
  attaches `protect_podcast_episode_identity()` instead. The repository's later
  `20261008112000_protect_manual_episode_identities.sql` also drops the old
  trigger before attaching the replacement.

This source is evidence of the historical transition, not a request to restore
that trigger as the final state. Production migration history and schema were
only read; no production DDL or data writes were performed.
