# Sheet feed overrides and identity review

Audit performed 17–18 October 2026 against main `15c199a8`, the published Sheet,
live catalogue, Apple lookup, both RSS feeds and read-only Supabase queries.

## Confirmed incident: do not import the replacement yet

- Published `Ark1`, gid `0`, CSV record/Sheet row **309** (header included),
  `Placering=310`, `Podcast-ID=har du hørt`, `catalogue_id=catalogue-v1-504fe18d`.
- Title `Har du hørt?`, host `Nikita Klæstrup`, publisher `Viaplay`.
- Exact **Feed**: `https://open.podimo.com/podcast/61f4484d-f2d7-4fa3-b7c7-892d78fc5bff`.
  This is a show page, not an RSS feed. Apple is in **Link/Kilde**, not Feed.
- Exact **Link**:
  `https://podcasts.apple.com/dk/podcast/har-du-h%C3%B8rt%3F-med-nikita-kl%C3%A6strup/id1851213764`.
- Both main's `data/podcasts.json` and live
  <https://podcastlisten.dk/data/podcasts.json> contain that same identity and Feed.
- <https://itunes.apple.com/lookup?id=1851213764&entity=podcast> returns
  `collectionId=1851213764`, `Har du hørt? med Nikita Klæstrup`, `artistName=Viaplay`,
  and `feedUrl=https://feeds.transistor.fm/har-du-hort-med-nikita-klaestrup`.
- The Transistor channel agrees; latest observed episode is
  `Er Susan Astani den onde stedmor?`, 15 October 2026 at 14:00 +02:00.
  A read-only `parseFeed`/`mapEpisodes` probe with the actual importer code maps
  **48 episodes with 48 unique GUIDs**. No repository or Edge import was invoked.
- Static key `har_du_hoert`, source `omny_har_du_hoert_rss`, instead points to
  `https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/27e90989-ce53-4ba3-ae6a-ad4800e68fc9/b0a50925-4c9f-47f5-81b7-ad4800e68fd2/podcast.rss`.
  This channel explicitly names **William Ejsing**. Its final episode says the
  programme is ending. It is a different show, not a verified RSS relocation.

Production project `mgaqycuexbyplqcmcsbc` contains 18 active episodes under the
canonical key, dated 20 August–17 December 2020, all with the Omny source.
Latest UUID: `562b97ef-d267-4062-b65e-ef4aa904631e`; GUID:
`202012171210_har_du_hoert`. There are zero attached episode ratings and zero
manual catalogue mappings for these episodes. This does **not** authorize changing
their identities or imply that podcast-level/editorial ratings can be moved.
Identity baseline: MD5 of comma-joined `id:source:external_guid`, ordered by UUID,
is `84d8cb37dcf556eb76585f258025caf7`.
The 17 October import runs at 00:20:07 and 12:25:10 UTC both fetched 18 and
inserted/updated zero. The deployed Edge Function inspected was version **46**.

**Production stop:** no Sheet edit, episode/rating write, merge, Edge deploy or
import is part of this change. No approval entry is supplied for `har du hørt`.
Decide explicitly how two different shows should be represented while preserving
the requested canonical ID and all existing UUIDs/provenance before any write.
Changing only the feed URL would mix the two shows under one canonical identity.

## Flow and root cause

`scripts/sync-sheet-data.mjs` reads the published Sheet and copies the Feed field
to `data/podcasts.json`. Its workflow publishes that catalogue. The runtime fetches
the catalogue configured by `PODCASTS_JSON_URL`, discards generated static rows,
and merges manually maintained feed defaults. Before this change, any existing
static podcast/feed/source match was counted as a duplicate and silently skipped.
Current main already uses canonical Podcast-ID; the older local checkout derived
IDs from titles, but that is not the current main implementation.

`index.ts` selects runtime feeds and calls `core.ts`; `repository.ts` looks up and
upserts by `(source,external_guid)`. Existing identity/manual-mapping guards remain
unchanged. `app.js` loads the catalogue separately from episode queries against
`podcast_episodes` by canonical podcast key and active state. This allows new
catalogue metadata to appear alongside an unrelated old episode list.
Read-only browser verification on 18 October confirmed this exact mismatch:
Nikita Klæstrup/Viaplay in the detail panel, then `Viser 16 af 18 episoder` in
the episode panel, headed by the 17 December 2020 final Omny episode.
The exact configured production `PODCASTS_JSON_URL` secret was not read; matching
public catalogue content and deployed source are confirmed independently.

