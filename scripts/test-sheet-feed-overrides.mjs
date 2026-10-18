import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mergeSheetFeedConfigs, loadRuntimeFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { runEpisodeImport } from "../supabase/functions/import-podcast-episodes/core.ts";

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
assert.equal(merge([row(newUrl)], config).audit.feed_warnings[0].reason, "identity_review_required");
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
const newApple = mergeSheetFeedConfigs([row("apple:1851213764", "new")], {});
assert.equal(newApple.configs.apple_1851213764.format, "apple_podcasts_html");
assert.equal(newApple.configs.apple_1851213764.enabled, false);
for (const url of ["https://open.podimo.com/podcast/61f4484d-f2d7-4fa3-b7c7-892d78fc5bff",
  "https://feeds.transistor.fm/har-du-hort-med-nikita-klaestrup"]) {
  const incident = mergeSheetFeedConfigs([row(url, "har du hørt")]);
  assert.equal(incident.configs.har_du_hoert.source, "omny_har_du_hoert_rss");
  assert.notEqual(incident.configs.har_du_hoert.feed_url, url);
  assert.ok(incident.audit.feed_warnings.some(entry => entry.podcast_key === "har du hørt"));
}
for (const extra of [{ format: "podimo_graphql" }, { format: "dr_lyd_next_data" }, { routes: [] },
  { owned_podcast_keys: [] }, { manual_identity_links: [] }, { dedupe_by_episode_url_with_sources: [] }, { metadata_only: true }]) {
  assert.deepEqual(merge([row(newUrl)], { ...reviewed, ...extra }).configs.legacy_key, { ...reviewed, ...extra });
}
assert.equal(merge([row(newUrl)], { ...reviewed, enabled: false }).configs.legacy_key.enabled, false);
const umbrella = { ...reviewed, podcast_key: "umbrella", routes: [{ key: "child", podcast_key: "canonical id" }] };
assert.deepEqual(merge([row(newUrl)], umbrella).configs, { legacy_key: umbrella });
assert.equal(merge([row(newUrl)], umbrella).audit.feed_warnings[0].reason, "special_or_ambiguous_owner");
assert.equal(merge([row(newUrl)], { ...reviewed, feed_url: "https://example.test/different.rss" }).audit.feed_warnings[0].reason, "identity_review_required");

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
const index = await readFile(new URL("../supabase/functions/import-podcast-episodes/index.ts", import.meta.url), "utf8");
assert.match(index, /console.warn\("\[episode-import\] Sheet feed review required"/);
assert.match(index, /feed_config_audit: runtimeFeeds.audit/);
console.log("Sheet feed override, review, routing and identity regressions PASS");
