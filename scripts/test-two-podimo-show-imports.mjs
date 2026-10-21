import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  fetchPodimoEpisodes,
  mapPodimoEpisodes,
  runEpisodeImport,
  selectNormalFeedKeys,
  selectNormalFeedShard
} from "../supabase/functions/import-podcast-episodes/core.ts";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";

const smat = FEED_CONFIGS.podimo_smat_braendbart;
const hjerter = FEED_CONFIGS["112_for_knuste_hjerter"];
assert.deepEqual(
  [smat.podcast_key, smat.source, smat.format, smat.podcast_id, smat.podimo_show_url],
  ["smat brændbart", "podimo_smat_braendbart", "podimo_graphql", "0db490b8-907e-4f35-bd48-60eae9f8805b", "https://podimo.com/dk/shows/smat-braendbart"]
);
assert.deepEqual(
  [hjerter.podcast_key, hjerter.source, hjerter.format, hjerter.podcast_id, hjerter.podimo_show_url],
  ["112 for knuste hjerter", "podimo_112_for_knuste_hjerter", "podimo_graphql", "acb176b6-9a09-475e-9bab-52432506f02b", "https://podimo.com/dk/shows/112-for-knuste-hjerter"]
);
assert.deepEqual(hjerter.dedupe_by_episode_url_with_sources, ["spreaker_112_for_knuste_hjerter_rss"]);

const sheet = mergeSheetFeedConfigs({ rows: [
  { "Podcast-ID": "smat brændbart", Feed: "https://open.podimo.com/podcast/0db490b8-907e-4f35-bd48-60eae9f8805b" },
  { "Podcast-ID": "112 for knuste hjerter", Feed: "https://open.podimo.com/podcast/acb176b6-9a09-475e-9bab-52432506f02b" }
] });
assert.equal(sheet.configs.podimo_smat_braendbart.podcast_key, "smat brændbart");
assert.equal(sheet.configs["112_for_knuste_hjerter"].source, "podimo_112_for_knuste_hjerter");
assert.equal(sheet.configs.smat_braendbart, undefined, "open.podimo.com does not create a dynamic RSS source");
assert.equal(sheet.configs["112_for_knuste_hjerter_rss"], undefined, "the old Spreaker source is not reactivated dynamically");

const episode = (id, title, publishedOn = "2026-10-01T10:00:00Z") => ({
  id, title, description: "Beskrivelse", duration: 2400, publishedOn, playAvailable: true
});
const mapped = mapPodimoEpisodes([
  episode("teaser-id", "Teaser: næste afsnit"),
  episode("full-id", "Sofie Amalie Hejn: Siden Sidst")
], hjerter, "2026-10-20T00:00:00Z");
assert.equal(mapped.episodes[0].is_active, false, "Podimo teasers must not be eligible as full episodes");
assert.equal(mapped.episodes[0].metadata.rateable, false);
assert.equal(mapped.episodes[1].is_active, true);
assert.equal(mapped.episodes[1].podcast_key, "112 for knuste hjerter", "the permanent catalogue ID is preserved");
assert.equal(mapped.episodes[1].episode_url, "https://podimo.com/dk/shows/112-for-knuste-hjerter/episode/full-id");
assert.equal(mapped.episodes[1].audio_url, null);

const previousFetch = globalThis.fetch;
globalThis.fetch = async (_url, init) => {
  const { variables } = JSON.parse(init.body);
  const rows = variables.offset === 0
    ? Array.from({ length: 100 }, (_, index) => episode(`page-0-${index}`, `Afsnit ${index}`))
    : variables.offset === 100 ? [episode("page-1-0", "Afsnit 100")] : [];
  return new Response(JSON.stringify({ data: { episodes: rows } }), { status: 200 });
};
try {
  const fetched = await fetchPodimoEpisodes(hjerter);
  assert.equal(fetched.data.episodes.length, 101, "Podimo pagination reads every page");
  assert.equal(fetched.data.page_count, 2);
} finally {
  globalThis.fetch = previousFetch;
}

const enabledKeys = selectNormalFeedKeys(FEED_CONFIGS);
for (const key of ["podimo_smat_braendbart", "112_for_knuste_hjerter"]) {
  assert.equal(enabledKeys.filter((candidate) => candidate === key).length, 1, `${key} is scheduled once`);
}
const shards = Array.from({ length: 6 }, (_, index) => selectNormalFeedShard(FEED_CONFIGS, index, 6));
assert.equal(shards.flat().length, enabledKeys.length, "all enabled feeds are covered by the six shards");
assert.equal(new Set(shards.flat()).size, enabledKeys.length, "no feed is assigned to more than one shard");
assert.equal(shards.flat().includes("podimo_smat_braendbart"), true);
assert.equal(shards.flat().includes("112_for_knuste_hjerter"), true);

