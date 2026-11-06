import assert from "node:assert/strict";
import {
  getEpisodeFeatureEligibility,
  mapPodimoEpisodes,
  runEpisodeImport,
  selectNormalFeedKeys
} from "../supabase/functions/import-podcast-episodes/core.ts";
import { runPodimoDryRun } from "../supabase/functions/import-podcast-episodes/dry-run.ts";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";

const podcastKey = "sidste nedtælling";
const showId = "cf50f8b4-eb76-4eec-a355-b4e99e4e30bf";
const feedUrl = `https://open.podimo.com/podcast/${showId}`;
const source = "podimo_sidste_nedtaelling";
const baseConfig = FEED_CONFIGS.podimo_sidste_nedtaelling;
const catalogueRow = { "Podcast-ID": podcastKey, Feed: feedUrl };

assert.deepEqual(
  [baseConfig.podcast_key, baseConfig.source, baseConfig.podcast_id, baseConfig.enabled],
  [podcastKey, source, showId, false],
  "the exact reviewed source starts disabled until the canonical Sheet row is present"
);

const exact = mergeSheetFeedConfigs([catalogueRow]);
assert.equal(exact.configs.podimo_sidste_nedtaelling.enabled, true);
assert.equal(exact.configs.podimo_sidste_nedtaelling.podcast_id, showId);
assert.equal(exact.configs.podimo_sidste_nedtaelling.source, source);
assert.ok(selectNormalFeedKeys(exact.configs).includes("podimo_sidste_nedtaelling"));
assert.equal(exact.audit.feed_warnings.length, 0);

const wrongShow = mergeSheetFeedConfigs([{
  "Podcast-ID": podcastKey,
  Feed: "https://open.podimo.com/podcast/ffffffff-ffff-ffff-ffff-ffffffffffff"
}]);
assert.equal(wrongShow.configs.podimo_sidste_nedtaelling.enabled, false);
assert.equal(selectNormalFeedKeys(wrongShow.configs).includes("podimo_sidste_nedtaelling"), false);
assert.equal(wrongShow.audit.feed_warnings[0].reason, "podimo_show_id_mismatch");

const wrongPodcast = mergeSheetFeedConfigs([{ "Podcast-ID": "sidste halvleg", Feed: feedUrl }]);
assert.equal(wrongPodcast.configs.podimo_sidste_nedtaelling.enabled, false);
assert.equal(selectNormalFeedKeys(wrongPodcast.configs).includes("podimo_sidste_nedtaelling"), false);

const duplicateCanonicalRows = mergeSheetFeedConfigs([catalogueRow, catalogueRow]);
assert.equal(duplicateCanonicalRows.configs.podimo_sidste_nedtaelling.enabled, false);
assert.equal(selectNormalFeedKeys(duplicateCanonicalRows.configs).includes("podimo_sidste_nedtaelling"), false);

const missingAdapter = mergeSheetFeedConfigs([catalogueRow], {});
assert.equal(missingAdapter.configs.podimo_sidste_nedtaelling, undefined);
assert.equal(missingAdapter.audit.feed_warnings[0].reason, "podimo_adapter_review_required");

const liveEpisodes = [
  { id: "fd7da7ab-67bb-4768-8c9f-377fb29d4fc8", title: "Sidste nedtælling del 4 - Atomalderen", duration: 2301, publishedOn: "2023-10-19T02:01:21Z", playAvailable: true },
  { id: "5e89961b-b9e5-459b-8dd7-5117042759af", title: "Sidste nedtælling del 3 - Venner og fjender", duration: 2156, publishedOn: "2023-10-19T01:51:23Z", playAvailable: true },
  { id: "0e2dff97-c825-46b8-9659-872d730cc84c", title: "Sidste nedtælling del 2 - Manhattanprojektet", duration: 2228, publishedOn: "2023-10-19T01:41:14Z", playAvailable: true },
  { id: "4196d968-7dd0-4726-a82a-99c86ce7297e", title: "Sidste nedtælling del 1 - Spaltningen", duration: 2050, publishedOn: "2023-10-19T01:31:19Z", playAvailable: true }
];
const payload = { data: { episodes: liveEpisodes, page_count: 1 } };
const dryRun = await runPodimoDryRun({ config: exact.configs.podimo_sidste_nedtaelling, fetchPodimo: async () => payload });
assert.equal(dryRun.status, "success");
assert.equal(dryRun.valid_count, 4);
assert.equal(dryRun.active_full_episode_count, 4);
assert.equal(dryRun.teaser_trailer_excluded_count, 0);
assert.equal(dryRun.duplicate_guid_count, 0);
assert.equal(new Set(dryRun.episodes.map(episode => episode.external_guid)).size, 4);
assert.deepEqual(
  new Set(dryRun.episodes.map(episode => episode.title)),
  new Set(liveEpisodes.map(episode => episode.title))
);
assert.ok(dryRun.episodes.every(episode => episode.duration_seconds >= 1800));
assert.equal(dryRun.audio_url_values_are_null, true, "the public GraphQL adapter does not persist or expose audio URLs");

