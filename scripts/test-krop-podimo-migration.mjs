import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { fetchPodimoEpisodes, mapPodimoEpisodes, runEpisodeImport, runEpisodeImports, selectNormalFeedKeys } from "../supabase/functions/import-podcast-episodes/core.ts";
import { KROP_MANUAL_LINKS, planManualPodimoSync } from "../supabase/functions/import-podcast-episodes/manual-podimo.ts";
import { createSupabaseImportRepository } from "../supabase/functions/import-podcast-episodes/repository.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";

const config = FEED_CONFIGS.podimo_krop_til_salg;
const fixture = JSON.parse(fs.readFileSync(new URL("./fixtures/krop-podimo-2026-10-04.json", import.meta.url)));
const mapped = (items = fixture) => mapPodimoEpisodes(items, config, "2026-10-04T00:00:00Z").episodes;
const manualRows = () => KROP_MANUAL_LINKS.map((link) => ({
  id: link.id, podcast_key: "krop til salg", source: "manual_catalogue_v1",
  external_guid: `manual_catalogue_v1:${link.id}`, external_episode_id: `manual-catalogue-v1:${link.id}`,
  title: link.title.replaceAll('"', '\\"'), description: null, published_at: null, duration_seconds: null,
  episode_url: null, audio_url: null, image_url: null, is_active: true,
  metadata: { manual_catalogue: true, identity_version: "manual_catalogue_v1", rateable: true,
    manual_episode_key: `manual-catalogue-v1:${link.id}`, catalogue_episode_number: link.number, legacy_episode_ids: [] }
}));

// Exercise the real repository and importer, including UUID-targeted updates,
// conflict keys, pagination, and row failures. Ratings/maps are separate tables.
function database(initial = manualRows(), failGuid = null) {
  const tables = { podcast_episodes: structuredClone(initial), episode_import_runs: [],
    episode_ratings: [{ id: "rating-1", user_id: "user-a", episode_id: KROP_MANUAL_LINKS[0].id, rating: 8 },
      { id: "rating-2", user_id: "user-b", episode_id: KROP_MANUAL_LINKS[0].id, rating: 9 }],
    manual_catalogue_episode_map: manualRows().map((row) => ({ episode_id: row.id, manual_episode_key: row.metadata.manual_episode_key })) };
  const calls = [];
  const client = { from(table) {
    const call = { table, filters: [], mode: "select" }; calls.push(call);
    const query = {
      select() { return query; }, order() { return query; },
      eq(key, value) { call.filters.push((row) => row[key] === value); return query; },
      is(key, value) { return query.eq(key, value); },
      in(key, values) { call.filters.push((row) => values.includes(row[key])); return query; },
      range(start, end) { call.range = [start, end]; return query; },
      single() { call.single = true; return query; },
      update(patch) { call.mode = "update"; call.patch = patch; return query; },
      insert(value) { call.mode = "insert"; call.value = value; return query; },
      upsert(value, options) { call.mode = "upsert"; call.value = value; assert.equal(options.onConflict, "source,external_guid"); return query; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        if (call.mode !== "select") assert.ok(["podcast_episodes", "episode_import_runs"].includes(table));
        if (call.mode === "insert") tables[table].push({ id: `run-${tables[table].length}`, ...call.value });
        if (call.mode === "upsert") {
          for (const row of call.value) {
            if (row.external_guid === failGuid) return { error: "simulated row failure" };
            const old = tables[table].find((r) => r.source === row.source && r.external_guid === row.external_guid);
            if (old) Object.assign(old, row); else tables[table].push({ ...row, id: `new-${row.external_guid}` });
          }
        }
        let result = tables[table].filter((row) => call.filters.every((filter) => filter(row)));
        if (call.mode === "update") {
          if (table === "podcast_episodes") {
            for (const key of ["id", "source", "external_guid", "podcast_key", "is_active"]) assert.ok(!(key in call.patch), `must not update ${key}`);
            if (result.some((row) => row.external_guid === failGuid)) return { error: "simulated row failure" };
          }
          result.forEach((row) => Object.assign(row, call.patch));
        }
        if (call.range) result = result.slice(call.range[0], call.range[1] + 1);
        return { data: structuredClone(call.single ? result.at(-1) : result), error: null };
      }).then(resolve, reject); }
    };
    return query;
  } };
  return { tables, calls, repository: createSupabaseImportRepository(client) };
}
async function sync(db, items = fixture) {
  return runEpisodeImport({ feedKey: "podimo_krop_til_salg", repository: db.repository,
    fetchPodimo: async () => ({ data: { episodes: items } }) });
}

