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
import { PODIMO_ONGOING_HISTORICAL_SOURCES } from "../supabase/functions/import-podcast-episodes/podimo-source-registry.ts";

const smat = FEED_CONFIGS.podimo_smat_braendbart;
const hjerter = FEED_CONFIGS["112_for_knuste_hjerter"];
const qco = FEED_CONFIGS.podimo_q_og_co;
assert.deepEqual(
  [smat.podcast_key, smat.source, smat.format, smat.podcast_id, smat.podimo_show_url],
  ["smat brændbart", "podimo_smat_braendbart", "podimo_graphql", "0db490b8-907e-4f35-bd48-60eae9f8805b", "https://podimo.com/dk/shows/smat-braendbart"]
);
assert.deepEqual(
  [hjerter.podcast_key, hjerter.source, hjerter.format, hjerter.podcast_id, hjerter.podimo_show_url],
  ["112 for knuste hjerter", "podimo_112_for_knuste_hjerter", "podimo_graphql", "acb176b6-9a09-475e-9bab-52432506f02b", "https://podimo.com/dk/shows/112-for-knuste-hjerter"]
);
assert.deepEqual(hjerter.dedupe_by_episode_url_with_sources, ["spreaker_112_for_knuste_hjerter_rss"]);
assert.deepEqual(
  [qco.podcast_key, qco.source, qco.format, qco.podcast_id, qco.podimo_show_url],
  ["q og co", "podimo_q_og_co", "podimo_graphql", "1aba8d20-8fbd-4606-aed0-1329f597cf32", "https://podimo.com/dk/shows/q-og-co"]
);

const sheet = mergeSheetFeedConfigs({ rows: [
  { "Podcast-ID": "smat brændbart", Feed: "https://open.podimo.com/podcast/0db490b8-907e-4f35-bd48-60eae9f8805b" },
  { "Podcast-ID": "112 for knuste hjerter", Feed: "https://open.podimo.com/podcast/acb176b6-9a09-475e-9bab-52432506f02b" }
  ,{ "Podcast-ID": "q og co", Feed: "https://open.podimo.com/podcast/1aba8d20-8fbd-4606-aed0-1329f597cf32" }
] });
assert.equal(sheet.configs.podimo_smat_braendbart.podcast_key, "smat brændbart");
assert.equal(sheet.configs["112_for_knuste_hjerter"].source, "podimo_112_for_knuste_hjerter");
assert.equal(sheet.configs.smat_braendbart, undefined, "open.podimo.com does not create a dynamic RSS source");
assert.equal(sheet.configs["112_for_knuste_hjerter_rss"], undefined, "the old Spreaker source is not reactivated dynamically");
assert.equal(sheet.configs.podimo_q_og_co.source, "podimo_q_og_co", "Q&CO retains its rated historical source");
assert.equal(sheet.audit.feed_warnings.length, 0, "verified Podimo show links are recognized as GraphQL adapters, never RSS");
const generatedPodimo = mergeSheetFeedConfigs({ rows: PODIMO_ONGOING_HISTORICAL_SOURCES.map(entry => ({
  "Podcast-ID": entry.podcast_key,
  Feed: `https://open.podimo.com/podcast/${entry.podcast_id}`
})) });
for (const entry of PODIMO_ONGOING_HISTORICAL_SOURCES) {
  const generated = generatedPodimo.configs[entry.source];
  assert.equal(generated?.format, "podimo_graphql");
  assert.equal(generated?.podcast_key, entry.podcast_key);
  assert.equal(generated?.podcast_id, entry.podcast_id);
  assert.equal(generated?.source, entry.source);
  assert.equal(generated?.podimo_history_overlap_minimum, 3);
}
assert.equal(generatedPodimo.audit.feed_warnings.length, 0);
const wrongHistoricalIdentity = mergeSheetFeedConfigs({ rows: [{
  "Podcast-ID": PODIMO_ONGOING_HISTORICAL_SOURCES[0].podcast_key,
  Feed: "https://open.podimo.com/podcast/ffffffff-ffff-ffff-ffff-ffffffffffff"
}] });
assert.equal(wrongHistoricalIdentity.configs[PODIMO_ONGOING_HISTORICAL_SOURCES[0].source], undefined);
assert.equal(wrongHistoricalIdentity.audit.feed_warnings[0].reason, "podimo_adapter_review_required");

