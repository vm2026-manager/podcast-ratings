import assert from "node:assert/strict";
import { mapEpisodes, parseFeed, routeEpisodes, runEpisodeImport } from "../supabase/functions/import-podcast-episodes/core.ts";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { loadRuntimeFeedConfigs, mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";

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

const catalogueBase = { rows: [{ Titel: "Støt Mediano", "Podcast-ID": "stot mediano" }] };
const mergedActive = mergeSheetFeedConfigs(catalogueBase).configs;
assert.equal(mergedActive.mediano_site.routes.find((route) => route.key === "stot_mediano").podcast_key, "stot mediano");
assert.equal(mergedActive.mediano_public.routes.find((route) => route.key === "stot_mediano").podcast_key, null);
for (const rows of [
  [],
  [{ Titel: "Støt Mediano", "Podcast-ID": "other id" }],
  [{ Titel: "Other title", "Podcast-ID": "stot mediano" }],
  [{ Titel: "Støt Mediano", "Podcast-ID": "stot mediano" }, { Titel: "Støt Mediano", "Podcast-ID": "stot mediano" }],
  [{ Titel: "Støt Mediano", "Podcast-ID": "stot mediano" }, { Titel: "Other title", "Podcast-ID": "stot mediano" }]
]) {
  const merged = mergeSheetFeedConfigs({ rows }).configs;
  assert.equal(merged.mediano_site.routes.find((route) => route.key === "stot_mediano").podcast_key, null);
  assert.equal(merged.mediano_public.routes.find((route) => route.key === "stot_mediano").podcast_key, null);
}
const failedLoad = await loadRuntimeFeedConfigs({
  podcastsJsonUrl: "https://catalogue.example/podcasts.json",
  fetchPayload: async () => { throw new Error("catalogue unavailable"); }
});
assert.equal(failedLoad.configs.mediano_site.routes.find((route) => route.key === "stot_mediano").podcast_key, null);
assert.match(failedLoad.audit.dynamic_feed_load_error, /catalogue unavailable/);

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

const activeConfig = mergedActive.mediano_site;
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
for (const route of activeConfig.routes.filter((entry) => entry.podcast_key && entry.title)) {
  const titlePrefix = route.title.prefixes?.[0] || route.title.startsWith?.[0] || route.title.words?.[0];
  if (!titlePrefix) continue;
  const title = `${titlePrefix}${titlePrefix.endsWith(" ") ? "" : ": "}test`;
  assert.equal(routeEpisodes([{ ...candidate, title }], activeConfig).episodes[0]?.podcast_key, route.podcast_key, route.key);
}

const descriptionFirstConfig = {
  ...activeConfig,
  routes: [
    { key: "verified_description_series", podcast_key: "verified description series", description: { aliases: ["Verified series evidence"] } },
    ...activeConfig.routes
  ]
};
assert.equal(
  routeEpisodes([{ ...candidate, description: "Verified series evidence in the public description" }], descriptionFirstConfig).episodes[0]?.podcast_key,
  "verified description series"
);

const noCategory = { ...candidate, metadata: { ...candidate.metadata, rss_categories: ["Podcast"] } };
assert.equal(routeEpisodes([noCategory], activeConfig).episodes.length, 0);
assert.equal(routeEpisodes([candidate], { ...activeConfig, source: "mediano_public_rss" }).episodes.length, 0);
assert.equal(routeEpisodes([candidate], { ...activeConfig, feed_url: "https://mirror.example/rss" }).episodes.length, 0);
for (const [title, categories] of [
  ["El Clásico Special: FC Barcelona", ["Fodbold Internationalt", "Podcast"]],
  ["El Clásico Special: Real Madrid", ["Fodbold Internationalt", "Podcast"]],
  ["Vi leder efter partnere til 2027 - er det din virksomhed?", ["Om Mediano", "Podcast"]]
]) {
  const excluded = {
    ...candidate,
    title,
    metadata: { ...candidate.metadata, rss_categories: categories }
  };
  assert.equal(routeEpisodes([excluded], activeConfig).episodes.length, 0, `${title} is not a Støt Mediano episode`);
}

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

const overlappingSiteXml = `<rss><channel><title>Mediano</title>
  <item><guid>573c1b7d01dbae9b52cd0936:573d6bdc37013bcc611eefd5:6ad9d39087900d3efae02ecd</guid>
    <title>Max Mediano: El Clasico, Carricks sidste chance og Paz' store gennembrud</title>
    <pubDate>Thu, 22 Oct 2026 09:58:19 +0000</pubDate>
    <link>https://www.mediano.nu/oversigt/max-mediano-9d4xb-bng9k</link>
    <category>Podcast</category><category>Støt Mediano</category><category>Fodbold Internationalt</category>
    <enclosure url="https://private.example/member-audio.mp3" />
  </item></channel></rss>`;
const publicEpisode = {
  ...candidate,
  id: "f821de51-41e9-4a0c-b86c-f2f3fdd62d4a",
  source: "mediano_public_rss",
  external_guid: "https://api.spreaker.com/episode/75919084",
  podcast_key: "max mediano",
  title: "MAX MEDIANO: El Clasico, Carricks sidste chance og Paz' store gennembrud",
  published_at: "2026-10-22T09:56:31.000Z",
  episode_url: "https://www.spreaker.com/episode/max-mediano-el-clasico-carricks-sidste-chance-og-paz-store-gennembrud--75919084"
};
const crossSourceWrites = [];
const crossSourceRepository = {
  createImportRun: async () => ({ id: "cross-source-duplicate" }),
  loadExistingEpisodes: async () => [publicEpisode],
  upsertEpisodes: async (rows) => crossSourceWrites.push(...rows),
  updateImportRun: async () => undefined
};
const crossSourceResult = await runEpisodeImport({
  feedKey: "mediano_site",
  feedConfigs: { mediano_site: activeConfig },
  repository: crossSourceRepository,
  fetchText: async () => overlappingSiteXml,
  now: () => "2026-10-23T00:00:00.000Z"
});
assert.deepEqual(crossSourceWrites, [], "the public-feed UUID and source are preserved when the site RSS repeats the episode");
assert.equal(crossSourceResult.inserted_count, 0);
assert.equal(crossSourceResult.details.routing.cross_source_identity_duplicate_count, 1);
assert.equal(publicEpisode.id, "f821de51-41e9-4a0c-b86c-f2f3fdd62d4a");
assert.equal(publicEpisode.source, "mediano_public_rss");

const differentEpisode = {
  ...publicEpisode,
  title: `${publicEpisode.title} - bonusanalyse`
};
const distinctEpisodeWrites = [];
const distinctEpisodeResult = await runEpisodeImport({
  feedKey: "mediano_site",
  feedConfigs: { mediano_site: activeConfig },
  repository: {
    ...crossSourceRepository,
    createImportRun: async () => ({ id: "distinct-cross-source-episode" }),
    loadExistingEpisodes: async () => [differentEpisode],
    upsertEpisodes: async (rows) => distinctEpisodeWrites.push(...rows)
  },
  fetchText: async () => overlappingSiteXml,
  now: () => "2026-10-23T00:00:00.000Z"
});
assert.equal(distinctEpisodeWrites.length, 1, "a similar title is not an identity match without an exact normalized match");
assert.equal(distinctEpisodeResult.inserted_count, 1);

console.log("Støt Mediano category routing tests passed");
