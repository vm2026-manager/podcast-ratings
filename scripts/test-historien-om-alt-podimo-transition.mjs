import assert from "node:assert/strict";
import { runEpisodeImport } from "../supabase/functions/import-podcast-episodes/core.ts";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import {
  HISTORIEN_OM_ALT_PODIMO_CROSSWALK,
  HISTORIEN_OM_ALT_PODIMO_INITIAL_NEW_GUIDS,
  HISTORIEN_OM_ALT_PODIMO_UNRESOLVED_GUIDS
} from "../supabase/functions/import-podcast-episodes/historien-om-alt-podimo-identity.ts";

const canonicalId = "historien om alt";
const showId = "138a7a8f-7248-4801-83b5-7b499ffc7241";
const showUrl = `https://open.podimo.com/podcast/${showId}`;
const sheet = (...rows) => mergeSheetFeedConfigs({ rows });
const row = (id = canonicalId, feed = showUrl) => ({ "Podcast-ID": id, Feed: feed });
const base = FEED_CONFIGS.podimo_historien_om_alt;

assert.equal(base.enabled, false, "Podimo remains disabled before Sheet identity verification");
const verified = sheet(row());
const config = verified.configs.podimo_historien_om_alt;
assert.equal(config.enabled, true);
assert.equal(config.podcast_id, showId);
assert.equal(config.source, "podimo_historien_om_alt");
assert.equal(config.podcast_key, canonicalId);
assert.equal(config.podimo_history_overlap_minimum, undefined, "the different GUID namespaces do not use the global overlap threshold");
assert.deepEqual(config.dedupe_by_episode_url_with_sources, ["sheet_historien_om_alt_rss"]);
assert.equal(verified.configs.historien_om_alt, undefined, "retired ART19 feed is not scheduled");

for (const input of [
  sheet(row(canonicalId, "https://open.podimo.com/podcast/ffffffff-ffff-ffff-ffff-ffffffffffff")),
  sheet(row(canonicalId, "https://open.podimo.com/podcast/138a7a8f-7248-4801-83b5-7b499ffc7240")),
  sheet(row("historien om alt (arkiv)", showUrl)),
  sheet({ Feed: showUrl }),
  sheet(row(), row())
]) {
  assert.equal(input.configs.podimo_historien_om_alt?.enabled, false, "wrong, missing, drifted or duplicate Sheet identity fails closed");
}
const normalizedCollision = sheet(row(), row("Historien Om Alt", showUrl));
assert.equal(normalizedCollision.configs.podimo_historien_om_alt.enabled, false);

assert.equal(HISTORIEN_OM_ALT_PODIMO_CROSSWALK.length, 51);
assert.ok(HISTORIEN_OM_ALT_PODIMO_CROSSWALK.every(x => x.podimo_guid && x.legacy_guid));
assert.equal(new Set(HISTORIEN_OM_ALT_PODIMO_CROSSWALK.map(x => x.podimo_guid)).size, 51);
assert.equal(new Set(HISTORIEN_OM_ALT_PODIMO_CROSSWALK.map(x => x.legacy_guid)).size, 51);
assert.deepEqual(HISTORIEN_OM_ALT_PODIMO_INITIAL_NEW_GUIDS, [
  "6ba2a582-e5d1-4015-ba14-9114be8f0a33",
  "eddb6e6a-902d-4986-80e0-7c76b10a39c1",
  "2d80b564-79f6-4633-a2c9-b204241ef32c"
]);
assert.equal(HISTORIEN_OM_ALT_PODIMO_UNRESOLVED_GUIDS.length, 2);

