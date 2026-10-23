import assert from "node:assert/strict";
import { mapEpisodes, parseFeed, routeEpisodes, runEpisodeImport } from "../supabase/functions/import-podcast-episodes/core.ts";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";

const sourceConfig = FEED_CONFIGS.mediano_site;
const xml = `<rss><channel><title>Mediano</title>
  <item><guid>europa-special-20261022</guid><title>Europa Special: Sort dansk aften med dumme røde kort</title>
    <pubDate>Thu, 22 Oct 2026 23:56:21 +0000</pubDate><link>https://www.mediano.nu/oversigt/eurospecial221026</link>
    <category>Podcast</category><category>Støt Mediano</category><category>Fodbold Danmark</category>
    <enclosure url="https://private.example/member-audio.mp3" /></item>
</channel></rss>`;
const mapped = mapEpisodes(parseFeed(xml), sourceConfig, "2026-10-23T00:00:00.000Z");
const candidate = mapped.episodes[0];

assert.deepEqual(candidate.metadata.rss_categories, ["Podcast", "Støt Mediano", "Fodbold Danmark"]);
assert.equal(candidate.metadata.metadata_only, true);
assert.equal(candidate.audio_url, null);
assert.equal(candidate.episode_url, "https://www.mediano.nu/oversigt/eurospecial221026");
const thirdPartyMapped = mapEpisodes(parseFeed(xml), {
  ...sourceConfig,
  source: "third_party_rss",
  feed_url: "https://third-party.example/feed.xml"
}, "2026-10-23T00:00:00.000Z");
assert.equal(thirdPartyMapped.episodes[0].metadata.rss_categories, undefined);

const pendingRoute = sourceConfig.routes.find((route) => route.key === "stot_mediano");
assert.equal(pendingRoute.podcast_key, null);
assert.equal(pendingRoute.categories.includes("Støt Mediano"), true);

const pendingWrites = [];
const pendingRepository = {
  createImportRun: async () => ({ id: "pending-stot" }),
  loadExistingEpisodes: async () => [],
  upsertEpisodes: async (rows) => pendingWrites.push(...rows),
  updateImportRun: async () => undefined
};
const pendingResult = await runEpisodeImport({
  feedKey: "mediano_site",
  feedConfigs: { mediano_site: sourceConfig },
  repository: pendingRepository,
  fetchText: async () => xml,
  now: () => "2026-10-23T00:00:00.000Z"
});
assert.deepEqual(pendingWrites, []);
assert.equal(pendingResult.inserted_count, 0);
assert.equal(pendingResult.details.routing.known_no_destination_counts.stot_mediano, 1);

const activeConfig = {
  ...sourceConfig,
  routes: sourceConfig.routes.map((route) => route.key === "stot_mediano" ? { ...route, podcast_key: "stot mediano" } : route)
};
assert.deepEqual(routeEpisodes([candidate], activeConfig).episodes.map((episode) => episode.podcast_key), ["stot mediano"]);

for (const [title, podcastKey] of [
  ["Mediano PL: Runde 10", "mediano pl"],
  ["Mediano Superliga: Analyse", "mediano superliga"],
  ["Superliga Preview: Optakt", "superliga preview"],
  ["Max Mediano: Update", "max mediano"],
  ["Magasinet Jennings: FIFA", "magasinet jennings"]
]) {
  assert.equal(routeEpisodes([{ ...candidate, title }], activeConfig).episodes[0]?.podcast_key, podcastKey, title);
}

const noCategory = { ...candidate, metadata: { ...candidate.metadata, rss_categories: ["Podcast"] } };
assert.equal(routeEpisodes([noCategory], activeConfig).episodes.length, 0);
assert.equal(routeEpisodes([candidate], { ...activeConfig, source: "mediano_public_rss" }).episodes.length, 0);
assert.equal(routeEpisodes([candidate], { ...activeConfig, feed_url: "https://mirror.example/rss" }).episodes.length, 0);

const ambiguousConfig = {
  ...activeConfig,
  routes: [
    { key: "shared_one", podcast_key: "one", title: { aliases: ["Europa Special"] } },
    { key: "shared_two", podcast_key: "two", title: { aliases: ["Europa Special"] } },
    ...activeConfig.routes
  ]
};
const ambiguous = routeEpisodes([candidate], ambiguousConfig);
assert.equal(ambiguous.episodes.length, 0);
assert.equal(ambiguous.report.ambiguous.length, 1);

const itemXml = xml.slice(xml.indexOf("<item>"), xml.indexOf("</item>") + "</item>".length);
const duplicateFeed = parseFeed(xml.replace("</channel>", `${itemXml}</channel>`));
const duplicateMapped = mapEpisodes(duplicateFeed, activeConfig, "2026-10-23T00:00:00.000Z");
assert.equal(duplicateMapped.episodes.length, 1);
assert.equal(duplicateMapped.errors.length, 1);

const stored = [];
const writes = [];
const repository = {
  createImportRun: async () => ({ id: `active-stot-${writes.length}` }),
  loadExistingEpisodes: async () => stored,
  upsertEpisodes: async (rows) => { writes.push(rows); stored.push(...rows); },
  updateImportRun: async () => undefined
};
const run = () => runEpisodeImport({
  feedKey: "mediano_site",
  feedConfigs: { mediano_site: activeConfig },
  repository,
  fetchText: async () => xml,
  now: () => "2026-10-23T00:00:00.000Z"
});
const first = await run();
const second = await run();
assert.equal(writes.length, 1);
assert.equal(writes[0][0].podcast_key, "stot mediano");
assert.equal(writes[0][0].audio_url, null);
assert.equal(first.inserted_count, 1);
assert.equal(second.inserted_count, 0);
assert.equal(second.updated_count, 0);
assert.equal(second.skipped_count, 1);

console.log("Støt Mediano category routing tests passed");
