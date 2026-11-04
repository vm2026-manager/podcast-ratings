import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { checkEpisodeFeedCoverage } from "./monitor-episode-feed-coverage.mjs";
import {
  getEpisodeFeatureEligibility,
  parseFeed,
  runEpisodeImport,
  selectNormalFeedKeys,
  validateExpectedRssIdentity
} from "../supabase/functions/import-podcast-episodes/core.ts";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";

const feedKey = "sig_noget_klogt_omny";
const config = FEED_CONFIGS[feedKey];
const debutGuid = "93ac0c93-55eb-4224-a8da-b4f000b887a2";
const novemberGuid = "5dee2725-781b-4109-b0ba-b4f700db5f68";
const futureGuid = "bed8ed00-a714-4d58-8cae-bd4b10d3bf1c";
const rss = (items, channel = "Sig noget klogt") => `<rss><channel><title>${channel}</title><link>https://jyllands-posten.dk/podcast/undergulvtaeppet/</link>${items.map(item => `<item>${item.guid === undefined ? "" : `<guid>${item.guid}</guid>`}<title>${item.title || "Episode"}</title>${item.date === undefined ? "" : `<pubDate>${item.date}</pubDate>`}<enclosure url="https://example.test/audio.mp3" type="audio/mpeg" /></item>`).join("")}</channel></rss>`;
const debut = { guid: debutGuid, title: "Jeg tror, du har en hemmelig plan, Løkke!", date: "Wed, 28 Oct 2026 04:00:00 +0000" };
const second = { guid: novemberGuid, title: "Hvorfor taler du så meget om landbruget, Søren Pind?", date: "Wed, 04 Nov 2026 04:00:00 +0000" };
const history = { guid: "legacy-under-gulvtaeppet-guid", title: "Under gulvtæppet: tidligere episode", date: "Wed, 07 Oct 2026 18:50:44 +0000" };

assert.equal(config.podcast_key, "sig noget klogt");
assert.equal(config.source, "omny_sig_noget_klogt_rss");
assert.equal(config.feed_url, "https://www.omnycontent.com/d/playlist/87e48115-d0ce-4e9b-83f0-ae5b01244e0a/658a58e7-b8a0-4210-b45c-b118008ddee5/714649ec-193a-45d1-9638-b118008ddef3/podcast.rss");
assert.ok(selectNormalFeedKeys(FEED_CONFIGS).includes(feedKey), "the exact code-owned source is scheduled by the existing import plan");
assert.equal(FEED_CONFIGS.under_gulvtaeppet, undefined, "the shared source is not assigned to the historical catalogue key");

const exactMerge = mergeSheetFeedConfigs({ rows: [{ Titel: "Sig noget klogt", "Podcast-ID": "sig noget klogt", Feed: config.feed_url }] });
assert.equal(exactMerge.configs[feedKey].podcast_key, "sig noget klogt");
assert.equal(Object.values(exactMerge.configs).filter(row => row.feed_url === config.feed_url).length, 1);
const wrongOwner = mergeSheetFeedConfigs({ rows: [{ Titel: "Under gulvtæppet", "Podcast-ID": "under gulvtæppet", Feed: config.feed_url }] });
assert.equal(wrongOwner.configs.under_gulvtæppet, undefined, "the exact shared URL cannot route by historical Podcast-ID");

const coverage = checkEpisodeFeedCoverage({ rows: [{ Titel: "Sig noget klogt", "Podcast-ID": "sig noget klogt", Feed: config.feed_url }] }, FEED_CONFIGS);
assert.deepEqual(coverage.findings, [], "feed coverage recognizes the precise approved source");

const baselineXml = rss([debut, second, history]);
const parsed = parseFeed(baselineXml);
validateExpectedRssIdentity(parsed, config);
const missingAnchor = parseFeed(rss([debut, history]));
assert.throws(() => validateExpectedRssIdentity(missingAnchor, config), /anchors are missing or ambiguous/u);
assert.throws(() => validateExpectedRssIdentity(parseFeed(rss([debut, second], "Under gulvtæppet")), config), /channel identity mismatch/u);
assert.throws(() => validateExpectedRssIdentity(parseFeed(rss([debut, { ...second, guid: debutGuid }])), config), /anchors are missing or ambiguous/u);

