import assert from "node:assert/strict";
import { discoverVerifiedFullStandalone, FULL_STANDALONE_DISCOVERY_BASELINE } from "./dr-full-standalone-discovery.mjs";
import { mergeAutoDiscoveredDjaevlenRows } from "./djaevlen-auto-discovery.mjs";
import { mergeAutoDiscoveredBakspejlRows } from "./bakspejl-auto-discovery.mjs";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { parseDrLydEpisodes, mapDrLydEpisodes, routeEpisodes } from "../supabase/functions/import-podcast-episodes/core.ts";

assert.equal(FULL_STANDALONE_DISCOVERY_BASELINE, "2026-10-15T00:00:00.000Z");
const drUrl = "https://www.dr.dk/lyd/special-radio/djaevlen-i-detaljen/djaevlen-i-detaljen-2026/";
const backUrl = "https://www.dr.dk/lyd/special-radio/bakspejl/bakspejl-2026/";
const now = "2026-10-22T06:00:00Z";
function item(n, title, date, urlBase, duration = 2100000) {
  return {
    productionNumber: String(n), title, startTime: date,
    durationMilliseconds: duration, presentationUrl: urlBase + "afsnit-" + n
  };
}
function html(items) {
  return '<html><script id="__NEXT_DATA__" type="application/json">' +
    JSON.stringify({ props: { pageProps: { episodesGroups: [{ items }] } } }) +
    '</script></html>';
}
const catalogueRows = [
  { Titel: "Danmarks værste massemorder?", Hovedserie: "Djævlen i detaljen", "Podcast-ID": "danmarks vaerste massemorder" },
  { Titel: "Dræberurten", Hovedserie: "Djævlen i detaljen", "Podcast-ID": "dræberurten" },
  { Titel: "LA Riots", Hovedserie: "Bakspejl", "Podcast-ID": "la riots" },
  { Titel: "Anden identitet", Hovedserie: "Other", "Podcast-ID": "other" }
];
const registry = { version: 1, baseline_published_at: "2026-09-23T14:25:00.000Z", processed_guids: ["16122692741"], records: [] };
const items = [
  item(16122693001, "En ny sag", "2026-10-21T03:00:00Z", drUrl),
  item(16122692641, "Dræberurten", "2026-10-14T03:00:00Z", drUrl),
  item(16122693002, "Teaser: Udgivelsen", "2026-10-21T03:00:00Z", drUrl, 138000),
  item(16122693003, "Ny miniserie 1:2", "2026-10-21T03:00:00Z", drUrl),
  item(16122693004, "Ny miniserie 2:2", "2026-10-22T03:00:00Z", drUrl),
  item(16122693005, "Fremtidens sag", "2026-10-23T03:00:00Z", drUrl),
  item(16122693006, "For kort", "2026-10-21T03:00:00Z", drUrl, 590000),
  item(16122693007, "Anden identitet", "2026-10-21T03:00:00Z", drUrl),
  item(16122693008, "Ikke DR", "2026-10-21T03:00:00Z", "https://example.com/"),
  item(16122693009, "Gammelt", "2026-10-14T03:00:00Z", drUrl),
  item(16122693010, "Ny miniserie", "2026-10-21T03:00:00Z", drUrl)
];
const source = html(items);
const result = discoverVerifiedFullStandalone({
  showKey: "djaevlen", html: source, catalogueRows, registry, now
});
assert.equal(result.report.created.length, 1);
assert.equal(result.report.created[0].title, "En ny sag");
assert.equal(result.report.created[0].podcast_id.startsWith("djaevlen-auto-v1-"), true);
assert.equal(result.report.created[0].hovedserie, "Djævlen i detaljen");
assert.match(result.report.created[0].description, /DR-podcasten/);
assert.equal(result.report.collisions.length, 1);
assert.equal(result.report.collisions[0].title, "Anden identitet");
assert.equal(result.report.unsafe.some(x => x.title === "Ny miniserie"), true);
assert.equal(result.registry.records.length, 1);
assert.equal(result.registry.processed_guids.length, 1, "Legacy RSS identities preserved");
assert.equal(result.registry.processed_full_guids.length, 1);
assert.deepEqual(registry.records, [], "Input registry untouched");

const twice = discoverVerifiedFullStandalone({
  showKey: "djaevlen", html: source, catalogueRows, registry: result.registry, now
});
assert.equal(twice.report.created.length, 0, "No duplicate on repeated checks");
const mergedDr = mergeAutoDiscoveredDjaevlenRows(catalogueRows, result.registry);
assert.equal(mergedDr.length, catalogueRows.length + 1);
const drChild = mergedDr.at(-1);
assert.equal(drChild["Vuring (1-10)"], undefined, "Never fabricate editorial score");
assert.equal(drChild["Kort beskrivelse"], result.registry.records[0].description);
assert.equal(drChild.Genre, "True Crime");
const fullConfig = mergeSheetFeedConfigs({ rows: mergedDr }).configs.djaevlen_lyd_full;
const mapped = mapDrLydEpisodes(parseDrLydEpisodes(source), fullConfig, now);
const routed = routeEpisodes(mapped.episodes, fullConfig);
assert.equal(routed.episodes.find(x => x.title === "En ny sag")?.podcast_key, drChild["Podcast-ID"]);
assert.equal(routed.report.unmatched.some(x => x.title === "En ny sag"), false);

const backReg = { version: 1, records: [], processed_guids: [] };
const back = discoverVerifiedFullStandalone({
  showKey: "bakspejl",
  html: html([
    item(11162612001, "Nye perspektiver", "2026-10-21T03:00:00Z", backUrl),
    item(11162612002, "LA Riots 4:4", "2026-10-12T03:00:00Z", backUrl)
  ]),
  catalogueRows, registry: backReg, now
});
assert.equal(back.report.created.length, 1);
assert.equal(back.registry.records[0].title, "Nye perspektiver");
const mergedBack = mergeAutoDiscoveredBakspejlRows(catalogueRows, back.registry);
assert.equal(mergedBack.at(-1)["Kort beskrivelse"], back.registry.records[0].description);
assert.equal(mergedBack.at(-1)["Vuring (1-10)"], undefined);
assert.equal(mergeSheetFeedConfigs({rows:mergedBack}).configs.bakspejl_lyd_full.routes.some(r =>
  r.podcast_key === mergedBack.at(-1)["Podcast-ID"]), true);

assert.throws(() => discoverVerifiedFullStandalone({
  showKey: "djaevlen", html: "<html></html>", catalogueRows, registry, now
}), /Invalid DR Lyd/);
assert.throws(() => discoverVerifiedFullStandalone({
  showKey: "djaevlen", html: html([]), catalogueRows, registry, now
}), /Incomplete DR Lyd/);

console.log("Full DR verified standalone discovery and protected catalogue tests passed");
