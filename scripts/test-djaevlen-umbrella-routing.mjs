import assert from "node:assert/strict";
import { buildDjaevlenRoutes, DJAEVLEN_FEED_KEY, DJAEVLEN_FEED_URL, DJAEVLEN_SOURCE } from "../supabase/functions/import-podcast-episodes/djaevlen-routing.mjs";
import { mapEpisodes, parseFeed, routeEpisodes, runEpisodeImport } from "../supabase/functions/import-podcast-episodes/core.ts";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";

const rows = [
  { Titel: "Manden der mistede sit ansigt", Hovedserie: "Djævlen i detaljen", "Podcast-ID": "manden der mistede sit ansigt" },
  { Titel: "Agent Frank", Hovedserie: "Djævlen i detaljen", "Podcast-ID": "agent frank" },
  { Titel: "Ålen på Ærø", Hovedserie: "Djævlen i detaljen", "Podcast-ID": "ålen på ærø" },
  { Titel: "Ægte udenfor", Hovedserie: "Anden serie", "Podcast-ID": "outside" },
  { Titel: "Mangler nøgle", Hovedserie: "Djævlen i detaljen", "Podcast-ID": "" }
];
const registry = buildDjaevlenRoutes(rows);
assert.equal(registry.routes.length, 3);
assert.equal(registry.skipped.missing_podcast_id, 1);
assert.equal(registry.routes[0].podcast_key, "manden der mistede sit ansigt");
assert.equal(registry.routes.some((route) => route.podcast_key === "outside"), false);

const merged = mergeSheetFeedConfigs({ rows: [...rows, { Titel: "Legacy owner", Hovedserie: "Djævlen i detaljen", "Podcast-ID": "danmarks vaerste massemorder", Feed: DJAEVLEN_FEED_URL }] });
const config = merged.configs[DJAEVLEN_FEED_KEY];
assert.equal(config.source, DJAEVLEN_SOURCE);
assert.equal(config.enabled, true);
assert.equal(Object.values(merged.configs).filter((entry) => entry.feed_url === DJAEVLEN_FEED_URL).length, 1);
assert.equal(merged.configs.danmarks_vaerste_massemorder, undefined);

const xml = `<rss><channel><title>Djævlen i detaljen</title>
<item><guid>face</guid><title>Teaser: Manden, der mistede sit ansigt 1:5 - Sporet</title></item>
<item><guid>agent</guid><title>Agent Frank 1:3 - Starten</title></item>
<item><guid>danish</guid><title>Ålen på Ærø 1:2 - Ægte spor</title></item>
<item><guid>unknown</guid><title>Ukendt ny serie 1:2</title></item></channel></rss>`;
const mapped = mapEpisodes(parseFeed(xml), config, "2026-09-30T00:00:00.000Z");
const routed = routeEpisodes(mapped.episodes, config);
assert.equal(routed.episodes.length, 3);
assert.equal(routed.episodes.find((episode) => episode.external_guid === "face").podcast_key, "manden der mistede sit ansigt");
assert.equal(routed.episodes.find((episode) => episode.external_guid === "danish").podcast_key, "ålen på ærø");
assert.equal(routed.report.unmatched.length, 1);
assert.equal(routed.report.ambiguous.length, 0);

const zeroRoute = mergeSheetFeedConfigs({ rows: [{ Titel: "Ikke Djævlen", Hovedserie: "Anden serie", "Podcast-ID": "ikke-djaevlen" }] });
assert.ok(zeroRoute.configs[DJAEVLEN_FEED_KEY]);
assert.equal(zeroRoute.configs[DJAEVLEN_FEED_KEY].enabled, false);
assert.deepEqual(zeroRoute.configs[DJAEVLEN_FEED_KEY].routes, []);
assert.equal(zeroRoute.audit.djaevlen_route_count, 0);

const ambiguous = routeEpisodes(mapped.episodes, { ...config, routes: [config.routes[0], { ...config.routes[0], key: "duplicate", podcast_key: "other" }] });
assert.equal(ambiguous.episodes.some((episode) => episode.external_guid === "face"), false);
assert.equal(ambiguous.report.ambiguous.length, 1);

const writes = [];
const repository = {
  createImportRun: async () => ({ id: "run" }),
  loadExistingEpisodes: async () => [{ ...routed.episodes[0], podcast_key: "danmarks vaerste massemorder" }],
  upsertEpisodes: async (items) => writes.push(...items),
  updateImportRun: async () => undefined
};
const result = await runEpisodeImport({ feedKey: DJAEVLEN_FEED_KEY, feedConfigs: merged.configs, repository, fetchText: async () => xml, now: () => "2026-09-30T00:00:00.000Z" });
assert.equal(result.details.routing.routing_conflict_count, 1);
assert.equal(writes.some((episode) => episode.external_guid === "face"), false);
assert.equal(result.details.routing.unmatched_count, 1);
assert.equal(FEED_CONFIGS[DJAEVLEN_FEED_KEY].source, DJAEVLEN_SOURCE);
console.log("Djævlen umbrella routing tests passed");
