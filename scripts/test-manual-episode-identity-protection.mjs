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

const migration = await readFile("supabase/migrations/20261008112000_protect_manual_episode_identities.sql", "utf8");
assert.match(migration, /ensure_manual_catalogue_episode/);
assert.match(migration, /podcast_episodes_protect_identity/);
assert.match(migration, /Rated episode .* identity\/visibility is protected/);
assert.match(migration, /Manual catalogue episode .* identity\/visibility is protected/);

const app = await readFile("app.js", "utf8");
assert.match(app, /ensureManualCatalogueEpisodeMapping/);
assert.match(app, /ensure_manual_catalogue_episode/);
assert.match(app, /migrateLocalManualEpisodeRatingToSupabase/);
assert.match(app, /includeManualEpisodes: true/);

console.log("Manual episode identity protection tests passed");