const teaserPayload = { data: { episodes: [
  { id: "teaser-a", title: "Teaser: Sidste nedtælling", duration: 40, publishedOn: "2023-10-19T00:00:00Z" },
  { id: "teaser-b", title: "Trailer: Sidste nedtælling", duration: 45, publishedOn: "2023-10-19T00:01:00Z" }
], page_count: 1 } };
const teaserDryRun = await runPodimoDryRun({ config: exact.configs.podimo_sidste_nedtaelling, fetchPodimo: async () => teaserPayload });
assert.equal(teaserDryRun.status, "partial", "HTTP/GraphQL success cannot report a healthy zero-full-episode feed");
assert.equal(teaserDryRun.active_full_episode_count, 0);
assert.equal(teaserDryRun.health_warning, "no_active_full_episodes");
assert.equal(getEpisodeFeatureEligibility(mapPodimoEpisodes(teaserPayload.data.episodes,
  exact.configs.podimo_sidste_nedtaelling, "2026-11-06T00:00:00.000Z").episodes).episodeFeatureEnabled, false);

const makeRepository = (initialRows = []) => {
  const rows = new Map(initialRows.map(row => [`${row.source}\0${row.external_guid}`, structuredClone(row)]));
  const ratings = new Set(initialRows.filter(row => row.has_rating).map(row => row.id));
  const importRuns = [];
  return {
    rows,
    ratings,
    importRuns,
    async createImportRun(input) { const run = { id: `run-${importRuns.length + 1}`, ...input }; importRuns.push(run); return run; },
    async loadExistingEpisodes(requestSource, guids) {
      return guids.map(guid => rows.get(`${requestSource}\0${guid}`)).filter(Boolean).map(row => structuredClone(row));
    },
    async upsertEpisodes(episodes) {
      for (const episode of episodes) {
        const key = `${episode.source}\0${episode.external_guid}`;
        const current = rows.get(key);
        if (current) {
          for (const field of ["id", "source", "external_guid", "podcast_key"]) {
            assert.equal(episode[field], current[field], `upsert must preserve existing ${field}`);
          }
          rows.set(key, { ...current, ...structuredClone(episode), id: current.id, source: current.source,
            external_guid: current.external_guid, podcast_key: current.podcast_key });
        } else {
          rows.set(key, { ...structuredClone(episode), id: `new-${episode.external_guid}` });
        }
      }
    },
    async updateImportRun(id, patch) { Object.assign(importRuns.find(run => run.id === id), patch); }
  };
};

const mappedLive = mapPodimoEpisodes(liveEpisodes, exact.configs.podimo_sidste_nedtaelling, "2026-11-06T00:00:00.000Z");
const ratedEpisode = { ...structuredClone(mappedLive.episodes[0]), id: "existing-rated-episode-uuid", has_rating: true };
const repository = makeRepository([ratedEpisode]);
const importOptions = { feedKey: "podimo_sidste_nedtaelling", feedConfigs: exact.configs, repository,
  fetchPodimo: async () => payload, now: () => "2026-11-06T00:00:00.000Z" };
const firstImport = await runEpisodeImport(importOptions);
assert.equal(firstImport.status, "success");
assert.equal(firstImport.inserted_count, 3);
assert.equal(repository.rows.get(`${source}\0${ratedEpisode.external_guid}`).id, ratedEpisode.id);
assert.ok(repository.ratings.has(ratedEpisode.id), "an existing rated UUID remains bound to the same episode row");
const identityBeforeRetry = [...repository.rows.values()].map(row => `${row.id}:${row.source}:${row.external_guid}:${row.podcast_key}`).sort();
const secondImport = await runEpisodeImport(importOptions);
assert.equal(secondImport.status, "success");
assert.equal(secondImport.inserted_count, 0);
assert.deepEqual([...repository.rows.values()].map(row => `${row.id}:${row.source}:${row.external_guid}:${row.podcast_key}`).sort(),
  identityBeforeRetry, "reimport is idempotent for UUID, source, GUID and canonical key");
assert.ok(repository.ratings.has(ratedEpisode.id));

const teaserRepository = makeRepository();
const teaserImport = await runEpisodeImport({ ...importOptions, repository: teaserRepository,
  fetchPodimo: async () => teaserPayload });
assert.equal(teaserImport.status, "partial");
assert.equal(teaserImport.details.active_rateable_episode_count, 0);
assert.equal(teaserImport.details.health_warning, "no_active_full_episodes");

console.log("Sidste nedtælling Podimo identity, full-episode health, rating preservation and idempotency regressions: PASS");
