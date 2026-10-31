import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mergeSheetFeedConfigs, loadRuntimeFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { selectNormalFeedKeys, runEpisodeImport } from "../supabase/functions/import-podcast-episodes/core.ts";
import { APPROVED_SHEET_FEED_BASELINE } from "../supabase/functions/import-podcast-episodes/sheet-feed-approval-baseline.ts";

const oldUrl = "https://example.test/old.rss";
const newUrl = "https://example.test/new.rss";
const config = { podcast_key: "canonical id", source: "historical_source", feed_url: oldUrl };
const reviewed = { ...config, reviewed_sheet_feeds: [{ from_url: oldUrl, to_url: newUrl,
  same_show_and_guids: true, evidence: "Verified publisher relocation and unchanged episode GUIDs in fixture" }] };
const row = (Feed, id = "canonical id") => ({ "Podcast-ID": id, Titel: "Display title is not identity", Feed });
const merge = (rows, c = reviewed) => mergeSheetFeedConfigs(rows, { legacy_key: c });

const overridden = merge([row(newUrl)]);
assert.deepEqual(overridden.configs.legacy_key, { ...reviewed, feed_url: newUrl });
assert.equal(overridden.audit.active_feeds[0].origin, "sheet_override");
assert.equal(overridden.audit.feed_resolutions[0].differs_from_sheet, false);
assert.deepEqual(merge([row(oldUrl)]).configs.legacy_key, reviewed);
assert.equal(merge([row(oldUrl)]).audit.feed_warnings.length, 0);
const automaticCandidate = merge([row(newUrl)], config);
assert.equal(automaticCandidate.configs.legacy_key.feed_url, oldUrl);
assert.equal(automaticCandidate.configs.legacy_key.sheet_feed_change, undefined);
assert.equal(automaticCandidate.audit.feed_warnings[0].reason, "feed_change_requires_code_approval");
for (const value of ["not a URL", "javascript:alert(1)", "https://open.podimo.com/podcast/show", "https://open.spotify.com/show/test"]) {
  const result = merge([row(value)]);
  assert.equal(result.configs.legacy_key.feed_url, oldUrl);
  assert.equal(result.audit.feed_warnings[0].reason, "invalid_or_non_rss_feed");
  assert.equal(result.audit.invalid_feed_urls_skipped, 1);
}
for (const rows of [[row(newUrl), row(newUrl, "another")], [row(newUrl, "another"), row(newUrl)]]) {
  const result = merge(rows);
  assert.equal(result.configs.legacy_key.feed_url, oldUrl);
  assert.equal(Object.keys(result.configs).length, 1);
  assert.equal(result.audit.feed_warnings.length, 2);
}
assert.equal(merge([row(newUrl), row(oldUrl)]).audit.feed_warnings.length, 2);
assert.equal(merge([row(newUrl, "Canonical ID")]).audit.feed_warnings[0].reason, "special_or_ambiguous_owner");
const owned = mergeSheetFeedConfigs([row(newUrl)], { legacy_key: reviewed, other: { ...config, podcast_key: "other", feed_url: newUrl } });
assert.equal(owned.audit.feed_warnings[0].reason, "feed_owned_by_other_podcast");
const apple = merge([row("apple:1851213764")]);
assert.equal(apple.configs.legacy_key.feed_url, oldUrl);
assert.equal(apple.audit.feed_warnings[0].reason, "special_adapter_preserved");
const knownPodimoId = "0db490b8-907e-4f35-bd48-60eae9f8805b";
const knownPodimoConfig = { podcast_key: "canonical id", source: "podimo_historical_source",
  feed_url: "https://graphql.podimo.com/graphql", format: "podimo_graphql", podcast_id: knownPodimoId,
  podimo_show_url: "https://podimo.com/dk/shows/canonical-id" };
