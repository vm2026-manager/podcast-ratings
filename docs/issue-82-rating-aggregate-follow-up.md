# #82 - Sæsonvurderingslås

## Database follow-up (not applied)

The client now treats a Kirsten season rating as one rating of the display
group for the signed-in user's personal score. A preserved direct group rating
is shown only while that user has no rated seasons. No database migration,
production write, rating remapping, or migration-ledger change is included.

PR #501's migration
`20261107185417_prioritize_display_group_direct_ratings.sql` replaces
`public.get_display_group_community_stats(text[])` and currently uses
`coalesce(max(direct_group_ratings.rating), avg(effective_user_ratings.rating))`.
That rule gives a direct group rating priority in the public aggregate when a
user has both direct and season ratings. The product rule for #82 gives that
user's season ratings priority. The client fix therefore does not change the
deployed SQL function; public/community group scores can differ from the
personal season-derived score if such overlap is created later.

A fresh read-only production query found 0 direct group rows/users, 2 users
with season ratings, and 0 users in both sets. There is no current direct
rating to preserve or reconcile. Before any SQL change, prepare and
review a read-only dry run with per-user direct/season overlap counts and
fingerprints, update aggregate-only tests for direct-only, season-only, and
overlapping users, and obtain explicit owner approval for the production
function change. Do not modify rating rows or the migration ledger as part of
that follow-up.
