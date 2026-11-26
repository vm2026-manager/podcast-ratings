# Existing episode-import lifecycle

This document describes the existing importer and its read-only evidence stages. It does not define another importer, trigger, or schedule.

## Identity and evidence stages

The canonical identifier is the exact catalogue `Podcast-ID`; the importer uses that value as `podcast_key`. `catalogue_id` and feed evidence must also remain bound to that exact row. A source being present in the catalogue, or carrying `episodeFeedVerification.status = verified`, is not evidence that the Edge Function contains the adapter, that a scheduled invocation ran it, that rows were written, or that the frontend displayed them.

The coverage JSON now includes `lifecycle_by_podcast_id`, one record for each exact non-empty catalogue ID. It separates catalogue identity, source verification, adapter key/source/format/enabled state, deployment, scheduled invocation, database state, and frontend visibility. The coverage job can prove the first adapter stages, but deliberately marks deployment, per-ID cron attribution, production rows, and frontend visibility as unobserved. It has no Supabase Management API credential and makes no Supabase calls. The existing bounded post-import monitor adds exact active-episode counts for only new or changed IDs; it does not infer import-run history or inactive rows from anon access. Both JSON reports are uploaded as a 30-day artifact by the existing daily coverage workflow.

## Existing adapter methods

| Method | Exact adapter identity and input format | Activation | Existing run path | Identity and rating behavior |
|---|---|---|---|---|
| Ordinary RSS | Config key is the pinned feed key or `toFeedKey(Podcast-ID)`; `source` is code-owned (dynamic defaults to `sheet_<feed-key>_rss`); format defaults to `rss`; input is the exact HTTPS RSS URL. | Static config must be enabled. A new Sheet RSS is enabled only after the published verification record matches exact Podcast-ID, catalogue ID, feed URL, official link, publisher, RSS channel and unique GUID evidence. | Enabled non-Apple configs use the existing six-shard Supabase `all` schedule. | GUID is the external identity. Duplicate/empty GUIDs, changed source owners, manual maps and rating-locked UUIDs fail closed; upsert preserves the existing episode UUID and rating history. |
| Apple HTML | `feed_key=apple_<Apple show ID>`, `source=apple_podcasts_<Apple show ID>`, format `apple_podcasts_html`; episode identity is Apple episode ID from the episode URL. | The 39 legacy Apple ID / Podcast-ID pairs with existing production episode history are explicitly approved in code. New Apple IDs and mismatched owners stay disabled pending review. | `selectNormalFeedKeys` excludes Apple HTML; `apple_all` separately selects only enabled Apple configs. | Parses exact Apple show and episode IDs from public HTML. Bad pages and missing episode identity are errors; UUID/rating upsert rules are shared with the importer. |
| Apple → public RSS | This is the verified Podimo public-RSS adapter: `feed_key=podimo_public_rss_politik_for_viderekomne_med_sos_og_huxi`, `source=podimo_rss_politik_for_viderekomne_med_sos_og_huxi`, format `rss`, feed `https://feeds.simplecast.com/JE_rplcf`. It carries Podimo show UUID `3520dd9b-1787-4183-b091-aaa5ebd74a5b`, catalogue ID `catalogue-v1-047662a4`, and Apple collection ID `6833021858`. | Published exact evidence must match the current catalogue row, official Podimo page, Apple search and direct lookup, Simplecast channel/self URL, publisher and GUIDs. A plain Podimo show URL does not authorize GraphQL or RSS by itself. | Once enabled in deployed code, it participates in the normal RSS shards. | Full episodes require unique GUID, date, enclosure and duration. A valid trailer with its own GUID is imported inactive and unrateable. Existing GUID owners, UUIDs, mappings and ratings are preserved. |
| Podimo GraphQL | Static `feed_key` identifies the exact show; `source` is code-owned; format `podimo_graphql`; API endpoint `https://graphql.podimo.com/graphql`; `podcast_id` is the exact Podimo show UUID. | Exact show UUID and canonical Podcast-ID must match a code-approved enabled config. Sheet Podimo links do not create arbitrary GraphQL sources. | Enabled configs participate in the normal shards. | Podimo episode ID/GUID remains the external identity. Teasers are inactive/unrateable; cross-source duplicates and historical/rating identities are guarded before upsert. |
| DR Lyd | Static feed key/source; `dr_lyd_next_data`; the official DR Lyd page is parsed for serialized episode data. Genstart uses source `dr_genstart_rss` and its official series page. Requests identify Podcastlisten with a transparent User-Agent and request HTML explicitly. | Code-owned enabled config or exact approved route. A DR page URL is not treated as ordinary RSS. | Genstart uses existing `genstart-episodes-0700`, `-0900` and `-1200` schedules. Other enabled DR adapters use the normal shard selector; disabled routes remain inert. | DR GUID and exact route/series identity are preserved. Umbrella feeds reject unmatched or ambiguous routes rather than guessing from a title. |
| Fri Mads official article releases | `feed_key=fri_mads_official_articles`, source `fri_mads_official_article`, format `fri_mads_article_json`; reads only the existing static `data/fri-mads-articles.json` sidecar produced from the verified public Fri Mads overview. The parser accepts up to 324 contiguous verified items (12 pages × 27); the current sidecar holds the 171 cards found from #172 through #2. It requires the exact `fri mads` / `catalogue-v1-d94fc39e` identity, numbered title, date, and canonical Frihedsbrevet article URL, including only two exact legacy permalink exceptions. | Code-owned config uses the normal existing episode-import shards; the existing daily discovery workflow reads one overview page and stages only changed sidecar metadata through a pull request, preserving existing archive rows. No new schedule, article scraping, login, paywall access, article text, image, or audio download is added. | The `fri_mads_article_json` adapter parses the complete sidecar and reuses the ordinary importer’s exact identity check and idempotent upsert path. Its local dry-run/test path validates all 171 candidates without database writes. | Frihedsbrevet publishes no GUID in the verified overview, so the canonical article URL is the exact `external_guid` and database `source,external_guid` identity. `episode_url` remains that permalink; audio URL and duration are always null. `metadata_only=true`, `playable=false`, `access_type=paid`, and `rateable=true` allow the existing UUID-backed episode-rating model to rate each release through its normal database UUID. Exact global URL and same-source ownership conflicts fail closed. Existing UUIDs survive repeat imports. Edge deployment and first production import require the approved rollout: exact dry-run, current identity/rating snapshot, backup, deployment, then the normal existing import cadence; no direct manual row insertion is used. |
| Radio4 JSON | Static feed key/source; format `radio4_json`; endpoint is a Radio4 API URL. For example `radio_iiii_et_kapitel_for_sig` uses source `radio_iiii_et_kapitel_for_sig_api`; each season/episode route is code-owned. | Matching code-owned enabled adapter and exact GUID/route are required. A Sheet row alone cannot activate a route. | Enabled adapters use the normal feed shards. The observed RADIO IIII config is disabled until its approved routes are present. | Exact API GUID and route determine the catalogue Podcast-ID; ambiguous or unmatched episodes are reported, not remapped. Existing source provenance and rating UUIDs are preserved. |
| Manual catalogue episodes | Exact `Podcast-ID` plus the curated `manualEpisodes`/manual-entry key; canonical map is `manual_catalogue_episode_map`; source is the existing manual-catalogue source. There is no external RSS/API format. | Curated entries and, where applicable, an exact canonical mapping are required. | No separate feed schedule. Existing importer reconciliation runs only where its configured feed path invokes the manual synchronizer; static frontend manual entries remain the existing local/manual path. | Canonical manual keys map to stable UUIDs. Pending mappings retain local-rating fallback; no episode is matched by a loose title across Podcast-IDs. |