const db = database();
const before = structuredClone(db.tables);
const first = await sync(db);
assert.equal(first.status, "success");
assert.equal(first.updated_count, 4); assert.equal(first.inserted_count, 6);
assert.equal(db.tables.podcast_episodes.length, 10);
for (const link of KROP_MANUAL_LINKS) {
  const row = db.tables.podcast_episodes.find((r) => r.id === link.id);
  const old = before.podcast_episodes.find((r) => r.id === link.id);
  assert.equal(row.external_episode_id, link.guid);
  for (const key of ["id", "source", "external_guid", "title", "is_active"]) assert.equal(row[key], old[key]);
  assert.equal(row.metadata.original_external_episode_id, old.external_episode_id);
  for (const [key, value] of Object.entries(old.metadata)) assert.deepEqual(row.metadata[key], value);
}
assert.deepEqual(db.tables.episode_ratings, before.episode_ratings, "all ratings remain on X, including other users");
assert.deepEqual(db.tables.manual_catalogue_episode_map, before.manual_catalogue_episode_map);
const after = structuredClone(db.tables.podcast_episodes);
const second = await sync(db, [...fixture].reverse());
assert.equal(second.inserted_count, 0); assert.equal(second.updated_count, 0); assert.equal(second.skipped_count, 10);
assert.deepEqual(db.tables.podcast_episodes, after);
assert.deepEqual(db.tables.episode_ratings, before.episode_ratings);

// Duplicate manual/Podimo rows are reported and never merged or removed.
const duplicate = database([...manualRows(), { ...mapped().at(-1), id: "preexisting-duplicate" }]);
const duplicateResult = await sync(duplicate);
assert.equal(duplicateResult.status, "partial");
assert.ok(duplicateResult.details.identity_issues.some((issue) => /ambiguous/.test(issue.reason)));
assert.equal(duplicate.tables.podcast_episodes.find((r) => r.id === KROP_MANUAL_LINKS[0].id).external_episode_id, before.podcast_episodes[0].external_episode_id);
assert.ok(duplicate.tables.podcast_episodes.some((r) => r.id === "preexisting-duplicate"));
assert.deepEqual(duplicate.tables.episode_ratings, before.episode_ratings);
const foreignIdentity = { ...mapped()[0], id: "foreign-source", source: "historical-provider" };
assert.ok(planManualPodimoSync(mapped(), [...manualRows(), foreignIdentity], config).issues.some((issue) => issue.external_guid === foreignIdentity.external_guid));

// No title-only guesses; generic manual matching requires date as well.
const extra = { ...manualRows()[0], id: "extra", external_guid: "manual-extra", title: fixture[0].title, metadata: {} };
assert.ok(planManualPodimoSync(mapped(), [...manualRows(), extra], config).issues.some((issue) => issue.external_guid === fixture[0].id));
extra.published_at = fixture[0].publishedOn;
assert.equal(planManualPodimoSync(mapped(), [...manualRows(), extra], config).writes.find((write) => write.row.external_episode_id === fixture[0].id).current.id, "extra");
const twoIncoming = [...fixture, { ...fixture.at(-1), id: "different-guid-same-episode" }];
assert.ok(planManualPodimoSync(mapped(twoIncoming), manualRows(), config).issues.length >= 1);
const duplicateNew = [...fixture, { ...fixture[0], id: "duplicate-new-guid" }];
assert.equal(planManualPodimoSync(mapped(duplicateNew), manualRows(), config).issues.filter((issue) => /incoming episodes share/.test(issue.reason)).length, 2);
const nullExternal = manualRows(); nullExternal[0].external_episode_id = null;
const nullDb = database(nullExternal);
await sync(nullDb);
assert.equal((await sync(nullDb)).updated_count, 0);
assert.equal(nullDb.tables.podcast_episodes[0].metadata.original_external_episode_id, null);
const missing = planManualPodimoSync(mapped(), manualRows().slice(1), config);
assert.ok(missing.issues.some((issue) => /missing/.test(issue.reason)));
const renamedHistorical = [{ ...fixture.at(-1), id: "changed-guid", title: "Renamed historical episode" }];
assert.equal(planManualPodimoSync(mapped(renamedHistorical), manualRows(), config).writes.length, 0);
const missingDate = [{ id: "undated-new", title: "Unknown date" }];
assert.equal(planManualPodimoSync(mapped(missingDate), manualRows(), config).writes.length, 0);
const changed = structuredClone(fixture); changed.at(-1).title = "Unexpected different episode";
assert.ok(planManualPodimoSync(mapped(changed), manualRows(), config).issues.some((issue) => /insufficient/.test(issue.reason)));

