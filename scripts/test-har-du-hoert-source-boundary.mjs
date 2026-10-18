import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { runEpisodeImport } from "../supabase/functions/import-podcast-episodes/core.ts";

const key = "har du hørt";
const source = "transistor_har_du_hoert_nikita_rss";
const legacySource = "omny_har_du_hoert_rss";
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
function extract(name) {
  const start = app.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, name);
  const tail = app.slice(start + 1);
  const end = tail.search(/\n(?:async )?function /);
  return app.slice(start, end < 0 ? app.length : start + 1 + end);
}
const configText = app.match(/"har du hørt": (\{[\s\S]*?\n  \}),/)[1];
const config = vm.runInNewContext(`(${configText})`);
assert.deepEqual(Array.from(config.episodeSources), [source]);
assert.equal(config.databasePodcastKey, key);
assert.equal(FEED_CONFIGS.har_du_hoert.source, source);
assert.equal(FEED_CONFIGS.har_du_hoert.feed_url, "https://feeds.transistor.fm/har-du-hort-med-nikita-klaestrup");
assert.equal(Object.values(FEED_CONFIGS).some(c => c.source === legacySource), false);

const legacy = Array.from({ length: 18 }, (_, i) => ({
  id: `legacy-uuid-${i}`, podcast_key: key, source: legacySource, external_guid: `guid-${i}`,
  title: `William episode ${i}`, description: "Legacy history", published_at: "2020-12-17",
  is_active: true, metadata: { preserved: true }
}));
const current = Array.from({ length: 21 }, (_, i) => ({
  id: `nikita-uuid-${String(i).padStart(2, "0")}`, podcast_key: key, source, external_guid: `guid-${i}`,
  title: `Nikita episode ${i}`, description: "New series", published_at: i < 5 ? "2026-10-15" : "2026-10-08",
  is_active: true, metadata: {}
}));
const other = ["old_provider", "new_provider"].map((s, i) => ({ ...current[i], id: `other-${i}`, podcast_key: "other", source: s }));
const episodes = [...legacy, ...current, ...other, { ...current[0], id: "inactive", is_active: false }];
const ratings = [{ episode_id: legacy[0].id, rating: 9, user_id: "user", podcast_episodes: legacy[0] },
  { episode_id: current[0].id, rating: 7, user_id: "user", podcast_episodes: current[0] }];
const original = JSON.stringify({ legacy, ratings });
const calls = [];
class Query {
  constructor(table) { this.table = table; this.filters = []; this.orders = []; this.start = 0; this.end = Infinity; this.ops = []; }
  select() { return this; }
  eq(field, value) { this.filters.push(row => field.split(".").reduce((v, p) => v?.[p], row) === value); this.ops.push("eq"); return this; }
  in(field, values) { this.filters.push(row => values.includes(field.split(".").reduce((v, p) => v?.[p], row))); this.ops.push(`in:${field}`); return this; }
  or(expression) { const term = expression.match(/%([^%]*)%/)[1].toLowerCase(); this.filters.push(row => `${row.title} ${row.description}`.toLowerCase().includes(term)); return this; }
  order(field, options) { this.orders.push([field, options.ascending]); this.ops.push(`order:${field}`); return this; }
  range(start, end) { this.start = start; this.end = end; this.ops.push("range"); return this; }
  then(resolve, reject) {
    let data = (this.table === "episode_ratings" ? ratings : episodes).filter(row => this.filters.every(f => f(row)));
    const count = data.length;
    data.sort((a, b) => { for (const [field, asc] of this.orders) { const c = String(a[field]).localeCompare(String(b[field])); if (c) return asc ? c : -c; } return 0; });
    calls.push(this);
    return Promise.resolve({ data: data.slice(this.start, this.end + 1), count, error: null }).then(resolve, reject);
  }
}
let activeConfig = config;
let episodeState;
const reset = () => { episodeState = { items: [], remoteLoadedCount: 0, searchResults: [], searchRemoteLoadedCount: 0,
  searchToken: 1, userRatingsById: {}, parentUserRatingsById: {} }; };
reset();
const context = vm.createContext({ console, Date, EPISODE_PAGE_SIZE: 16,
  state: { supabase: { from: table => new Query(table) }, activePodcastDetailKey: key, authUser: { id: "user" } },
  getEpisodePodcastConfig: () => activeConfig, getPodcastEpisodeState: () => episodeState,
  getEpisodeDatabasePodcastKey: c => c.databasePodcastKey,
  getRateablePodcastEpisodes: rows => rows, getConfiguredManualEpisodes: () => [],
  mergeEpisodes: (a, b) => [...new Map([...a, ...b].map(row => [row.id, row])).values()],
  fetchEpisodeRatingMetaForEpisodes: async rows => { assert.ok(rows.every(row => activeConfig === config ? row.source === source : true)); },
  normalizeText: v => String(v ?? "").trim(), getSupabaseLikePattern: v => v,
  parseNumber: v => Number(v), getUserScopedRequestContext: () => ({ userId: "user" }), isCurrentUserScopedRequest: () => true,
  getGenstartEpisodeById: id => episodes.find(e => e.id === id),
  updateGenstartEpisodeSection() {}, updatePodcastEpisodeOverview() {}
});
vm.runInContext(["applyPodcastEpisodeSourceBoundary", "episodeMatchesPodcastSourceBoundary", "orderPodcastEpisodes", "fetchGenstartEpisodes",
  "getHistoricalEpisodeDisplayName", "getPodcastEpisodeUserRatingSummary",
  "searchGenstartEpisodes", "fetchPodcastEpisodeParentRatings"].map(extract).join("\n"), context);

