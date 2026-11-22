import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { runEpisodeImport, selectNormalFeedKeys } from "../supabase/functions/import-podcast-episodes/core.ts";
import { runFriMadsArticleDryRun } from "../supabase/functions/import-podcast-episodes/dry-run.ts";
import { parseFriMadsArticleSidecar } from "../supabase/functions/import-podcast-episodes/fri-mads-articles.ts";

const config = FEED_CONFIGS.fri_mads_official_articles;
const sidecarText = await readFile(new URL("../data/fri-mads-articles.json", import.meta.url), "utf8");
const sidecar = JSON.parse(sidecarText);
const fixedNow = () => "2026-11-21T00:00:00.000Z";

assert.ok(selectNormalFeedKeys(FEED_CONFIGS).includes("fri_mads_official_articles"),
  "Fri Mads uses the existing normal episode-import cadence");
const mapped = parseFriMadsArticleSidecar(sidecarText, config, fixedNow());
assert.equal(mapped.episodes.length, 171, "the verified public archive contains 171 releases, #172 through #2");
assert.deepEqual(mapped.episodes.map((episode) => episode.metadata.release_number), Array.from({ length: 171 }, (_, index) => 172 - index));
assert.equal(mapped.episodes.at(-1).metadata.release_number, 2, "no unlisted #1 is invented");
assert.ok(mapped.episodes.every((episode) => episode.podcast_key === "fri mads" &&
  episode.source === "fri_mads_official_article" && episode.external_guid === episode.episode_url &&
  episode.external_episode_id === null && episode.audio_url === null && episode.duration_seconds === null &&
  episode.metadata.metadata_only === true && episode.metadata.playable === false &&
  episode.metadata.rateable === true && episode.metadata.access_type === "paid"));
assert.equal(mapped.episodes[0].title, "Fri Mads #172: Alle elsker Mette");
assert.equal(mapped.episodes[0].episode_url, "https://frihedsbrevet.dk/fri-mads-172-alle-elsker-mette/");
const fullArchiveWithNextRelease = {
  ...sidecar,
  items: [{
    releaseId: "fri-mads:173:https://frihedsbrevet.dk/fri-mads-173-testpost-173/",
    releaseNumber: 173, title: "Fri Mads #173: Testpost 173", publishedDate: "2026-11-21",
    canonicalUrl: "https://frihedsbrevet.dk/fri-mads-173-testpost-173/"
  }, ...sidecar.items]
};
assert.equal(parseFriMadsArticleSidecar(JSON.stringify(fullArchiveWithNextRelease), config, fixedNow()).episodes.length, 172,
  "the bounded importer accepts the verified archive plus a contiguous newly published release");
const legacyReleaseSidecar = {
  ...sidecar,
  items: [{
    releaseId: "fri-mads:6:https://frihedsbrevet.dk/fri-mads-manden-fra-cypern/",
    releaseNumber: 6, title: "Fri Mads #6: Manden fra Cypern", publishedDate: "2021-07-05",
    canonicalUrl: "https://frihedsbrevet.dk/fri-mads-manden-fra-cypern/"
  }]
};
assert.equal(parseFriMadsArticleSidecar(JSON.stringify(legacyReleaseSidecar), config, fixedNow()).episodes[0].metadata.release_number, 6,
  "an exact verified legacy permalink without an embedded number remains importable");

const invalidSamples = [
  (value) => { value.items[0].canonicalUrl = "https://example.org/fri-mads-172-alle-elsker-mette/"; },
  (value) => { value.items[0].title = "Fri Mads #171: Forkert nummer"; },
  (value) => { value.items[1].canonicalUrl = value.items[0].canonicalUrl; value.items[1].releaseNumber = 172; value.items[1].releaseId = value.items[0].releaseId; },
  (value) => { value.items[1].releaseNumber = 170; },
  (value) => { value.accessType = "free"; },
  (value) => { value.rateable = true; },
  (value) => { value.items[0].canonicalUrl = "https://frihedsbrevet.dk/login/"; }
];
for (const mutate of invalidSamples) {
  const candidate = structuredClone(sidecar);
  mutate(candidate);
  assert.throws(() => parseFriMadsArticleSidecar(JSON.stringify(candidate), config, fixedNow()),
    "invalid identity or access evidence fails closed");
}
assert.throws(() => parseFriMadsArticleSidecar("", config, fixedNow()), /not valid JSON/u);
assert.throws(() => parseFriMadsArticleSidecar(JSON.stringify({ ...sidecar, items: [] }), config, fixedNow()),
  /item count/u);
assert.throws(() => parseFriMadsArticleSidecar(JSON.stringify({ ...sidecar, items: [...sidecar.items, sidecar.items.at(-1)] }), config, fixedNow()),
  /identity|sequence/u, "duplicate historical release identity is rejected");
