# Fri Mads read-only discovery

## Verified source and scope

On 11 November 2026 the public publisher feed at `https://frihedsbrevet.dk/feed/` returned HTTP 200 and ten RSS items. One item was explicitly identified by all of these fields: title `Fri Mads #172: Alle elsker Mette`, category `Fri Mads`, author `Mathias Helmuth`, publication date 8 November 2026, and the canonical same-host permalink `https://frihedsbrevet.dk/fri-mads-172-alle-elsker-mette/`. The item had no enclosure. The feed is a general publisher feed, so other articles are ignored unless the exact series category, exact `Fri Mads #N:` title format, and matching canonical permalink number all agree. No article page is fetched.

The RSS `guid` is marked `isPermaLink="false"` but points to the site root for all ten sampled items. It is therefore not a usable release identity. Discovery withholds that value as a `sourceGuid` and uses only the exact release number plus the canonical permalink as the deterministic `releaseId`. Duplicate release numbers, duplicate permalinks, number/permalink disagreement, conflicts with historical article #140, or a gap after the current cursor fail closed with no partial releases.

The public `robots.txt` disallows `/wp/wp-admin/` and does not disallow `/feed/`. The existing catalogue identifies Fri Mads as paid and keeps the newsletter overview link, with article #140 as historical `accessEvidenceUrl`. This adapter preserves that identity and treats any result as paid article metadata only. It does not copy descriptions, article text, images, or audio; it does not fetch article URLs, create episodes, or make content playable or rateable.

## Execution and limits

`node scripts/discover-fri-mads-releases.mjs --dry-run` makes at most one HTTPS GET to the fixed official RSS URL, with an 8-second timeout, redirects rejected, and a 256 KiB response limit. The default cursor is the already verified #172 baseline, so it does not backfill #172 or earlier releases. The CLI has no write mode. Reports state zero Supabase calls, catalogue writes, Sheet writes, episode imports, and article requests. Missing dates stay `null`; no audio URL or duration is synthesized. Teasers and any actual audio enclosure are withheld for separate review.

The existing `episode-feed-coverage` GitHub Actions workflow runs daily at 06:37 UTC. It now runs the offline regression test and the read-only discovery in that existing scheduled job; no new schedule or Supabase invocation was added. If the exact Fri Mads series is absent from the feed window, the report explicitly says `series_absent_from_feed_window`; it does not imply that no new article exists. A missing number after the cursor is a review error, not a silent skip. The workflow logs only the allowlisted discovery report and fixed reason codes.

This is discovery/dry-run only. It does not configure the Supabase episode importer or deploy its Edge Function. Production import, episode persistence, article-rating behavior, and any change to the paid-content model require separate product/owner approval and a new identity/rating snapshot.