const knownPodimo = mergeSheetFeedConfigs([row(`https://open.podimo.com/podcast/${knownPodimoId}`)], { legacy_key: knownPodimoConfig });
assert.deepEqual(knownPodimo.configs.legacy_key, knownPodimoConfig,
  "an exact Podimo show ID uses its existing GraphQL adapter and historical source unchanged");
assert.equal(knownPodimo.audit.feed_warnings.length, 0);
for (const feed of [
  "https://open.podimo.com/podcast/ffffffff-ffff-ffff-ffff-ffffffffffff",
  "https://open.podimo.com/podcast/0db490b8-907e-4f35-bd48-60eae9f8805b?next=show"
]) {
  const unsafePodimo = mergeSheetFeedConfigs([row(feed)], { legacy_key: knownPodimoConfig });
  assert.equal(unsafePodimo.configs.legacy_key.feed_url, knownPodimoConfig.feed_url);
  assert.equal(unsafePodimo.audit.feed_warnings[0].reason,
    feed.includes("?") ? "invalid_or_non_rss_feed" : "podimo_show_id_mismatch");
}
const unknownPodimo = mergeSheetFeedConfigs([row(
  "https://open.podimo.com/podcast/1aba8d20-8fbd-4606-aed0-1329f597cf32", "q og co")], {});
assert.equal(unknownPodimo.configs.q_og_co, undefined,
  "a new Podimo show cannot become a dynamic RSS source");
assert.equal(unknownPodimo.audit.feed_warnings[0].reason, "podimo_adapter_review_required");
const newApple = mergeSheetFeedConfigs([row("apple:1851213764", "new")], {});
assert.equal(newApple.configs.apple_1851213764.format, "apple_podcasts_html");
assert.equal(newApple.configs.apple_1851213764.enabled, false);

// Existing active ordinary Sheet feeds retain their exact source, URL and enabled state.
const published = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const publishedRuntime = mergeSheetFeedConfigs(published);
const publishedApproved = publishedRuntime.audit.active_feeds
  .filter(feed => feed.origin === "sheet" && feed.enabled && feed.source.startsWith("sheet_"))
  .map(({ feed_key, podcast_key, source, feed_url }) => ({ feed_key, podcast_key, source, feed_url }))
  .sort((a, b) => a.podcast_key.localeCompare(b.podcast_key, "da-DK"));
assert.equal(APPROVED_SHEET_FEED_BASELINE.length, 204);
assert.deepEqual(publishedApproved.map(feed => [feed.podcast_key, feed.feed_url]),
  [...APPROVED_SHEET_FEED_BASELINE].sort((a, b) => a[0].localeCompare(b[0], "da-DK")));

// Feed metadata for a new or changed podcast remains review-only; row fields
// cannot grant import permission. Existing feed owners block duplicate URLs.
const spreakerFeed = "https://www.spreaker.com/show/5278832/episodes/feed";
const publishedPaSporet = published.rows.find(item => item["Podcast-ID"] === "pa sporet");
assert.ok(publishedPaSporet, "the published catalogue contains the canonical pa sporet row");
const publishedPaSporetSnapshot = structuredClone(publishedPaSporet);
const stagedCatalogue = structuredClone(published);
const stagedPaSporet = stagedCatalogue.rows.find(item => item["Podcast-ID"] === "pa sporet");
assert.notEqual(stagedPaSporet, publishedPaSporet, "staged changes use a cloned row");
assert.equal(stagedPaSporet.catalogue_id, "catalogue-v1-374b47c3");
stagedPaSporet.Link = "https://open.spotify.com/show/3FIqz5R0sIBB41uN2OEGK0";
stagedPaSporet.Feed = spreakerFeed;
const stagedCatalogueSnapshot = structuredClone(stagedCatalogue);
assert.equal(stagedPaSporet.Feed, spreakerFeed, "the cloned fixture contains the proposed feed");
const stagedPaSporetRuntime = mergeSheetFeedConfigs(stagedCatalogue);
assert.equal(stagedPaSporetRuntime.configs.pa_sporet.enabled, false);
assert.equal(selectNormalFeedKeys(stagedPaSporetRuntime.configs).includes("pa_sporet"), false);
assert.equal(stagedPaSporetRuntime.audit.feed_warnings.find(entry => entry.podcast_key === "pa sporet").reason,
  "explicit_activation_required");