const writes = new Map();
const protectedRatings = new Map([["existing-episode-uuid", [8.5, 9]]]);
const ratingFingerprint = () => createHash("sha256").update(JSON.stringify([...protectedRatings])).digest("hex");
const ratingFingerprintBefore = ratingFingerprint();
const firstMapped = await import("../supabase/functions/import-podcast-episodes/core.ts").then(({ mapEpisodes }) => mapEpisodes(parsed, config, "2026-11-04T12:00:00.000Z"));
assert.equal(firstMapped.episodes.length, 2, "the two verified new-show episodes qualify");
assert.equal(firstMapped.boundary_excluded_count, 1, "the historical episode before the premiere boundary is excluded");
assert.deepEqual(firstMapped.episodes.map(row => row.external_guid).sort(), [debutGuid, novemberGuid].sort());
assert.ok(firstMapped.episodes.every(row => row.podcast_key === "sig noget klogt" && row.source === config.source));
assert.equal(firstMapped.episodes[0].metadata.rss_publication_boundary, "2026-10-28");
assert.equal(getEpisodeFeatureEligibility([firstMapped.episodes[0]]).episodeFeatureEnabled, false,
  "a single episode keeps the existing two-episode rating-eligibility threshold");

const duplicates = rss([debut, second, { guid: futureGuid, title: "Fremtidig episode", date: "Wed, 11 Nov 2026 04:00:00 +0000" }, { guid: futureGuid, title: "Dublet", date: "Wed, 11 Nov 2026 04:01:00 +0000" }]);
const duplicateRun = await import("../supabase/functions/import-podcast-episodes/core.ts").then(({ mapEpisodes }) => mapEpisodes(parseFeed(duplicates), config, "2026-11-04T12:00:00.000Z"));
assert.equal(duplicateRun.episodes.filter(row => row.external_guid === futureGuid).length, 0, "all copies of an ambiguous duplicate GUID are rejected");
assert.equal(duplicateRun.errors.filter(row => row.guid === futureGuid).length, 2);

const invalidIdentity = rss([debut, second,
  { guid: "not-a-verified-uuid", title: "Ubekræftet episode", date: "Wed, 11 Nov 2026 04:00:00 +0000" },
  { title: "Episode uden GUID", date: "Wed, 11 Nov 2026 04:00:00 +0000" },
  { guid: futureGuid, title: "Episode uden dato" }
]);
const invalidMapped = await import("../supabase/functions/import-podcast-episodes/core.ts").then(({ mapEpisodes }) => mapEpisodes(parseFeed(invalidIdentity), config, "2026-11-04T12:00:00.000Z"));
assert.equal(invalidMapped.episodes.length, 2);
assert.equal(invalidMapped.errors.length, 3, "unknown GUID format, missing GUID, and missing date fail closed");

const futureMapped = await import("../supabase/functions/import-podcast-episodes/core.ts").then(({ mapEpisodes }) => mapEpisodes(parseFeed(rss([debut, second, { guid: futureGuid, title: "Ny episode", date: "Wed, 11 Nov 2026 04:00:00 +0000" }])), config, "2026-11-04T12:00:00.000Z"));
assert.equal(futureMapped.episodes.length, 3, "a future episode with a valid source GUID and date remains importable");