await context.fetchGenstartEpisodes();
assert.equal(episodeState.totalCount, 21);
assert.equal(episodeState.items.length, 16);
assert.equal(episodeState.hasMore, true);
await context.fetchGenstartEpisodes({ append: true });
assert.deepEqual(episodeState.items.map(e => e.id), current.map(e => e.id));
assert.equal(episodeState.hasMore, false);
assert.equal(new Set(episodeState.items.map(e => e.id)).size, 21);
await context.searchGenstartEpisodes("Nikita", 1);
assert.equal(episodeState.searchTotalCount, 21);
await context.searchGenstartEpisodes("Nikita", 1, { append: true });
assert.deepEqual(episodeState.searchResults.map(e => e.id), current.map(e => e.id));
await context.searchGenstartEpisodes("William", 1);
assert.equal(episodeState.searchTotalCount, 0);
await context.fetchPodcastEpisodeParentRatings(key);
assert.deepEqual(Object.keys(episodeState.parentUserRatingsById), [current[0].id]);
assert.equal(episodeState.parentUserRatingsById[current[0].id], 7);
episodeState.parentUserRatingsById[legacy[0].id] = 9; // A profile edit must not pollute Nikita's summary.
assert.equal(context.getPodcastEpisodeUserRatingSummary(key).count, 1);
assert.equal(context.getPodcastEpisodeUserRatingSummary(key).average, 7);
episodeState.parentUserRatingsResolvedFor = null;
episodeState.userRatingsById[legacy[0].id] = 9;
assert.equal(context.getPodcastEpisodeUserRatingSummary(key).count, 1);
assert.match(context.getHistoricalEpisodeDisplayName(legacy[0]), /William Ejsing/);
assert.equal(context.getHistoricalEpisodeDisplayName(current[0]), "");
for (const call of calls.filter(c => c.table === "podcast_episodes")) {
  assert.ok(call.ops.indexOf("in:source") < call.ops.indexOf("range"), "Boundary is applied server-side before pagination");
  assert.deepEqual(call.orders.map(([field]) => field), ["published_at", "id"]);
}
activeConfig = { podcastKey: "other", databasePodcastKey: "other" };
reset();
await context.fetchGenstartEpisodes();
assert.deepEqual(episodeState.items.map(e => e.source), ["old_provider", "new_provider"]);
assert.equal(calls.at(-1).ops.some(op => op.startsWith("in:")), false);
assert.deepEqual(calls.at(-1).orders.map(([field]) => field), ["published_at"]);
assert.equal(context.episodeMatchesPodcastSourceBoundary(legacy[0], config), false);
assert.equal(context.episodeMatchesPodcastSourceBoundary(legacy[0], activeConfig), true);
const profile = extract("fetchProfileEpisodeRatings");
assert.match(profile, /episodeMatchesPodcastSourceBoundary\(episode, getEpisodePodcastConfig/);
assert.match(profile, /\.in\("id", ids\)/); // Personal history still resolves its original UUIDs.

// Import a colliding GUID into a separate source twice; legacy rows and all
// rating relationships must stay unchanged. This repository is in-memory only.
const stored = structuredClone(legacy);
const repository = {
  async createImportRun() { return { id: "run" }; },
  async loadExistingEpisodes(requestedSource) { assert.equal(requestedSource, source); return stored.filter(e => e.source === requestedSource); },
  async upsertEpisodes(rows) { for (const row of rows) {
    assert.equal(row.source, source);
    const existing = stored.find(e => e.source === row.source && e.external_guid === row.external_guid);
    if (existing) Object.assign(existing, row); else stored.push({ ...row, id: "new-uuid" });
  } },
  async updateImportRun() {}
};
const options = { feedKey: "har_du_hoert", feedConfigs: FEED_CONFIGS, repository,
  fetchText: async () => '<rss><channel><item><guid>guid-0</guid><title>Nikita episode</title></item></channel></rss>' };
assert.equal((await runEpisodeImport(options)).inserted_count, 1);
assert.equal((await runEpisodeImport(options)).inserted_count, 0);
assert.deepEqual(stored.filter(e => e.source === legacySource), legacy);
assert.equal(stored.filter(e => e.source === source).length, 1);
assert.equal(JSON.stringify({ legacy, ratings }), original);
const drift = mergeSheetFeedConfigs([{ "Podcast-ID": key, Feed: "https://example.test/future.rss" }]);
assert.equal(drift.configs.har_du_hoert.source, source);
assert.equal(drift.audit.feed_warnings[0].reason, "identity_review_required");
console.log("Har du hørt: source isolation, pagination/search, ratings and legacy UUID preservation PASS");