assert.deepEqual(stagedCatalogue, stagedCatalogueSnapshot,
  "mergeSheetFeedConfigs does not mutate its catalogue input");
assert.deepEqual(publishedPaSporet, publishedPaSporetSnapshot,
  "staging and resolving a feed never changes the published catalogue row, whether or not it already has Feed");
const newFeed = mergeSheetFeedConfigs([{ ...row(spreakerFeed, "pa sporet"), enabled: true }], {});
assert.equal(newFeed.configs.pa_sporet.enabled, false);
assert.equal(selectNormalFeedKeys(newFeed.configs).includes("pa_sporet"), false);
assert.equal(newFeed.audit.feed_warnings[0].reason, "explicit_activation_required");
const missingId = mergeSheetFeedConfigs([{ Feed: newUrl, "Podcast-ID": "" }], {});
assert.equal(Object.keys(missingId.configs).length, 0);
assert.equal(missingId.audit.feed_warnings[0].reason, "missing_podcast_id");
const [baselineOwnerId, baselineOwnerUrl] = APPROVED_SHEET_FEED_BASELINE[0];
const baselineOwner = publishedApproved.find(feed => feed.podcast_key === baselineOwnerId);
const duplicateOwner = mergeSheetFeedConfigs([row(baselineOwnerUrl, "new podcast identity")]);
assert.equal(duplicateOwner.configs.new_podcast_identity, undefined);
assert.equal(duplicateOwner.audit.feed_warnings[0].reason, "feed_owned_by_other_podcast");
const changedExisting = mergeSheetFeedConfigs([row(newUrl, baselineOwner.podcast_key)]);
assert.equal(changedExisting.configs[baselineOwner.feed_key].feed_url, baselineOwner.feed_url,
  "a metadata change cannot displace an existing approved feed");
assert.equal(selectNormalFeedKeys(changedExisting.configs).includes(baselineOwner.feed_key), true);
assert.equal(changedExisting.audit.feed_warnings[0].reason, "feed_change_requires_code_approval");
const missingExistingFeed = mergeSheetFeedConfigs([{ "Podcast-ID": baselineOwner.podcast_key, Feed: "" }]);
assert.equal(missingExistingFeed.configs[baselineOwner.feed_key].feed_url, baselineOwner.feed_url,
  "a blank metadata field cannot deactivate an existing approved feed");
assert.equal(selectNormalFeedKeys(missingExistingFeed.configs).includes(baselineOwner.feed_key), true);

const runtimeWithChangedFeed = await loadRuntimeFeedConfigs({ podcastsJsonUrl: "https://example.test/catalogue.json",
  fetchPayload: async () => ({ rows: [row(newUrl, baselineOwner.podcast_key)] }) });
assert.equal(runtimeWithChangedFeed.configs[baselineOwner.feed_key].feed_url, baselineOwner.feed_url,
  "the production loader retains the baseline feed on Sheet drift");
assert.equal(selectNormalFeedKeys(runtimeWithChangedFeed.configs).includes(baselineOwner.feed_key), true);
assert.equal(runtimeWithChangedFeed.audit.feed_warnings[0].reason, "feed_change_requires_code_approval");