The production cron inventory read on 2026-11-14 contained six enabled `all-episode-feeds-hourly-shard-N` jobs at `20/25/30/35/40/45 */12 * * *` UTC, plus the three Genstart jobs. Despite “hourly” in the shard names, these are 12-hourly. Successful `cron.job_run_details` rows prove the scheduled function invocation completed; only exact `episode_import_runs` and `podcast_episodes` reads prove a particular podcast's import result. The GitHub `episode-feed-coverage` workflow (`37 6 * * *`) is a separate daily audit and never calls the importer.

### Styr på historien (Podimo)

The exact Podimo GraphQL config uses `Podcast-ID=styr på historien`, Podimo show UUID `3717c2b0-c85f-43bb-8a28-a992018f14de`, catalogue ID `catalogue-v1-4a74e834`, and official show URL `https://podimo.com/dk/shows/styr-pa-historien`. Runtime activation requires the current catalogue to contain one row matching all four identities, including the `open.podimo.com/podcast/<UUID>` feed. A different `kampen om historien` row cannot receive these episodes. The adapter imports episode metadata only; audio URLs are null. The regular 12-hour shard schedule is the existing run path. Edge deployment and the first production import remain separate approval steps.

## Why `verified` can still mean “not imported”

1. Catalogue verification records identity evidence and is published through the normal Sheets-to-GitHub PR. It does not deploy Edge code.
2. Runtime adapter generation is separately controlled by the deployed Edge Function's code. `enabled_in_main_code` is not `enabled_in_deployed_edge`.
3. The cron invokes the deployed function on its configured selectors. A successful schedule row does not prove the target key was present in that deployed version or selected by that shard.
4. `episode_import_runs` and active/inactive `podcast_episodes` rows are separate database evidence. The anon post-import monitor can count active rows for a bounded changed-ID set, but cannot see inactive trailer rows or the protected import ledger.
5. The frontend loads an enabled podcast's episodes by exact database Podcast-ID and `is_active=true`, then removes non-rateable rows. It renders one returned episode; it does not gate display on `episode_feature_enabled`.