// Invalid items survive fetching and are skipped individually, including bad types.
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({ data: { episodes: [null, {}, { id: {}, title: 42 }, ...fixture] } }));
try {
  const payload = await fetchPodimoEpisodes(config);
  const invalid = await sync(database(), payload.data.episodes);
  assert.equal(invalid.status, "partial"); assert.equal(invalid.updated_count, 4); assert.equal(invalid.inserted_count, 6);
  assert.equal(invalid.details.invalid_item_count, 3);
} finally { globalThis.fetch = originalFetch; }
const fields = mapPodimoEpisodes([{ id: "missing-optionals", title: "Title" }, { id: "bad-date", title: "Title", publishedOn: "invalid", duration: -1 }], config, "x");
assert.equal(fields.episodes.length, 2); assert.equal(fields.episodes[0].duration_seconds, null); assert.equal(fields.episodes[1].published_at, null);

const failed = database(manualRows(), manualRows()[0].external_guid);
const failedResult = await sync(failed);
assert.equal(failedResult.status, "partial"); assert.equal(failedResult.updated_count, 3); assert.equal(failedResult.inserted_count, 6);
assert.deepEqual(failed.tables.episode_ratings, before.episode_ratings);
// Inventory must page through the whole archive, beyond PostgREST limits.
const paged = database(Array.from({ length: 405 }, (_, i) => ({ ...manualRows()[0], id: `page-${i}` })));
assert.equal((await paged.repository.loadPodcastEpisodes("krop til salg")).length, 405);
await assert.rejects(() => db.repository.updateEpisodeMetadata({ ...before.podcast_episodes[0], external_episode_id: "stale" }, after[0]), /identity changed/);

assert.ok(selectNormalFeedKeys(FEED_CONFIGS).includes("podimo_krop_til_salg"));
const runtime = mergeSheetFeedConfigs({ rows: [{ "Podcast-ID": "krop til salg", Feed: "https://example.test/old" }, { "Podcast-ID": "other", Feed: "https://example.test/other" }] });
assert.equal(runtime.configs.krop_til_salg, undefined); assert.ok(runtime.configs.other);
const mixed = await runEpisodeImports({ repository: database().repository,
  feedConfigs: { krop: config, ordinary: { source: "rss", podcast_key: "other", feed_url: "https://example.test/other" } },
  fetchPodimo: async () => ({ data: { episodes: [null, ...fixture] } }),
  fetchText: async () => "<rss><channel><title>Other</title><item><guid>rss-1</guid><title>Other episode</title></item></channel></rss>" });
assert.equal(mixed.feeds.find((feed) => feed.source === "rss").status, "success");

// The actual UI config selects the shared DB archive, not the manual-only path.
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = app.indexOf('  "krop til salg": {', app.indexOf("const EPISODE_PODCAST_CONFIG"));
const uiConfig = vm.runInNewContext(`({${app.slice(start, app.indexOf("\n  },", start) + 4)}})`)["krop til salg"];
assert.equal(uiConfig.databasePodcastKey, config.podcast_key); assert.equal(uiConfig.persistence, "supabase");
assert.equal(uiConfig.includeManualEpisodes, undefined, "DB already contains all four manual rows");
const catalogue = JSON.parse(fs.readFileSync(new URL("../data/podcasts.json", import.meta.url)));
assert.deepEqual(catalogue.rows.find((p) => p["Podcast-ID"] === config.podcast_key).manualEpisodes, KROP_MANUAL_LINKS.map((link) => link.title));
console.log("Krop til salg Podimo migration regression tests passed");