const cronMigration = await readFile(new URL("../supabase/migrations/20260906185221_shard_all_episode_feed_imports.sql", import.meta.url), "utf8");
assert.equal((cronMigration.match(/cron\.schedule\(/gu) || []).length, 6, "the shared import is split into six scheduled shards");
for (let index = 0; index < 6; index += 1) {
  assert.match(cronMigration, new RegExp(`'all-episode-feeds-hourly-shard-${index}', '\\d+ \\* \\* \\* \\*'[\\s\\S]*?'shard_index', ${index}, 'shard_count', 6`, "u"),
    `shard ${index} has a unique index and six-shard count`);
}

const normalizedEpisode = mapped.episodes[1];
const legacy = {
  id: "legacy-spreaker-uuid", podcast_key: "112 for knuste hjerter", source: "spreaker_112_for_knuste_hjerter_rss",
  external_guid: "spreaker-episode-1", external_episode_id: "spreaker-episode-1",
  title: "Sofie Amalie Hejn: Siden Sidst", description: "legacy", published_at: normalizedEpisode.published_at,
  duration_seconds: 2300, episode_url: "https://www.spreaker.com/episode/123", audio_url: null, image_url: null,
  is_active: true, metadata: { rateable: true }
};
const protectedRating = { episode_id: legacy.id, rating: 8 };
assert.equal(protectedRating.episode_id, legacy.id, "legacy rating identity remains attached to the same UUID");

let legacyWrites = 0;
const legacyRepository = {
  async createImportRun() { return { id: "legacy-dedupe-run" }; },
  async loadExistingEpisodes(_source, _guids, _urls, sources, keys) {
    assert.ok(sources.includes(legacy.source), "the Spreaker source is queried for duplicates");
    assert.ok(keys.includes(legacy.podcast_key), "cross-source lookup is constrained to the canonical podcast");
    return [legacy];
  },
  async upsertEpisodes() { legacyWrites += 1; },
  async updateImportRun() {}
};
const deduped = await runEpisodeImport({ feedKey: "112_for_knuste_hjerter", repository: legacyRepository,
  fetchPodimo: async () => ({ data: { episodes: [episode("different-podimo-guid", legacy.title, "2026-10-01T10:00:00Z")] } }),
  now: () => "2026-10-20T00:00:00Z" });
assert.equal(deduped.inserted_count, 0, "matching Spreaker episodes are not duplicated");
assert.equal(legacyWrites, 0, "the historical Spreaker episode and its rating are left untouched");

const store = [];
let nextId = 0;
const calls = [];
const repository = {
  async createImportRun() { return { id: `run-${calls.length}` }; },
  async loadExistingEpisodes(source, guids, urls, duplicateSources, podcastKeys) {
    calls.push({ source, duplicateSources, podcastKeys });
    return store.filter((row) => row.source === source && guids.includes(row.external_guid));
  },
  async upsertEpisodes(rows) {
    for (const row of rows) {
      const current = store.find((saved) => saved.source === row.source && saved.external_guid === row.external_guid);
      if (current) Object.assign(current, row);
      else store.push({ ...row, id: `podimo-uuid-${++nextId}` });
    }
  },
  async updateImportRun() {}
};
for (let pass = 0; pass < 2; pass += 1) {
  const result = await runEpisodeImport({ feedKey: "112_for_knuste_hjerter", repository,
    fetchPodimo: async () => ({ data: { episodes: [episode("stable-guid", "Et fuldt afsnit")] } }),
    now: () => "2026-10-20T00:00:00Z" });
  assert.equal(result.status, "success");
}
assert.equal(store.length, 1, "repeat imports are idempotent");
assert.equal(store[0].id, "podimo-uuid-1", "reimports preserve the episode UUID");
assert.equal(calls[0].source, "podimo_112_for_knuste_hjerter");
assert.ok(calls[0].duplicateSources.includes("spreaker_112_for_knuste_hjerter_rss"));
assert.ok(calls[0].podcastKeys.includes("112 for knuste hjerter"));

console.log("Two Podimo show import regressions passed");
