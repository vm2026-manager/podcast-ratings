import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  fetchPodimoEpisodes,
  mapEpisodes,
  mapPodimoEpisodes,
  parseFeed,
  runEpisodeImport,
  selectNormalFeedKeys,
  validateExpectedRssIdentity
} from "../supabase/functions/import-podcast-episodes/core.ts";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { checkEpisodeFeedCoverage } from "./monitor-episode-feed-coverage.mjs";

const dobConfig = FEED_CONFIGS.dobbeltliv_dr_rss;
const parforholdConfig = FEED_CONFIGS.podimo_112_for_parforhold;
const parforholdShowId = "556dfd00-ae31-49b0-a346-0bf66eb9b0e3";
const dobEpisodes = [
  ["16122592803", "Afsløret på café", "Mon, 09 Nov 2026 05:00:00 +0100", "00:35:11"],
  ["16122592802", "Kæreste med en svindler", "Mon, 02 Nov 2026 05:00:00 +0100", "00:36:20"],
  ["16122592801", "Havde hus med en anden kvinde", "Mon, 26 Oct 2026 05:00:00 +0100", "00:32:56"]
];
const buildRss = (episodes = dobEpisodes, channel = "Dobbeltliv") => `<rss><channel><title>${channel}</title><link>https://www.dr.dk/lyd/special-radio/dobbeltliv-6005155958000</link>${episodes.map(([guid, title, date, duration]) => `<item><guid>${guid}</guid><title>${title}</title><pubDate>${date}</pubDate><itunes:duration>${duration}</itunes:duration><link>https://www.dr.dk/lyd/special-radio/dobbeltliv/${guid}</link><enclosure url="https://cdn.example.test/${guid}.mp3" type="audio/mpeg" /></item>`).join("")}</channel></rss>`;
const catalogue = rows => mergeSheetFeedConfigs({ rows });

assert.equal(dobConfig.podcast_key, "dobbeltliv");
assert.equal(dobConfig.source, "dr_dobbeltliv_rss");
assert.equal(dobConfig.feed_url, "https://api.dr.dk/podcasts/v1/feeds/bedraget");
assert.equal(dobConfig.expected_rss_channel_title, "Dobbeltliv");
assert.equal(dobConfig.expected_external_guid_prefix, "1612259280");
assert.equal(dobConfig.expected_rss_unique_guids, true);
assert.equal(parforholdConfig.podcast_key, "112 for parforhold");
assert.equal(parforholdConfig.podcast_id, parforholdShowId);
assert.equal(parforholdConfig.podimo_show_url, "https://podimo.com/dk/shows/112-for-parforhold");
assert.equal(parforholdConfig.source, "podimo_112_for_parforhold");
assert.ok(selectNormalFeedKeys(FEED_CONFIGS).includes("dobbeltliv_dr_rss"));
assert.ok(selectNormalFeedKeys(FEED_CONFIGS).includes("podimo_112_for_parforhold"));

const exactRows = [
  { "Podcast-ID": "dobbeltliv", Titel: "Dobbeltliv", Feed: dobConfig.feed_url },
  { "Podcast-ID": "112 for parforhold", Titel: "112 For Parforhold", Feed: `https://open.podimo.com/podcast/${parforholdShowId}` }
];
const exact = catalogue(exactRows);
assert.equal(exact.configs.dobbeltliv_dr_rss.podcast_key, "dobbeltliv");
assert.equal(exact.configs.podimo_112_for_parforhold.podcast_id, parforholdShowId);
assert.equal(exact.configs["112_for_knuste_hjerter"].podcast_key, "112 for knuste hjerter");
assert.ok(!Object.values(exact.configs).some(config => config.podcast_key === "112 for knuste hjerter" && config.podcast_id === parforholdShowId));
assert.ok(!checkEpisodeFeedCoverage({ rows: exactRows }).findings.some(row => ["dobbeltliv", "112 for parforhold"].includes(row.podcast_key)));

const wrongDobOwner = catalogue([{ "Podcast-ID": "det vildeste dobbeltliv", Titel: "Dobbeltliv", Feed: dobConfig.feed_url }]);
assert.ok(!Object.values(wrongDobOwner.configs).some(config => config.podcast_key === "det vildeste dobbeltliv" && config.enabled !== false),
  "the DR feed cannot activate for a similar but different catalogue ID");