## Policy

1. Match **exact canonical Podcast-ID**, never display title. Normalization is
   used only to detect ambiguous collisions, not to authorize a remapping.
2. Leave unchanged feeds intact. Detect conflicting IDs/URLs using the complete
   input before applying any overrides, so row order cannot choose a winner.
3. DR, Podimo, Apple and other adapters, umbrella ownership/routes, manual links,
   metadata-only sources and cross-source deduplication remain protected.
4. For ordinary RSS, an exact `reviewed_sheet_feeds` entry in the static config
   permits the Sheet URL to replace the old URL, preserving every other field.
   The review must bind `from_url`, `to_url`, `same_show_and_guids: true`, and
   nonempty `evidence`. The Sheet cannot provide its own approval.
5. Before adding a review, independently inspect publisher/show identity and
   overlap with existing episode GUIDs. Changed GUIDs require a separate identity
   plan. Do not infer identity from a similar title, URL syntax or a shared host.
6. Unreviewed/ambiguous changes remain on the old config with an explicit warning.
   Invalid URLs and known show-page URLs cannot become generic RSS imports.
   New `apple:ID` entries retain the existing disabled Apple-adapter policy.

This deliberately does not claim that syntactically valid HTTP URLs prove RSS
content or podcast identity. Reviews are version-controlled evidence, not runtime
network discovery. A publisher changing content behind an approved URL still
requires operational monitoring; this patch cannot prove future feed identity.

## Status and quota

Run the offline audit with Node 24:

```sh
node --experimental-strip-types scripts/audit-runtime-feeds.mjs
```

It prints `active_feeds` (URL, source, enabled status, origin), `feed_resolutions`
(Sheet value, selected URLs, mismatch and reason) and `feed_warnings`. The Edge
response exposes the same `feed_config_audit`; normal imports also emit an explicit
warning log. Existing catalogue-load failure reporting is retained. The offline
audit performs **zero network requests and zero writes**.

For the audited 1,326-row catalogue: 47 review warnings (39 invalid/non-RSS,
5 protected adapter changes, 2 conflicting rows, 1 ordinary RSS identity review).
The conflict is `adfærd` vs `borgen unplugged 2 0` sharing one SoundCloud feed;
the ordinary RSS review is DKPOL. These are reported, not automatically remapped.

All 46 manually configured feeds remain byte-for-byte unchanged in the resolved
configuration compared with the previous resolver on the same catalogue (including
existing runtime routes). Enabled feed configs fall **281 → 246** because 35
Podimo show pages are no longer treated as RSS. This removes up to 35 initial feed
fetches per complete normal sweep (70/day if two full sweeps/day), not 35 Edge
invocations; actual savings depend on sharding, retries and schedules. No new
cronjob, frequency increase, lookup service or mass import is introduced. A future
approved ordinary RSS override replaces one fetch with one fetch; payload size and
new episode database writes may differ and must be assessed for that feed.
Audit response/log payloads grow; no paid service or schema is added.

## Validation and release boundary

Regression coverage includes reviewed RSS override, unchanged feed, unreviewed and
invalid inputs, case/ID ambiguity, two-ID URL conflicts in either row order, Apple
syntax, DR RSS, special/manual configurations, disabled-state preservation, stale
review rejection, database conflict-key/UUID preservation and visible warnings.
The critical gate additionally exercises actual manual-episode/rating protections,
DR/Podimo/umbrella routing, canonical IDs and existing UI behavior.

After an explicit identity decision and approved release: recheck PR checks and
merge, separately verify deployed function version/source (a GitHub merge does not
prove an Edge deploy), capture all UUIDs/provenance and rating/mapping baselines,
then run only the specifically approved single-feed import. Verify new episode
dates, unchanged historical UUIDs/ratings, no duplicate GUID/audio/episode URLs and
the actual live episode panel. Until then the live data remains unfixed.