// Read-only production dry-run on 2026-10-24 found all 34 historical Q&CO
// GUIDs among the 38 current Podimo GraphQL episodes, plus four new episodes.
const historicalQcoGuids = Array.from({ length: 34 }, (_, index) => `qco-guid-${index + 1}`);
const currentQcoGuids = [...historicalQcoGuids, "qco-new-35", "qco-new-36", "qco-new-37", "qco-new-38"];
assert.equal(currentQcoGuids.filter(guid => historicalQcoGuids.includes(guid)).length, 34);
assert.equal(currentQcoGuids.length, 38);

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
for (const key of ["podimo_smat_braendbart", "112_for_knuste_hjerter", "podimo_q_og_co"]) {
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

// Q&CO production dry-run audit: exact read-only GUID snapshots from Supabase
// and Podimo on 2026-10-24. All 34 historical GUIDs overlap 38 current items.
// The mock proves a run retains historic UUIDs (including the rated row) and
// adds only the four newly observed identities.
const qcoHistoricalGuids = [
  "0aadd8f4-58e2-4f21-a316-95e9cd67f2fd", "122d0444-b9ee-491c-b191-9dbcaa8fb4d0",
  "1c4a457f-c1a6-4d59-84eb-fc389652c3a3", "1f370829-5dad-4140-ab85-4ad886abb134",
  "3515e240-a3f5-4f5a-9415-25789940c136", "37acb933-3f89-47f6-b491-5e8e489fe3a2",
  "393a2730-000c-425f-8df9-c32b3f14a04a", "45e99a98-0d05-4cce-9b40-d0b41c97004f",
  "4b480f57-4457-4058-af75-f0e96bdd9203", "4de8539f-0c6d-49d2-ace7-7b0bbf2ea5b1",
  "5224f000-b1ad-4275-b9ef-d1c20349a321", "558dbef0-d53b-4a7e-8d57-51fe5172843d",
  "5ea5609c-219e-4a95-a38f-32c326e636ee", "66f2a97d-c2ef-422a-896f-fd477f5de052",
  "74b3b416-ea7f-4c9f-9f01-f9bf2909bb12", "752a7f9d-7a7f-4c6b-843d-d1eb13d016bb",
  "81e8d0b9-e7cb-4397-a262-93fd4a82601b", "834b5b2c-691b-4957-a76a-c5265160e943",
  "8957134a-feea-457f-a48f-18bbccedc1b6", "907b16dc-d876-4d7a-b6d3-40e01670c5c2",
  "95aec474-1780-46f0-b551-fec4eb2abf63", "a3cd61fa-a4ca-41e8-9aaa-056b941f0d7e",
  "b569b8c1-b077-463d-a6c5-c3bbec2a427f", "b77c9d09-96b9-44f8-8bc7-64490256f161",
  "b91220c1-a896-43e9-ab41-9aa347b40030", "b92ecabc-2349-45aa-a8a2-65d3095b0962",
  "c12a697d-3431-4063-9391-9ff41ac22afa", "c3269b82-895a-49a1-aa16-71dd3a456d92",
  "c3e7a779-4bde-4db7-82a2-528cfa36b132", "d0b9034c-2ea9-48d9-bf65-94dc33172c0e",
  "d62d059b-626f-4c59-8146-a68976476942", "d6586748-ef22-41da-a7c5-98ae3919f198",
  "e81c65f0-5347-4a3a-9c5c-bdcff465e87c", "f825cf7c-ddf9-4942-8eb5-41a084232202"
];
const qcoCurrentGuids = [
  "618f9ff8-6039-405d-b11c-a4eed6774b2e", "23cfa73e-c336-4249-9e59-618f9cfb2908",
  "2d2dbc1f-d50d-40cd-9b8f-b4bd7845b53b", "e4bb72f8-7b94-4cb4-a788-a17f73a23172",
  "37acb933-3f89-47f6-b491-5e8e489fe3a2", "122d0444-b9ee-491c-b191-9dbcaa8fb4d0",
  "d6586748-ef22-41da-a7c5-98ae3919f198", "95aec474-1780-46f0-b551-fec4eb2abf63",
  "b92ecabc-2349-45aa-a8a2-65d3095b0962", "1f370829-5dad-4140-ab85-4ad886abb134",
  "b91220c1-a896-43e9-ab41-9aa347b40030", "3515e240-a3f5-4f5a-9415-25789940c136",
  "834b5b2c-691b-4957-a76a-c5265160e943", "b77c9d09-96b9-44f8-8bc7-64490256f161",
  "f825cf7c-ddf9-4942-8eb5-41a084232202", "907b16dc-d876-4d7a-b6d3-40e01670c5c2",
  "c3e7a779-4bde-4db7-82a2-528cfa36b132", "d0b9034c-2ea9-48d9-bf65-94dc33172c0e",
  "45e99a98-0d05-4cce-9b40-d0b41c97004f", "81e8d0b9-e7cb-4397-a262-93fd4a82601b",
  "d62d059b-626f-4c59-8146-a68976476942", "5ea5609c-219e-4a95-a38f-32c326e636ee",
  "e81c65f0-5347-4a3a-9c5c-bdcff465e87c", "1c4a457f-c1a6-4d59-84eb-fc389652c3a3",
  "66f2a97d-c2ef-422a-896f-fd477f5de052", "b569b8c1-b077-463d-a6c5-c3bbec2a427f",
  "a3cd61fa-a4ca-41e8-9aaa-056b941f0d7e", "5224f000-b1ad-4275-b9ef-d1c20349a321",
  "752a7f9d-7a7f-4c6b-843d-d1eb13d016bb", "0aadd8f4-58e2-4f21-a316-95e9cd67f2fd",
  "c3269b82-895a-49a1-aa16-71dd3a456d92", "4de8539f-0c6d-49d2-ace7-7b0bbf2ea5b1",
  "74b3b416-ea7f-4c9f-9f01-f9bf2909bb12", "8957134a-feea-457f-a48f-18bbccedc1b6",
  "393a2730-000c-425f-8df9-c32b3f14a04a", "4b480f57-4457-4058-af75-f0e96bdd9203",
  "558dbef0-d53b-4a7e-8d57-51fe5172843d", "c12a697d-3431-4063-9391-9ff41ac22afa"
];
assert.equal(qcoHistoricalGuids.length, 34);
assert.equal(qcoCurrentGuids.length, 38);
assert.equal(qcoCurrentGuids.filter(guid => qcoHistoricalGuids.includes(guid)).length, 34);
const qcoStore = Array.from({ length: 34 }, (_, index) => ({
  id: qcoHistoricalGuids[index] === "122d0444-b9ee-491c-b191-9dbcaa8fb4d0"
    ? "f4ac9cc7-4b19-4dde-b8ab-cfe725de9c9e" : `qco-existing-uuid-${index + 1}`,
  podcast_key: "q og co",
  source: "podimo_q_og_co",
  external_guid: qcoHistoricalGuids[index],
  external_episode_id: qcoHistoricalGuids[index],
  title: `Q&CO episode ${index + 1}`,
  description: "historical",
  published_at: "2026-10-01T00:00:00.000Z",
  duration_seconds: 1800,
  episode_url: `https://podimo.com/dk/shows/q-og-co/episode/${qcoHistoricalGuids[index]}`,
  audio_url: null,
  image_url: null,
  is_active: true,
  metadata: { format: "podimo_graphql", podimo_podcast_id: qco.podcast_id, rateable: true }
}));
const qcoRatedUuid = "f4ac9cc7-4b19-4dde-b8ab-cfe725de9c9e";
const qcoRatings = new Map([[qcoRatedUuid, 8]]);
const qcoRepository = {
  async createImportRun() { return { id: "qco-dry-run" }; },
  async loadExistingEpisodes(source, guids) {
    assert.equal(source, "podimo_q_og_co");
    return qcoStore.filter(row => guids.includes(row.external_guid));
  },
  async upsertEpisodes(rows) {
    for (const row of rows) {
      const current = qcoStore.find(saved => saved.source === row.source && saved.external_guid === row.external_guid);
      if (current) Object.assign(current, row, { id: current.id });
      else qcoStore.push({ ...row, id: `qco-new-uuid-${qcoStore.length - 33}` });
    }
  },
  async updateImportRun() {}
};
const qcoResult = await runEpisodeImport({ feedKey: "podimo_q_og_co", repository: qcoRepository,
  fetchPodimo: async () => ({ data: { episodes: qcoCurrentGuids.map((guid, index) => episode(
    guid, `Q&CO episode ${index + 1}`,
    `2026-10-${String(Math.max(1, 23 - index)).padStart(2, "0")}T10:00:00Z`
  )) } }), now: () => "2026-10-24T00:00:00Z" });
assert.equal(qcoResult.inserted_count, 4);
assert.equal(qcoResult.updated_count, 34);
assert.equal(qcoStore.length, 38);
for (let index = 0; index < 34; index += 1) {
  assert.ok(qcoHistoricalGuids.includes(qcoStore[index].external_guid));
  if (qcoStore[index].external_guid === "122d0444-b9ee-491c-b191-9dbcaa8fb4d0") {
    assert.equal(qcoStore[index].id, qcoRatedUuid);
  }
}
assert.equal(qcoRatings.get(qcoRatedUuid), 8, "the existing episode rating remains attached to its UUID");
assert.equal(qcoStore.filter(row => row.source === "podimo_q_og_co").length, 38);

const generatedKey = PODIMO_ONGOING_HISTORICAL_SOURCES[0].source;
let unsafePodimoWrites = 0;
const noOverlapRepository = {
  async createImportRun() { return { id: "podimo-review-run" }; },
  async loadExistingEpisodes() { return []; },
  async upsertEpisodes() { unsafePodimoWrites += 1; },
  async updateImportRun() {}
};
const noOverlap = await runEpisodeImport({ feedKey: generatedKey, feedConfigs: generatedPodimo.configs,
  repository: noOverlapRepository,
  fetchPodimo: async () => ({ data: { episodes: [episode("new-1", "New episode 1"), episode("new-2", "New episode 2"), episode("new-3", "New episode 3")] } }) });
assert.equal(noOverlap.status, "failed");
assert.match(noOverlap.error, /Podimo identity review required: 0 exact historical GUID matches; 3 required/);
assert.equal(unsafePodimoWrites, 0, "a Podimo source with no history overlap cannot import as a historical source");

console.log("Two Podimo show import regressions passed");