`MINIMUM_RATEABLE_EPISODE_COUNT = 2` is used by importer health metadata (`episode_feature_enabled`), not as a write precondition or frontend visibility threshold. Therefore one active rateable EP01 plus an inactive trailer can have `active_rateable_episode_count=1` and `episode_feature_enabled=false`, while EP01 remains displayable. Regression tests lock down both facts.

For `politik for viderekomne med søs og huxi`, the latest read-only audit found the target GUIDs absent from production tables and found Edge version 59 (updated 2026-11-12) missing the new target adapter identities, while current main contains the approved adapter. This is a known deployment blocker, not a failed catalogue verification. Do not deploy or import without separate explicit owner approval.

## Regression evidence

The existing adapter-specific regressions remain authoritative: RSS source verification and idempotency (`test-rss-feed-verification.mjs`), Apple HTML parser (`apple-podcasts.test.ts`), Podimo show identity/routing (`test-two-podimo-show-imports.mjs`, `test-podimo-grebet-routing.mjs`, `test-sidste-nedtaelling-podimo.mjs`), DR Lyd metadata/routing tests, Radio4 staging/routing tests, and manual-sheet episode tests. `test-episode-import-lifecycle.mjs` adds cross-adapter coverage for exact IDs, activation blockers, deployment evidence gaps, duplicate/collision failures, and one-episode frontend rendering. The full `critical-regression-gate.mjs` is required before every commit and push.

The Fri Mads adapter adds no cron, polling loop, broad backfill, production episode write, migration, rating write, article scraper, or media download. Its code-owned feed config participates only when the existing importer code is deployed and its ordinary schedule runs; those are separate production activation stages.

## Failure handling and operations

The shared feed fetcher makes at most one additional request after a network
failure, timeout, HTTP 408, HTTP 429, or HTTP 5xx, with a short fixed delay.
Permanent HTTP 4xx responses such as 403 and 404 are not retried. Read-only
PostgREST identity lookups retry `PGRST303` once; writes are never retried by
this policy. Failed PostgREST operations retain a safe error code or HTTP
status in the import-run error message.

Each Edge invocation logs a compact `[episode-import] feed issues` record when
any feed is partial or failed. It includes the source, Podcast-ID, error and
routing counts, but omits episode titles and GUIDs. Use that record with the
exact `episode_import_runs` rows to distinguish transient service failures
from source changes, routing gaps, and identity-review blockers. Repeated
permanent source errors require a verified feed or provider change; the
importer does not silently disable a feed or weaken identity checks.

## Verified source issues (2026-11-26)

The `hvis_du_vil_vide_mere` OmnyContent playlist returned HTTP 200 but only one
item. Its publisher's canonical Omny RSS endpoint returned 684 items with the
expected show identity, so the static feed now points to that canonical URL.
The change is code-only and takes effect after an approved deployment.

Other observed production issues need separate source or operational follow-up:

- DR Lyd page feeds returned HTTP 403 from the Edge importer. The Genstart
  adapter now uses DR's official public radio API only as a fallback after that
  exact page-fetch status. It passes API items through the existing DR Lyd
  mapper, preserving `source`, `podcast_key`, external GUIDs, and episode UUIDs.
  A read-only comparison found all 50 newest API items matched the page items
  exactly across GUID, title, description, publication date, duration, URL,
  active state, and metadata. Genstart's public RSS is not a safe sole
  replacement: it lagged those newest releases and its latest `pubDate` differed
  from the original publication date. The fallback is limited to Genstart and
  HTTP 403; API errors, timeouts, malformed data, and all other page errors
  fail closed without writing episode rows. The next approved Edge deployment
  and import will establish whether Edge egress can reach the API.
- Hvepsereden's catalogue feed returned HTTP 404. The official source identity
  could not be verified, so do not substitute a similarly named or successor
  show without catalogue-owner confirmation.
- Mediano unmatched titles and known-no-destination routes are routing review
  items. Routes without an exact catalogue destination intentionally remain
  inactive; approve only mappings backed by the canonical Podcast-ID.
- Podimo's historical transition guard rejected an unreviewed episode. Keep
  this fail-closed until its exact show/episode identity is reviewed.
- Fri Mads and My Favorite Murder had existing-episode lookup failures. The
  importer now preserves safe PostgREST error codes on reads, but the specific
  production cause cannot be determined until the code is deployed and a new
  run records the code. No database changes or writes are part of this fix.