// A new feed is activated only through an explicit code-owned configuration.
const explicitKey = "explicit_activation";
const explicitUrl = "https://example.test/explicit.rss";
const explicitlyActivated = mergeSheetFeedConfigs([row(explicitUrl, "explicit activation")], {
  [explicitKey]: { podcast_key: "explicit activation", source: "approved_explicit_source",
    feed_url: explicitUrl, format: "rss", enabled: true }
});
assert.equal(explicitlyActivated.configs[explicitKey].enabled, true);
assert.equal(selectNormalFeedKeys(explicitlyActivated.configs).includes(explicitKey), true);
assert.equal(explicitlyActivated.audit.feed_warnings.length, 0);
for (const url of ["https://open.podimo.com/podcast/61f4484d-f2d7-4fa3-b7c7-892d78fc5bff",
  "https://feeds.transistor.fm/har-du-hort-med-nikita-klaestrup"]) {
  const incident = mergeSheetFeedConfigs([row(url, "har du hørt")]);
  assert.equal(incident.configs.har_du_hoert.source, "transistor_har_du_hoert_nikita_rss");
  assert.equal(incident.configs.har_du_hoert.feed_url, "https://feeds.transistor.fm/har-du-hort-med-nikita-klaestrup");
  assert.equal(incident.audit.feed_warnings.some(entry => entry.podcast_key === "har du hørt"), url.includes("podimo"));
}
for (const extra of [{ format: "podimo_graphql" }, { format: "dr_lyd_next_data" }, { routes: [] },
  { owned_podcast_keys: [] }, { manual_identity_links: [] }, { dedupe_by_episode_url_with_sources: [] }, { metadata_only: true }]) {
  assert.deepEqual(merge([row(newUrl)], { ...reviewed, ...extra }).configs.legacy_key, { ...reviewed, ...extra });
}
assert.equal(merge([row(newUrl)], { ...reviewed, enabled: false }).configs.legacy_key.enabled, false);
const umbrella = { ...reviewed, podcast_key: "umbrella", routes: [{ key: "child", podcast_key: "canonical id" }] };
assert.deepEqual(merge([row(newUrl)], umbrella).configs, { legacy_key: umbrella });
assert.equal(merge([row(newUrl)], umbrella).audit.feed_warnings[0].reason, "special_or_ambiguous_owner");
const staleReview = merge([row(newUrl)], { ...reviewed, feed_url: "https://example.test/different.rss" });
assert.equal(staleReview.configs.legacy_key.feed_url, "https://example.test/different.rss");
assert.equal(staleReview.configs.legacy_key.sheet_feed_change, undefined);
assert.equal(staleReview.audit.feed_warnings[0].reason, "feed_change_requires_code_approval");

// A reviewed relocation uses the existing GUID/source and UUID, with no insert.
const existing = { id: "562b97ef-d267-4062-b65e-ef4aa904631e", podcast_key: config.podcast_key,
  source: config.source, external_guid: "stable-guid", external_episode_id: "stable-guid",
  title: "Episode", description: null, published_at: null, duration_seconds: null,
  episode_url: null, audio_url: null, image_url: null, is_active: true, metadata: {} };
const writes = [];
const stored = new Map([[`${existing.source}:${existing.external_guid}`, existing]]);
const repository = {
  async createImportRun() { return { id: "test-run" }; },
  async loadExistingEpisodes(source) { assert.equal(source, config.source); return [existing]; },
  async upsertEpisodes(rows) {
    for (const entry of rows) {
      const key = `${entry.source}:${entry.external_guid}`;
      assert.ok(stored.has(key), "Relocation must match the existing DB conflict key");
      const persisted = { ...stored.get(key), ...entry };
      stored.set(key, persisted);
      writes.push(persisted);
    }
  },
  async updateEpisodeMetadata(current, next) { writes.push({ ...next, id: current.id }); },
  async updateImportRun() {}
};
const result = await runEpisodeImport({ feedKey: "legacy_key", feedConfigs: overridden.configs, repository,
  fetchText: async url => { assert.equal(url, newUrl); return '<rss><channel><item><guid>stable-guid</guid><title>Episode</title></item></channel></rss>'; } });