assert.equal(wrongDobOwner.audit.feed_warnings.find(row => row.sheet_feed === dobConfig.feed_url)?.reason,
  "feed_owned_by_other_podcast");

const wrongPodimoShowUrl = `https://open.podimo.com/podcast/ffffffff-ffff-4fff-8fff-ffffffffffff`;
const wrongPodimo = catalogue([{ "Podcast-ID": "112 for parforhold", Titel: "112 For Parforhold", Feed: wrongPodimoShowUrl }]);
assert.equal(wrongPodimo.configs.podimo_112_for_parforhold.podcast_id, parforholdShowId,
  "a Sheet URL cannot mutate the code-pinned Podimo show ID");
assert.equal(wrongPodimo.audit.feed_warnings.find(row => row.podcast_key === "112 for parforhold")?.reason,
  "podimo_show_id_mismatch");
const wrongPodimoCoverage = checkEpisodeFeedCoverage({ rows: [{ ...exactRows[1], Feed: wrongPodimoShowUrl }] });
assert.equal(wrongPodimoCoverage.findings[0].cause, "podimo_show_id_mismatch");
assert.equal(wrongPodimoCoverage.findings[0].podimo_show_id, "ffffffff-ffff-4fff-8fff-ffffffffffff");

const goodFeed = parseFeed(buildRss());
validateExpectedRssIdentity(goodFeed, dobConfig);
const mapped = mapEpisodes(goodFeed, dobConfig, "2026-11-11T00:00:00.000Z");
assert.equal(mapped.episodes.length, 3, "all current DR items are full episodes, despite the Sheet count lagging by one");
assert.equal(mapped.episodes.filter(row => row.is_active).length, 3);
assert.deepEqual(mapped.episodes.map(row => row.external_guid).sort(), dobEpisodes.map(row => row[0]).sort());
assert.ok(mapped.episodes.every(row => row.podcast_key === "dobbeltliv" && row.source === "dr_dobbeltliv_rss"));
assert.deepEqual(mapped.episodes.map(row => row.duration_seconds).sort((a, b) => a - b), [1976, 2111, 2180]);

assert.throws(() => validateExpectedRssIdentity(parseFeed(buildRss(dobEpisodes, "Bedraget")), dobConfig), /channel identity mismatch/u);
assert.throws(() => validateExpectedRssIdentity(parseFeed(buildRss([
  dobEpisodes[0], ["other-guid", "Wrong source episode", dobEpisodes[1][2], dobEpisodes[1][3]]
])), dobConfig), /external GUID identity mismatch/u);
assert.throws(() => validateExpectedRssIdentity(parseFeed(buildRss([
  dobEpisodes[0], [dobEpisodes[0][0], "Conflicting duplicate", dobEpisodes[1][2], dobEpisodes[1][3]]
])), dobConfig), /duplicate GUID identity mismatch/u);

const writes = new Map();
const legacy = {
  id: "historic-episode-uuid",
  podcast_key: "dobbeltliv",
  source: "legacy_verified_dobbeltliv",
  external_guid: "legacy-dobbeltliv-guid",
  title: "Historisk Dobbeltliv-episode",
  episode_url: "https://www.dr.dk/lyd/special-radio/dobbeltliv/historisk",
  is_active: true,
  metadata: { identity_version: "legacy" }
};
const historicalRows = [legacy];
const historicalFingerprint = createHash("sha256").update(JSON.stringify(historicalRows)).digest("hex");
const current = {
  ...mapped.episodes[0],
  id: "existing-current-episode-uuid"
};
writes.set(`${current.source}:${current.external_guid}`, current);
const ratingRows = new Map([
  [legacy.id, [8.5]],
  [current.id, [9]]
]);
const ratingFingerprint = () => createHash("sha256").update(JSON.stringify([...ratingRows])).digest("hex");
const beforeRatingFingerprint = ratingFingerprint();
const repository = {
  createImportRun: async () => ({ id: "mock-run" }),
  loadExistingEpisodes: async (_source, guids) => [...historicalRows,
    ...[...writes.values()].filter(row => guids.includes(row.external_guid))],
  upsertEpisodes: async rows => {
    for (const row of rows) {
      const key = `${row.source}:${row.external_guid}`;
      const old = writes.get(key);
      writes.set(key, { ...row, id: old?.id || `new-${row.external_guid}` });
    }
  },
  updateImportRun: async () => undefined
};
const importOptions = {
  feedKey: "dobbeltliv_dr_rss",
  feedConfigs: FEED_CONFIGS,
  repository,
  fetchText: async url => {
    assert.equal(url, dobConfig.feed_url);
    return buildRss();
  },
  now: () => "2026-11-11T00:00:00.000Z"
};
const firstRun = await runEpisodeImport(importOptions);
assert.equal(firstRun.status, "success");
assert.equal(firstRun.inserted_count, 2);
assert.equal(writes.get(`${current.source}:${current.external_guid}`).id, current.id,
  "an existing episode UUID is retained");
