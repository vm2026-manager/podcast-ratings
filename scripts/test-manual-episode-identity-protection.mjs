import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runEpisodeImport } from "../supabase/functions/import-podcast-episodes/core.ts";

const podcastKey = "danmarks vaerste massemorder";
const manualEpisode = {
  id: "8a52fae6-47a2-5c7d-a710-a8a8addbbba7",
  podcast_key: podcastKey,
  source: "manual_catalogue_v1",
  external_guid: "manual-catalogue-v1:8a52fae6-47a2-5c7d-a710-a8a8addbbba7",
  external_episode_id: "manual-catalogue-v1:8a52fae6-47a2-5c7d-a710-a8a8addbbba7",
  title: "2:5 - Pyromanen",
  description: null,
  published_at: null,
  duration_seconds: null,
  episode_url: null,
  audio_url: null,
  image_url: null,
  is_active: true,
  metadata: { manual_catalogue: true, rateable: true }
};

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss><channel>
  <title>Djævlen i detaljen</title>
  <item>
    <guid>feed-guid-pyromanen</guid>
    <title>Danmarks værste massemorder? 2:5 - Pyromanen</title>
    <description>Ny feed-metadata</description>
    <pubDate>Wed, 16 Sep 2026 05:00:00 +0200</pubDate>
    <enclosure url="https://example.test/pyromanen.mp3" type="audio/mpeg"/>
  </item>