assert.throws(() => parseFriMadsArticleSidecar(sidecarText, { ...config, podcast_key: "fri mads wrong" }, fixedNow()),
  /identity/u);

let dryRunWriteCount = 0;
const dryRun = await runFriMadsArticleDryRun(config, async (url) => {
  assert.equal(url, config.feed_url);
  return sidecarText;
}, fixedNow());
assert.equal(dryRun.database_writes, 0);
assert.equal(dryRun.episode_imports, 0);
assert.equal(dryRun.valid_count, 171);
assert.equal(dryRun.episodes.every((episode) => episode.audio_url === null && episode.duration_seconds === null), true);
assert.equal(dryRunWriteCount, 0);

function memoryRepository(initialRows = []) {
  const rows = initialRows.map((row) => structuredClone(row));
  const upserts = [];
  let nextRunId = 0;
  return {
    rows,
    upserts,
    repository: {
      async createImportRun() { return { id: `test-run-${++nextRunId}` }; },
      async loadExistingEpisodes(source, guids, urls, _sources, _keys, globalUrlLookup) {
        assert.equal(globalUrlLookup, true, "exact URL collision check spans all import sources");
        return rows.filter((row) =>
          (row.source === source && guids.includes(row.external_guid)) || urls.includes(row.episode_url)
        ).map((row) => structuredClone(row));
      },
      async upsertEpisodes(batch) {
        upserts.push(...batch.map((row) => structuredClone(row)));
        for (const incoming of batch) {
          const index = rows.findIndex((row) => row.source === incoming.source && row.external_guid === incoming.external_guid);
          if (index < 0) rows.push({ ...structuredClone(incoming), id: crypto.randomUUID() });
          else rows[index] = { ...structuredClone(incoming), id: rows[index].id };
        }
      },
      async updateImportRun() {}
    }
  };
}

const db = memoryRepository();
const importOptions = {
  feedKey: "fri_mads_official_articles", repository: db.repository,
  fetchText: async () => sidecarText, now: fixedNow
};
const first = await runEpisodeImport(importOptions);
assert.equal(first.status, "success");
assert.equal(first.inserted_count, 171);
assert.equal(db.rows.length, 171);
assert.equal(db.upserts.length, 171);
const identitiesBeforeRepeat = db.rows.map(({ id, source, external_guid, podcast_key }) => ({ id, source, external_guid, podcast_key }));
const second = await runEpisodeImport(importOptions);
assert.equal(second.status, "success");
assert.equal(second.inserted_count, 0);
assert.equal(second.updated_count, 0);
assert.equal(second.skipped_count, 171);
assert.equal(db.upserts.length, 171, "second run performs no episode upsert");
assert.deepEqual(db.rows.map(({ id, source, external_guid, podcast_key }) => ({ id, source, external_guid, podcast_key })), identitiesBeforeRepeat,
  "repeat discovery preserves UUIDs, source, URL identity and podcast ID");
assert.equal(db.rows.some((row) => row.audio_url || row.duration_seconds), false,
  "no private or invented audio metadata is stored");

const foreignCollision = memoryRepository([{
  id: "existing-other-podcast-episode", podcast_key: "another podcast", source: "other_verified_source",
  external_guid: "other-guid", external_episode_id: null, title: "Existing row", description: null,
  published_at: null, duration_seconds: null, episode_url: sidecar.items[0].canonicalUrl,
  audio_url: null, image_url: null, is_active: true, metadata: {}
}]);
const blocked = await runEpisodeImport({ ...importOptions, repository: foreignCollision.repository });
assert.equal(blocked.status, "partial");
assert.equal(blocked.inserted_count, 170);
assert.equal(foreignCollision.upserts.some((row) => row.episode_url === sidecar.items[0].canonicalUrl), false,
  "an exact canonical URL already owned by another podcast is blocked");

const sameSourceCollision = memoryRepository([{
  id: "existing-conflicting-source-row", podcast_key: "another podcast", source: config.source,
  external_guid: sidecar.items[0].canonicalUrl, external_episode_id: null, title: "Existing conflicting row",
  description: null, published_at: null, duration_seconds: null, episode_url: sidecar.items[0].canonicalUrl,
  audio_url: null, image_url: null, is_active: true, metadata: {}
}]);
const sameSourceBlocked = await runEpisodeImport({ ...importOptions, repository: sameSourceCollision.repository });
assert.equal(sameSourceBlocked.status, "partial");
assert.equal(sameSourceBlocked.updated_count, 0,
  "a same-source GUID owned by another podcast is never reassigned");
assert.equal(sameSourceCollision.upserts.some((row) => row.episode_url === sidecar.items[0].canonicalUrl), false,
  "same-source URL ownership conflicts fail closed");

console.log("Fri Mads episode rating identity and import tests passed.");