assert.equal(createHash("sha256").update(JSON.stringify(historicalRows)).digest("hex"), historicalFingerprint,
  "historical source rows are retained unchanged");
assert.equal(ratingFingerprint(), beforeRatingFingerprint, "episode ratings remain unchanged");
const repeatRun = await runEpisodeImport(importOptions);
assert.equal(repeatRun.inserted_count, 0, "a repeated RSS import is idempotent");
assert.equal(repeatRun.updated_count, 0);
assert.equal(ratingFingerprint(), beforeRatingFingerprint);
assert.equal(createHash("sha256").update(JSON.stringify(historicalRows)).digest("hex"), historicalFingerprint);

let wrongFeedWrites = 0;
const rejectRepository = { ...repository, upsertEpisodes: async () => { wrongFeedWrites++; } };
for (const invalidXml of [
  buildRss(dobEpisodes, "Bedraget"),
  buildRss([["wrong-series-1", "Wrong show", dobEpisodes[0][2], dobEpisodes[0][3]]]),
  buildRss([dobEpisodes[0], [dobEpisodes[0][0], "Duplicate GUID", dobEpisodes[1][2], dobEpisodes[1][3]]])
]) {
  const result = await runEpisodeImport({ ...importOptions, repository: rejectRepository, fetchText: async () => invalidXml });
  assert.equal(result.status, "failed");
}
assert.equal(wrongFeedWrites, 0, "wrong channel, wrong GUID namespace, and duplicate GUIDs write no episodes");

const podimoEpisodes = [
  { id: "40debf5b-5ab0-4bbe-97db-30b7e89288f6", title: "S2-E33: Marie Alkestrup og Mads Bjerregaard", duration: 3688, publishedOn: "2026-11-10T02:10:03.658Z", playAvailable: true },
  { id: "teaser-guid", title: "Trailer: 112 For Parforhold", duration: 30, publishedOn: "2026-11-10T02:00:00Z", playAvailable: true }
];
const podimoMapped = mapPodimoEpisodes(podimoEpisodes, parforholdConfig, "2026-11-11T00:00:00Z");
assert.equal(podimoMapped.episodes.length, 2);
assert.equal(podimoMapped.episodes[0].podcast_key, "112 for parforhold");
assert.equal(podimoMapped.episodes[0].source, "podimo_112_for_parforhold");
assert.equal(podimoMapped.episodes[0].external_guid, podimoEpisodes[0].id);
assert.equal(podimoMapped.episodes[0].audio_url, null, "Podimo never fabricates a playable audio URL");
assert.equal(podimoMapped.episodes[1].is_active, false, "Podimo trailer titles are excluded from rating");
assert.equal(podimoMapped.episodes[1].metadata.exclusion_reason, "teaser_or_trailer");
assert.ok(podimoMapped.episodes.every(row => row.episode_url.startsWith(parforholdConfig.podimo_show_url + "/episode/")));

const oldFetch = globalThis.fetch;
let requestedShowId = null;
try {
  globalThis.fetch = async (_url, request) => {
    requestedShowId = JSON.parse(request.body).variables.podcastId;
    return new Response(JSON.stringify({ data: { episodes: [podimoEpisodes[0]] } }), { status: 200 });
  };
  await fetchPodimoEpisodes(parforholdConfig);
  assert.equal(requestedShowId, parforholdShowId, "GraphQL is queried with only the approved exact show ID");
  globalThis.fetch = async () => new Response(JSON.stringify({ data: { episodes: [podimoEpisodes[0], podimoEpisodes[0]] } }), { status: 200 });
  await assert.rejects(() => fetchPodimoEpisodes(parforholdConfig), /duplicate episode id/u);
} finally {
  globalThis.fetch = oldFetch;
}

console.log("Dobbeltliv and 112 For Parforhold exact-source, identity, teaser, history, rating, duplicate and idempotency tests passed.");
