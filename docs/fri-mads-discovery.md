# Fri Mads read-only discovery

## Primary public source

The approved primary source is the publisher's public series overview: <https://frihedsbrevet.dk/nyhedsbrev/fri-mads/>. A read-only check on 11 November 2026 returned HTTP 200 and 27 numbered cards in descending order from #172 through #146. The linked public `?paginate=2` page showed #145 through #119 and linked onward to page 3. Only the overview pages are read; article pages, paywalled text, images, and audio are never requested.

The public cards expose the exact `Fri Mads #N:` heading, canonical numbered permalink, byline, and Danish publication date. The parser accepts only the two observed card markup variants, the exact `Fri Mads` category, `frihedsbrevet.dk`, and a `/fri-mads-N-slug/` URL whose number matches the heading. Unknown markup, missing byline/date, duplicate IDs, or gaps fail closed. Dates are emitted as calendar dates; no timezone or time is inferred.

The publisher RSS at <https://frihedsbrevet.dk/feed/> is a general feed of roughly ten recent articles across series, not a complete Fri Mads index. It is not fetched by the daily discovery because the approved overview already supplies the metadata needed. If RSS metadata is added later, it may supplement an overview card only after exact release-number and canonical-permalink equality; its repeated site-root GUID is never a release identity.

The stable dry-run identity is the exact series number plus the verified canonical permalink. There is no title fuzzy matching. The default `afterNumber=172` is a test/dry-run baseline, not persistent production cursor state. Discovery normally requests only the first overview page. When a contiguous first page contains newer releases but does not reach the cursor boundary, it may request the single fixed older page `?paginate=2`; it never follows further pagination. At most 27 new releases are returned per run. A boundary mismatch, number gap, or larger historical window produces no releases and a fixed review reason.

## Classification and limits

The existing catalogue identity remains `Podcast-ID=fri mads`, `catalogue_id=catalogue-v1-d94fc39e`, with the approved overview Link and historical article #140 in `accessEvidenceUrl`. Every discovered item is metadata-only paid article content: `contentKind=article`, `metadataOnly=true`, `playable=false`, `rateable=false`, `audioUrl=null`. No audio URL, duration, source GUID, or episode is invented. The adapter does not fetch article links, copy article text, or examine images/media.

The command `node scripts/discover-fri-mads-releases.mjs --dry-run` makes one bounded HTTPS GET in its normal path, with an 8-second timeout, redirects rejected, and a 512 KiB response cap. It makes a second bounded GET only for the documented incremental boundary condition. Reports contain allowlisted metadata/reason codes and state zero Supabase, Sheet, catalogue, or episode writes/imports. Network errors, raw response bodies, and arbitrary URLs are not logged.

The existing `episode-feed-coverage` workflow runs daily at 06:37 UTC and invokes this dry-run in that cadence; no new cron, storage, database access, or Supabase request was added. Identical source markup and cursor produce identical release IDs on repeated runs. The generic RSS is not used as primary discovery and no historical backfill is performed.

This is discovery only. It does not configure production episode import, persist a cursor or article record, enable article rating, modify the catalogue, or deploy an Edge Function. Any such work requires separate owner/product approval and fresh read-only identity/rating snapshots.