const publishedOn = "2026-11-04T00:00:00.000Z";
const legacyRows = [
  ...HISTORIEN_OM_ALT_PODIMO_CROSSWALK.map((entry, index) => ({
  id: `legacy-uuid-${index}`,
  source: "sheet_historien_om_alt_rss",
  external_guid: entry.legacy_guid,
  podcast_key: canonicalId,
  title: entry.episode,
  published_at: publishedOn,
  duration_seconds: 900,
  episode_url: null,
  audio_url: "https://example.test/teaser.mp3",
  image_url: null,
  is_active: true,
  metadata: { rateable: true }
  })),
  ...Array.from({ length: 18 }, (_, index) => ({
    id: `legacy-uuid-other-${index}`,
    source: "sheet_historien_om_alt_rss",
    external_guid: `legacy-guid-other-${index}`,
    podcast_key: canonicalId,
    title: index < 2 ? `Historical trailer ${index}` : `Historical episode ${index}`,
    published_at: "2025-01-01T00:00:00.000Z",
    duration_seconds: index < 2 ? 30 : 1800,
    episode_url: null,
    audio_url: null,
    image_url: null,
    is_active: index >= 2,
    metadata: { rateable: index >= 2, exclusion_reason: index < 2 ? "teaser_or_trailer" : null },
    test_rating_count: index === 0 ? 1 : 0,
    test_legacy_aliases: index === 0 ? ["legacy-alias-0"] : []
  }))
];
assert.equal(legacyRows.length, 69);
assert.equal(new Set(legacyRows.map(x => x.id)).size, 69);
assert.equal(new Set(legacyRows.map(x => x.external_guid)).size, 69);
const snapshot = structuredClone(legacyRows);
const podimoEpisode = (id, title, date = publishedOn) => ({
  id, title, description: "Synthetic test episode description.",
  duration: 3600, publishedOn: date, playAvailable: true
});
const apiEpisodes = [
  ...HISTORIEN_OM_ALT_PODIMO_CROSSWALK.map(entry => podimoEpisode(entry.podimo_guid, entry.episode)),
  podimoEpisode(HISTORIEN_OM_ALT_PODIMO_UNRESOLVED_GUIDS[0], "S1-E10: Skam", "2024-01-01T00:00:00Z"),
  podimoEpisode(HISTORIEN_OM_ALT_PODIMO_UNRESOLVED_GUIDS[1], "S3-E12: Animisme 1", "2026-03-01T00:00:00Z"),
  podimoEpisode(HISTORIEN_OM_ALT_PODIMO_INITIAL_NEW_GUIDS[0], "S5-E6: Porno", "2026-10-20T00:00:00Z"),
  podimoEpisode(HISTORIEN_OM_ALT_PODIMO_INITIAL_NEW_GUIDS[1], "S5-E7: Animisme 2", "2026-10-27T00:00:00Z"),
  podimoEpisode(HISTORIEN_OM_ALT_PODIMO_INITIAL_NEW_GUIDS[2], "S5-E8: Jagt", "2026-11-03T00:00:00Z")
];
let storedPodimoRows = [];
let writes = [];
const importRuns = [];
const repository = {
  async createImportRun(input) { const id = `run-${importRuns.length + 1}`; importRuns.push({ id, input }); return { id }; },
  async loadExistingEpisodes(source, _guids, _urls, sources, keys) {
    assert.equal(source, "podimo_historien_om_alt");
    assert.ok(sources.includes("sheet_historien_om_alt_rss"));
    assert.ok(keys.includes(canonicalId));
    return [...legacyRows, ...storedPodimoRows];
  },
  async upsertEpisodes(rows) {
    writes.push(...rows.map(value => structuredClone(value)));
    for (const value of rows) {
      const index = storedPodimoRows.findIndex(existing => existing.source === value.source && existing.external_guid === value.external_guid);
      if (index < 0) storedPodimoRows.push(structuredClone(value));
      else storedPodimoRows[index] = structuredClone(value);
    }
  },
  async updateImportRun(id, update) { importRuns.find(run => run.id === id).update = update; }
};
const options = {
  feedKey: "podimo_historien_om_alt",
  repository,
  feedConfigs: verified.configs,
  fetchPodimo: async () => ({ data: { episodes: apiEpisodes } }),
  now: () => "2026-11-08T12:00:00.000Z"
};
const first = await runEpisodeImport(options);
assert.equal(first.status, "partial", "known unresolved historical rows are visible as review items");
assert.equal(first.inserted_count, 3);
assert.equal(first.updated_count, 0);
assert.equal(first.skipped_count, 53);
assert.equal(first.details.podimo_transition_cross_source_duplicate_count, 51);
assert.equal(first.details.podimo_transition_unresolved_identity_count, 2);
assert.equal(writes.length, 3, "only the three reviewed Podimo-only episodes are written");
assert.ok(writes.every(value => value.audio_url === null), "Podimo episodes do not receive invented audio URLs");
assert.ok(writes.every(value => value.source === "podimo_historien_om_alt" && value.podcast_key === canonicalId));
assert.equal(legacyRows.filter(value => !value.is_active).length, 2);
assert.deepEqual(legacyRows, snapshot, "historical IDs, metadata and teaser fields are untouched");
assert.equal(writes.some(value => snapshot.some(old => old.id === value.id)), false, "no historical UUID is replaced");

const firstWriteCount = writes.length;
const second = await runEpisodeImport(options);
assert.equal(second.inserted_count, 0);
assert.equal(second.updated_count, 0);
assert.equal(second.skipped_count, 56, "the second run skips the 51 legacy matches, two held identities and three existing Podimo rows");
assert.equal(writes.length, firstWriteCount, "second import is idempotent");
assert.deepEqual(legacyRows, snapshot);

async function assertFailsClosed(episodes, returnedRows = legacyRows) {
  let writesForFailure = 0;
  const failedRepository = {
    ...repository,
    async loadExistingEpisodes() { return returnedRows; },
    async upsertEpisodes() { writesForFailure += 1; },
    async updateImportRun() {}
  };
  const result = await runEpisodeImport({
    ...options,
    repository: failedRepository,
    fetchPodimo: async () => ({ data: { episodes } })
  });
  assert.equal(result.status, "failed");
  assert.match(result.error, /Podimo transition identity review required/);
  assert.equal(writesForFailure, 0);
}

await assertFailsClosed([podimoEpisode("unknown-old-guid", "S2-E1: Krig", "2025-08-01T00:00:00Z")]);
await assertFailsClosed([podimoEpisode("same-topic-different-season", "S5-E7: Animisme", "2026-10-27T00:00:00Z")]);
await assertFailsClosed([podimoEpisode("unknown-no-sequence", "Krig", "2026-11-05T00:00:00Z")]);
await assertFailsClosed([podimoEpisode("missing-legacy-row", "S5-E1: Spioner")], []);

let futureRows = [];
const futureResult = await runEpisodeImport({
  ...options,
  repository: {
    ...repository,
    async loadExistingEpisodes() { return [...legacyRows, ...storedPodimoRows, ...futureRows]; },
    async upsertEpisodes(rows) { futureRows.push(...structuredClone(rows)); }
  },
  fetchPodimo: async () => ({ data: { episodes: [podimoEpisode("future-guid-1", "S5-E9: Nyt emne", "2026-11-10T00:00:00Z")] } })
});
assert.equal(futureResult.inserted_count, 1, "a sequenced post-cutover Podimo release remains importable");
assert.equal(futureRows.length, 1);

console.log("Historien om alt Podimo transition tests passed");
