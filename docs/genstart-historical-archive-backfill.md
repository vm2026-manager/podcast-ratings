# Genstart — historical archive backfill (2020–2023)

**Not a scheduled sync or Supabase migration.** Reviewed 2026-10-14.

The ordinary `dr_lyd_next_data` import reads the DR Lyd page's 50 most recent episodes. A separate DR RSS request with `limit=5000` was confirmed to stop around October 2023. The production database previously contained 956 Genstart episodes with its oldest at 2023-07-28; `Jakobs blå øje` (2021-01-22) was absent.

A metadata-only archive index at https://onair.dk/podcast/genstart (1430 episodes listed through 2026-06-28) contains 566 title/date/duration entries strictly earlier than 2023-07-28. All 566 title/date pairs are unique, all have positive duration, and the target episode is present exactly once. On a spot-check of 14 overlapping newer entries, the titles matched 14/14 with existing DR-imported database rows. Date offsets on newer entries mean publication time cannot be inferred precisely.

The reviewed data is embedded in `scripts/sql/backfill-genstart-pre-2023.sql`, which was written as an **atomic, insert-only, idempotent** SQL statement. It protects existing UUIDs and ratings by never changing existing rows; it checks for matching titles within +/- 7 days to avoid cross-source duplicates; and it refuses to invent episode-specific audio/playback links. Published timestamps use an approximate local noon to preserve the source calendar date, with the limitation marked in metadata.

## Preflight and postflight

Read-only preflight observed: 956 existing Genstart episodes; 0 before 2023-07-28; 17 Genstart episode ratings; 566 unique candidate rows; 0 malformed candidates. Execute the SQL through the authorized Supabase SQL connection only after reviewing the snapshot. The output gives the exact number inserted and a target-match count.

Postflight must verify that the Genstart episode count increases by the number inserted, that the archive target exists exactly once, that existing episode IDs and all 17 ratings are unchanged, and that rerunning the same statement inserts 0. Review the public frontend search to confirm the historical episode appears. Do not use the public `episode_import_runs` table as a log sink for this manual backfill.

Data provenance and limits: OnAir is a third-party archive, not an official DR API. This adds only minimal episode metadata (title, date, duration), no external audio, no descriptions, no guessed canonical IDs. A future authoritative DR old-episode import would require an identity reconciliation step before importing overlapping records.

## Production execution — 2026-10-14

Executed the exact reviewed SQL in Supabase after a successful dry-run and an `EXPLAIN` plan showing an insert with `ON CONFLICT DO NOTHING` and an indexed anti-join.

- 566 inserted; one match for `Jakobs blå øje` (2021-01-22).
- Genstart episode count: **956 → 1,522**, archive source count **566**, active count **1,518** (four preexisting inactive episodes).
- Overall episode count **38,300 → 38,866**.
- Original 956 episode-row fingerprint before/after: `c6a10f808674c045b40eb603367245a1`.
- Existing global episode rating count **184 → 184**, fingerprint before/after `c263886300a1518554addb913f72efb0`.
- Genstart-specific rating count **17 → 17**.
- Exact SQL rerun after import: **0 inserted** (idempotency verified).
- UI check in a real browser is not yet performed; the public frontend queries `podcast_episodes` by `podcast_key`, `is_active` and `title`, so the record is eligible for normal server-side search.

The SQL is retained as a reproducible **historical record only** and must not be installed as an automatic or recurring job.