assert.equal(result.inserted_count, 0);
assert.notEqual(result.status, "failed");
for (const entry of writes) {
  assert.equal(entry.id, existing.id);
  assert.equal(entry.source, existing.source);
  assert.equal(entry.podcast_key, existing.podcast_key);
  assert.equal(entry.external_guid, existing.external_guid);
}
const repositorySource = await readFile(new URL("../supabase/functions/import-podcast-episodes/repository.ts", import.meta.url), "utf8");
assert.match(repositorySource, /onConflict: "source,external_guid"/);
assert.equal(stored.size, 1);
assert.equal(stored.values().next().value.id, existing.id);
const dr = mergeSheetFeedConfigs([row("https://api.dr.dk/podcasts/v1/feeds/example", "dr new")], {});
assert.equal(dr.configs.dr_new.feed_url, "https://api.dr.dk/podcasts/v1/feeds/example");
const fallback = await loadRuntimeFeedConfigs({ podcastsJsonUrl: "https://example.test/catalogue.json", staticConfigs: { legacy_key: config }, fetchPayload: async () => { throw Error("offline"); } });
assert.equal(fallback.audit.dynamic_feed_load_error, "offline");
assert.equal(fallback.audit.active_feeds[0].feed_url, oldUrl);
const changedFeedConfig = { ...config, feed_url: newUrl,
  sheet_feed_change: { from_url: oldUrl, to_url: newUrl, minimum_guid_overlap: 3 } };
const explicitRelocation = { legacy_key: changedFeedConfig };
const rejectedWrites = [];
const lowOverlapRepository = {
  async createImportRun() { return { id: "review-run" }; },
  async loadExistingEpisodes() { return [existing]; },
  async upsertEpisodes(rows) { rejectedWrites.push(...rows); },
  async updateEpisodeMetadata() {},
  async updateImportRun() {}
};
const lowOverlap = await runEpisodeImport({ feedKey: "legacy_key", feedConfigs: explicitRelocation,
  repository: lowOverlapRepository,
  fetchText: async () => '<rss><channel><item><guid>stable-guid</guid><title>Existing</title></item>' +
    '<item><guid>new-a</guid><title>New A</title></item><item><guid>new-b</guid><title>New B</title></item></channel></rss>' });
assert.equal(lowOverlap.status, "failed");
assert.match(lowOverlap.error, /1 exact historical GUID matches; 3 required/);
assert.equal(rejectedWrites.length, 0, "an unsafe feed change cannot write new episodes");
assert.equal(changedFeedConfig.source, existing.source, "a relocation never changes historical provenance");
const historical = ["stable-guid", "stable-guid-2", "stable-guid-3"].map((guid, index) => ({
  ...existing, id: `historical-uuid-${index + 1}`, external_guid: guid, external_episode_id: guid,
  title: `Episode ${index + 1}`
}));
const safeWrites = [];
const verifiedRepository = {
  async createImportRun() { return { id: "verified-run" }; },
  async loadExistingEpisodes() { return historical; },
  async upsertEpisodes(rows) { safeWrites.push(...rows); },
  async updateEpisodeMetadata() {},
  async updateImportRun() {}
};
const safeRelocation = await runEpisodeImport({ feedKey: "legacy_key", feedConfigs: explicitRelocation,
  repository: verifiedRepository,
  fetchText: async () => '<rss><channel>' + ["stable-guid", "stable-guid-2", "stable-guid-3", "new-guid"]
    .map((guid, index) => `<item><guid>${guid}</guid><title>Episode ${index + 1}</title></item>`).join("") +
    '</channel></rss>' });
assert.notEqual(safeRelocation.status, "failed");
assert.equal(safeWrites.length, 4);
for (const prior of historical) {
  assert.equal(safeWrites.find(row => row.external_guid === prior.external_guid).source, prior.source);
  assert.equal(safeWrites.find(row => row.external_guid === prior.external_guid).podcast_key, prior.podcast_key);
}
const index = await readFile(new URL("../supabase/functions/import-podcast-episodes/index.ts", import.meta.url), "utf8");
assert.match(index, /console.warn\("\[episode-import\] Sheet feed review required"/);
assert.match(index, /feed_config_audit: runtimeFeeds.audit/);
console.log("Sheet feed override, review, routing and identity regressions PASS");