</channel></rss>`;

const config = {
  test_feed: {
    podcast_key: podcastKey,
    source: "sheet_test_rss",
    feed_url: "https://example.test/feed.xml"
  }
};

function makeRepository(existingRows) {
  const writes = [];
  const metadataUpdates = [];
  const runUpdates = [];
  return {
    writes,
    metadataUpdates,
    runUpdates,
    async createImportRun() { return { id: "run-1" }; },
    async loadExistingEpisodes() { return existingRows; },
    async upsertEpisodes(rows) { writes.push(...rows); },
    async updateEpisodeMetadata(current, next) { metadataUpdates.push({ current, next }); },
    async updateImportRun(_id, input) { runUpdates.push(input); }
  };
}

{
  const repository = makeRepository([manualEpisode]);
  const summary = await runEpisodeImport({
    feedKey: "test_feed",
    feedConfigs: config,
    repository,
    fetchText: async () => rss,
    now: () => "2026-10-08T09:00:00.000Z"
  });

  assert.equal(summary.status, "success");
  assert.equal(summary.inserted_count, 0);
  assert.equal(summary.updated_count, 1);
  assert.equal(summary.error_count, 0);
  assert.equal(repository.writes.length, 0, "feed row must not compete with the manual UUID");
  assert.equal(repository.metadataUpdates.length, 1);

  const { current, next } = repository.metadataUpdates[0];
  assert.equal(current.id, manualEpisode.id);
  assert.equal(next.id, manualEpisode.id);
  assert.equal(next.source, manualEpisode.source);
  assert.equal(next.external_guid, manualEpisode.external_guid);
  assert.equal(next.is_active, true);
  assert.equal(next.audio_url, "https://example.test/pyromanen.mp3");
  assert.equal(next.metadata.linked_feed_source, "sheet_test_rss");
  assert.equal(next.metadata.linked_external_guid, "feed-guid-pyromanen");
}

{
  const repository = makeRepository([
    manualEpisode,
    { ...manualEpisode, id: "11111111-1111-5111-8111-111111111111", external_guid: "manual-catalogue-v1:11111111-1111-5111-8111-111111111111" }
  ]);
  const summary = await runEpisodeImport({
    feedKey: "test_feed",
    feedConfigs: config,
    repository,
    fetchText: async () => rss,
    now: () => "2026-10-08T09:00:00.000Z"
  });

  assert.equal(summary.status, "partial");
  assert.equal(summary.inserted_count, 0);
  assert.equal(summary.updated_count, 0);
  assert.equal(repository.writes.length, 0, "ambiguous identity must be skipped, never guessed");
  assert.equal(repository.metadataUpdates.length, 0);
  assert.equal(summary.details.manual_catalogue_conflict_count, 1);
}

{
  const mappedRemote = {
    ...manualEpisode,
    id: "6e8d69cd-deec-4d41-8898-3823d2df92ad",
    source: "manual_dr_lyd_supplement",
    external_guid: "16122692639",
    external_episode_id: "16122692639",
    title: "Danmarks værste massemorder? 4:5 - Tragedien på Fanø",
    metadata: { rateable: true, manual_catalogue_identity: true }
  };
  const remoteRss = rss
    .replaceAll("2:5 - Pyromanen", "4:5 - Tragedien på Fanø")
    .replaceAll("feed-guid-pyromanen", "feed-guid-fanoe")
    .replaceAll("pyromanen.mp3", "fanoe.mp3");
  const repository = makeRepository([mappedRemote]);
  const summary = await runEpisodeImport({
    feedKey: "test_feed",
    feedConfigs: config,
    repository,
    fetchText: async () => remoteRss,
    now: () => "2026-10-08T09:00:00.000Z"
  });

  assert.equal(summary.inserted_count, 0);
  assert.equal(summary.updated_count, 1);
  assert.equal(repository.writes.length, 0);
  assert.equal(repository.metadataUpdates[0].current.id, mappedRemote.id);
  assert.equal(repository.metadataUpdates[0].next.source, mappedRemote.source);
  assert.equal(repository.metadataUpdates[0].next.external_guid, mappedRemote.external_guid);
}

{
  const placeholder = {
    ...manualEpisode,
    id: "5843277d-8a1c-59b2-9f3e-e0e78234d88c",
    external_guid: "manual_catalogue_v1:5843277d-8a1c-59b2-9f3e-e0e78234d88c",
    external_episode_id: "manual-catalogue-v1:5843277d-8a1c-59b2-9f3e-e0e78234d88c",
    title: "5:5 -",
    metadata: { manual_catalogue: true, manual_catalogue_identity: true, rateable: true }
  };
  const fullEpisodeRss = rss
    .replaceAll("2:5 - Pyromanen", "5:5 - Sexgalning")
    .replaceAll("feed-guid-pyromanen", "feed-guid-sexgalning")
    .replaceAll("pyromanen.mp3", "sexgalning.mp3");
  const repository = makeRepository([placeholder]);
  const summary = await runEpisodeImport({
    feedKey: "test_feed",
    feedConfigs: config,
    repository,
    fetchText: async () => fullEpisodeRss,
    now: () => "2026-10-08T09:00:00.000Z"
  });

  assert.equal(summary.inserted_count, 0, "numbered manual placeholder must keep its UUID");
  assert.equal(summary.updated_count, 1);
  assert.equal(repository.metadataUpdates[0].current.id, placeholder.id);
}

const migration = await readFile("supabase/migrations/20261008112000_protect_manual_episode_identities.sql", "utf8");
assert.match(migration, /ensure_manual_catalogue_episode/);
assert.match(migration, /podcast_episodes_protect_identity/);
assert.match(migration, /Rated episode .* identity\/visibility is protected/);
assert.match(migration, /Manual catalogue episode .* identity\/visibility is protected/);
assert.match(migration, /new\.podcast_key is distinct from old\.podcast_key/);
assert.match(migration, /metadata->>'rateable'/);
assert.match(migration, /manual_catalogue_v1:5843277d-8a1c-59b2-9f3e-e0e78234d88c/);

const app = await readFile("app.js", "utf8");
assert.match(app, /ensureManualCatalogueEpisodeMapping/);
assert.match(app, /ensure_manual_catalogue_episode/);
assert.match(app, /migrateLocalManualEpisodeRatingToSupabase/);
assert.match(app, /includeManualEpisodes: true/);
const localMigrationStart = app.indexOf("async function migrateLocalManualEpisodeRatingToSupabase");
const localMigrationEnd = app.indexOf("async function ensureManualCatalogueEpisodeMapping", localMigrationStart);
const localMigration = app.slice(localMigrationStart, localMigrationEnd);
assert.match(localMigration, /\.select\("rating"\)/);
assert.match(localMigration, /\.insert\(\{/);
assert.doesNotMatch(localMigration, /\.upsert\(/);

console.log("Manual episode identity protection tests passed");