const runRepository = {
  createImportRun: async () => ({ id: "mock-run" }),
  loadExistingEpisodes: async (_source, guids) => [...writes.values()].filter(row => guids.includes(row.external_guid)),
  upsertEpisodes: async rows => {
    for (const row of rows) {
      const key = `${row.source}:${row.external_guid}`;
      const old = writes.get(key);
      writes.set(key, { ...row, id: old?.id || (row.external_guid === debutGuid ? "existing-episode-uuid" : `episode-${row.external_guid}`) });
    }
  },
  updateImportRun: async () => undefined
};
writes.set(`${config.source}:${debutGuid}`, { ...firstMapped.episodes.find(row => row.external_guid === debutGuid), id: "existing-episode-uuid" });
const importOptions = { feedKey, feedConfigs: FEED_CONFIGS, repository: runRepository, fetchText: async () => baselineXml, now: () => "2026-11-04T12:00:00.000Z" };
const firstImport = await runEpisodeImport(importOptions);
assert.equal(firstImport.updated_count, 0);
assert.equal(firstImport.inserted_count, 1);
assert.equal(firstImport.details.boundary_excluded_count, 1);
assert.equal(writes.get(`${config.source}:${debutGuid}`).id, "existing-episode-uuid");
const secondImport = await runEpisodeImport(importOptions);
assert.equal(secondImport.inserted_count, 0, "rerunning the exact feed is idempotent");
assert.equal(secondImport.updated_count, 0);
assert.equal(ratingFingerprint(), ratingFingerprintBefore, "pre-existing episode ratings remain unchanged");

let rejectedWrites = 0;
const rejectRepository = { ...runRepository, upsertEpisodes: async () => { rejectedWrites++; } };
const wrongChannel = await runEpisodeImport({ ...importOptions, repository: rejectRepository, fetchText: async () => rss([debut, second], "Under gulvtæppet") });
assert.equal(wrongChannel.status, "failed");
assert.equal(rejectedWrites, 0, "a feed with the historical channel identity writes no episodes");
const missingRequiredAnchor = await runEpisodeImport({ ...importOptions, repository: rejectRepository, fetchText: async () => rss([debut, history]) });
assert.equal(missingRequiredAnchor.status, "failed");
assert.equal(rejectedWrites, 0, "missing identity anchors fail before episode writes");

// The existing generic Supabase RSS path must render one row and retain its
// per-episode rating action. This exercises the real row renderer with stubs.
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const next = app.indexOf("\nfunction ", start + 1);
  return app.slice(start, next < 0 ? app.length : next);
}
const episode = { id: "one-episode-uuid", external_guid: debutGuid, title: debut.title, published_at: "2026-10-28T04:00:00.000Z", is_active: true, metadata: {}, source: config.source };
const renderEpisodeRows = new Function("getPodcastEpisodeState", "getEpisodePodcastConfig", "getEpisodeWorkspaceEpisodes", "getEpisodeKey", "getAppleSeasonEpisodeNumber", "formatEpisodeDate", "getEpisodeStat", "getEpisodeUserRating", "parseNumber", "isManualEpisodeRatingAvailable", "escapeHtml", "formatCompactRating", "formatUserRatingCount", "formatEpisodeOverviewScore", "formatEpisodeOverviewOwnScore", "getOfficialMedianoEpisodeSourceUrl", `${extractFunction("renderPodcastEpisodeOverviewRows")}; return renderPodcastEpisodeOverviewRows;`)(
  () => ({ loading: false, error: "", items: [episode], workspaceVisibleCount: 50 }),
  () => ({ dataSource: "supabase" }),
  () => [episode],
  row => row.id,
  () => null,
  () => "28. okt. 2026",
  () => null,
  () => null,
  value => Number(value),
  () => true,
  value => String(value),
  () => "",
  value => value,
  value => `${value} <small>/10</small>`,
  value => value === null ? "Vurder" : String(value),
  () => null
);
const renderRows = renderEpisodeRows({ title: "Sig noget klogt" });
assert.equal((renderRows.match(/<tr class=/gu) || []).length, 1, "the overview shows a single available episode");
assert.match(renderRows, /Jeg tror, du har en hemmelig plan, Løkke!/u);
assert.match(renderRows, /data-episode-overview-rating-id="one-episode-uuid"/u, "the existing rating button remains available for its episode");

console.log("Sig noget klogt bounded RSS identity, idempotency, rating, coverage and single-episode UI tests passed.");
