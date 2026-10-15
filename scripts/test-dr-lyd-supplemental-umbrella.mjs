import assert from "node:assert/strict";
import { DJAEVLEN_LYD_FULL_FEED_KEY, BAKSPEJL_LYD_FULL_FEED_KEY } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { DJAEVLEN_FEED_KEY, DJAEVLEN_SOURCE } from "../supabase/functions/import-podcast-episodes/djaevlen-routing.mjs";
import { BAKSPEJL_FEED_KEY, BAKSPEJL_SOURCE } from "../supabase/functions/import-podcast-episodes/bakspejl-routing.mjs";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { parseDrLydEpisodes, mapDrLydEpisodes, routeEpisodes, runEpisodeImport } from "../supabase/functions/import-podcast-episodes/core.ts";

const rows = [
  { Titel: "Danmarks værste massemorder?", Hovedserie: "Djævlen i detaljen", "Podcast-ID": "danmarks vaerste massemorder", Feed: "https://api.dr.dk/podcasts/v1/feeds/djaevlen-i-detaljen" },
  { Titel: "LA Riots", Hovedserie: "Bakspejl", "Podcast-ID": "la riots", Feed: "https://api.dr.dk/podcasts/v1/feeds/bakspejl" },
  { Titel: "Geniet i lommen", Hovedserie: "Bakspejl", "Podcast-ID": "geniet i lommen", Feed: "https://api.dr.dk/podcasts/v1/feeds/bakspejl" }
];
const merged = mergeSheetFeedConfigs({ rows });
const configs = merged.configs;
const dr = configs[DJAEVLEN_LYD_FULL_FEED_KEY];
const back = configs[BAKSPEJL_LYD_FULL_FEED_KEY];
assert.equal(configs[DJAEVLEN_FEED_KEY].source, DJAEVLEN_SOURCE);
assert.equal(configs[BAKSPEJL_FEED_KEY].source, BAKSPEJL_SOURCE);
assert.equal(dr.enabled, true);
assert.equal(back.enabled, true);
assert.equal(dr.format, "dr_lyd_next_data");
assert.equal(back.format, "dr_lyd_next_data");
assert.deepEqual(dr.dedupe_by_episode_url_with_sources, [DJAEVLEN_SOURCE]);
assert.deepEqual(back.dedupe_by_episode_url_with_sources, [BAKSPEJL_SOURCE]);
assert.deepEqual(dr.routes.map(r => r.podcast_key), configs[DJAEVLEN_FEED_KEY].routes.map(r => r.podcast_key));
assert.deepEqual(back.routes.map(r => r.podcast_key), configs[BAKSPEJL_FEED_KEY].routes.map(r => r.podcast_key));
assert.equal(Object.values(configs).filter(c => c.source === BAKSPEJL_SOURCE).length, 1);
assert.equal(Object.values(configs).filter(c => c.source === DJAEVLEN_SOURCE).length, 1);

function drHtml(items) {
  return `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{episodesGroups:[{items}]}}})}</script></html>`;
}
const fullDrHtml = drHtml([
  { productionNumber:"16122692641", title:"Dræberurten", startTime:"2026-10-14T03:00:00Z", durationMilliseconds:2147000,
    presentationUrl:"https://www.dr.dk/lyd/special-radio/djaevlen-i-detaljen/djaevlen-i-detaljen-2026/draeberurten-16122692641" },
  { productionNumber:"16122692640", title:"Danmarks værste massemorder? 5:5 - Sexgalning", startTime:"2026-10-07T03:00:00Z", durationMilliseconds:1651000,
    presentationUrl:"https://www.dr.dk/lyd/special-radio/djaevlen-i-detaljen/djaevlen-i-detaljen-2026/danmarks-vaerste-massemorder-5-5-sexgalning-16122692640" }
]);
const mappedDr = mapDrLydEpisodes(parseDrLydEpisodes(fullDrHtml), dr, "2026-10-15T06:00:00Z");
assert.equal(mappedDr.episodes.length, 2);
assert.equal(mappedDr.episodes.find(e => e.title === "Dræberurten").duration_seconds, 2147);
assert.equal(mappedDr.episodes.find(e => e.title === "Dræberurten").is_active, true);
const routedDr = routeEpisodes(mappedDr.episodes, dr);
assert.equal(routedDr.episodes.length, 1);
assert.equal(routedDr.episodes[0].podcast_key, "danmarks vaerste massemorder");
assert.equal(routedDr.report.unmatched[0].title, "Dræberurten"); // REVIEW: not a registered catalogue series.

const oldEpisodeUrl = "https://www.dr.dk/lyd/special-radio/bakspejl/bakspejl-2026/la-riots-3-4-11162611013";
const newEpisodeUrl = "https://www.dr.dk/lyd/special-radio/bakspejl/bakspejl-2026/la-riots-4-4-11162611014";
const fullBackHtml = drHtml([
  { productionNumber:"11162611013", title:"LA Riots 3:4", startTime:"2026-10-05T03:00:00Z", durationMilliseconds:2378000, presentationUrl:oldEpisodeUrl },
  { productionNumber:"11162611014", title:"LA Riots 4:4", startTime:"2026-10-12T03:00:00Z", durationMilliseconds:2599000, presentationUrl:newEpisodeUrl }
]);
const legacy = {
  id:"keep-this-existing-uuid", podcast_key:"la riots", source:BAKSPEJL_SOURCE, external_guid:"11162611013",
  external_episode_id:"11162611013", title:"LA Riots 3:4", description:null,
  published_at:"2026-10-05T03:00:00Z", duration_seconds:2377, episode_url:oldEpisodeUrl,
  audio_url:null, image_url:null, is_active:true, metadata:{}
};
const writes = [];
let lookupSources;
const repository = {
  createImportRun: async () => ({ id:"dry-run" }),
  loadExistingEpisodes: async (_source,_guids,_urls,sources) => { lookupSources=sources; return [legacy]; },
  upsertEpisodes: async (items) => writes.push(...items),
  updateImportRun: async () => undefined
};
const result = await runEpisodeImport({
  feedKey:BAKSPEJL_LYD_FULL_FEED_KEY, feedConfigs:configs, repository, fetchText:async ()=>fullBackHtml,
  now:()=>"2026-10-15T06:00:00Z"
});
assert.equal(result.status, "success");
assert.deepEqual(lookupSources, [BAKSPEJL_SOURCE]);
assert.equal(writes.length, 1, "Existing RSS episode is not duplicated or moved");
assert.equal(writes[0].title, "LA Riots 4:4");
assert.equal(writes[0].podcast_key, "la riots");
assert.equal(writes[0].source, "dr_lyd_bakspejl_full");
assert.equal(writes[0].duration_seconds, 2599);
assert.notEqual(writes[0].external_guid, legacy.external_guid);
assert.equal(legacy.id, "keep-this-existing-uuid");

const noRoutes = mergeSheetFeedConfigs({ rows:[{ Titel:"Other", Hovedserie:"Other", "Podcast-ID":"other" }] }).configs;
assert.equal(noRoutes[DJAEVLEN_LYD_FULL_FEED_KEY].enabled, false);
assert.equal(noRoutes[BAKSPEJL_LYD_FULL_FEED_KEY].enabled, false);
assert.deepEqual(noRoutes[DJAEVLEN_LYD_FULL_FEED_KEY].routes, []);
assert.equal(noRoutes[BAKSPEJL_LYD_FULL_FEED_KEY].routes.length, 0);

console.log("DR Lyd supplemental umbrella full-episode tests passed");
