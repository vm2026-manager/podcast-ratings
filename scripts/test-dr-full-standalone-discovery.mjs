import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { discoverVerifiedFullStandalone, FULL_STANDALONE_DISCOVERY_BASELINE } from "./dr-full-standalone-discovery.mjs";
import { mergeAutoDiscoveredDjaevlenRows } from "./djaevlen-auto-discovery.mjs";
import { mergeAutoDiscoveredBakspejlRows } from "./bakspejl-auto-discovery.mjs";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { parseDrLydEpisodes, mapDrLydEpisodes, routeEpisodes } from "../supabase/functions/import-podcast-episodes/core.ts";

assert.equal(FULL_STANDALONE_DISCOVERY_BASELINE, "2026-10-15T00:00:00.000Z");
const bakspejlRegistry = JSON.parse(readFileSync(new URL("../data/auto-discovered-bakspejl.json", import.meta.url), "utf8"));
const djaevlenRegistry = JSON.parse(readFileSync(new URL("../data/auto-discovered-djaevlen.json", import.meta.url), "utf8"));
assert.equal(bakspejlRegistry.records.find(x => x.discovery_key === "den spanske borgerkrig")?.podcast_id, "bakspejl-auto-v1-4962cdc5");
assert.equal(djaevlenRegistry.records.find(x => x.discovery_key === "draeberurten")?.podcast_id, "dræberurten");
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
const registry = { version: 1, baseline_published_at: "2026-09-23T14:25:00.000Z", processed_guids: ["16122692741", "16122692742"], records: [] };
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
  item(16122693010, "Ny miniserie", "2026-10-21T03:00:00Z", drUrl),
  item(16122702642, "Kvinden i Isdalen 1:5 - Et brændt lig", "2026-10-21T03:00:00Z", drUrl),
  item(16122702643, "Kvinden i Isdalen 2:5 - Næste afsnit", "2026-10-22T03:00:00Z", drUrl),
  item(16122702644, "Teaser: Besøg i arkivet 1:3 - Trailer", "2026-10-21T03:00:00Z", drUrl, 138000),
  item(16122702645, "Ugyldig URL-serie 1:2 - Afsnit", "2026-10-21T03:00:00Z", "https://example.com/"),
  { ...item(16122702652, "Kun show-side 1:2 - Afsnit", "2026-10-21T03:00:00Z", drUrl), presentationUrl: "https://www.dr.dk/lyd/special-radio/djaevlen-i-detaljen/" },
  item(16122702646, "Kort serie 1:2 - Afsnit", "2026-10-21T03:00:00Z", drUrl, 590000),
  item(16122702647, "Fremtidig serie 1:2 - Afsnit", "2026-10-23T03:00:00Z", drUrl),
  item(16122702648, "Dræberurten 1:2 - Afsnit", "2026-10-21T03:00:00Z", drUrl),
  item(16122702649, "Ugyldig ordinal 3:2 - Afsnit", "2026-10-21T03:00:00Z", drUrl),
  item(16122702650, "Uens total 1:3 - Afsnit", "2026-10-21T03:00:00Z", drUrl),
  item(16122702651, "Uens total 2:4 - Næste afsnit", "2026-10-22T03:00:00Z", drUrl)
];
const source = html(items);
const result = discoverVerifiedFullStandalone({
  showKey: "djaevlen", html: source, catalogueRows, registry, now
});
assert.equal(result.report.created.length, 2);
assert.equal(result.report.created.find(x => x.title === "En ny sag").podcast_id.startsWith("djaevlen-auto-v1-"), true);
assert.equal(result.report.created.find(x => x.title === "En ny sag").hovedserie, "Djævlen i detaljen");
assert.match(result.report.created.find(x => x.title === "En ny sag").description, /DR-podcasten/);
assert.equal(result.report.collisions.length, 1);
assert.equal(result.report.collisions[0].title, "Anden identitet");
assert.equal(result.report.unsafe.some(x => x.title === "Ny miniserie"), true, "Malformed numbered titles are not treated as singleton series");
assert.equal(result.report.created.some(x => /^(?:Ugyldig ordinal|Uens total)/u.test(x.title)), false, "Invalid ordinals and conflicting series totals are rejected");
const isdalen = result.report.created.find(x => x.title === "Kvinden i Isdalen");
assert.ok(isdalen, "A verified full numbered episode creates its canonical child series");
assert.ok(result.registry.processed_full_production_numbers.includes("16122702642"), "The verified 1:5 DR production number is independently consumed despite the processed teaser RSS GUID");
assert.ok(result.registry.processed_full_guids.includes("16122712642"), "The full 1:5 DR GUID stays distinct from the teaser RSS GUID");
assert.equal(result.report.already_registered.some(x => x.title === "Kvinden i Isdalen"), true, "2:5 reuses the 1:5 child route");
assert.equal(result.report.created.some(x => x.title.includes("Besøg i arkivet")), false, "Teasers never become standalone children");
assert.equal(result.registry.records.some(x => x.discovery_key === "draeberurten"), false, "Existing canonical child identities are never duplicated");
assert.equal(result.registry.records.length, 2);
assert.equal(result.registry.processed_guids.length, 2, "Legacy RSS identities preserved");
assert.deepEqual(result.registry.processed_full_production_numbers, ["16122702643", "16122693001", "16122702642"]);
assert.deepEqual(result.registry.processed_full_guids, ["16122712643", "16122703001", "16122712642"]);
assert.deepEqual(registry.records, [], "Input registry untouched");

const twice = discoverVerifiedFullStandalone({
  showKey: "djaevlen", html: source, catalogueRows, registry: result.registry, now
});
assert.equal(twice.report.created.length, 0, "No duplicate on repeated checks");
const mergedDr = mergeAutoDiscoveredDjaevlenRows(catalogueRows, result.registry);
assert.equal(mergedDr.length, catalogueRows.length + 2);
const published = discoverVerifiedFullStandalone({
  showKey: "djaevlen", html: source, catalogueRows: mergedDr, registry: result.registry, now
});
assert.equal(published.report.created.length, 0, "Published child must not create duplicate routes");
const drChild = mergedDr.find(x => x.Titel === "Kvinden i Isdalen");
assert.equal(drChild["Vuring (1-10)"], undefined, "Never fabricate editorial score");
assert.equal(drChild["Kort beskrivelse"], result.registry.records[0].description);
assert.equal(drChild.Genre, "True Crime");
const fullConfig = mergeSheetFeedConfigs({ rows: mergedDr }).configs.djaevlen_lyd_full;
const mapped = mapDrLydEpisodes(parseDrLydEpisodes(source), fullConfig, now);
const routed = routeEpisodes(mapped.episodes, fullConfig);
assert.equal(routed.episodes.find(x => x.title === "En ny sag")?.podcast_key, mergedDr.find(x => x.Titel === "En ny sag")["Podcast-ID"]);
assert.equal(routed.episodes.find(x => x.title.includes("1:5"))?.podcast_key, drChild["Podcast-ID"]);
assert.equal(routed.episodes.find(x => x.title.includes("2:5"))?.podcast_key, drChild["Podcast-ID"]);
assert.equal(routed.report.unmatched.some(x => x.title === "En ny sag"), false);
assert.equal(routed.report.ambiguous.length, 0, "New numbered routes remain unambiguous for the full-feed episodes");

const backReg = { version: 1, records: [], processed_guids: [] };
const back = discoverVerifiedFullStandalone({
  showKey: "bakspejl",
  html: html([
    item(11162612001, "Nye perspektiver", "2026-10-21T03:00:00Z", backUrl),
    item(11162612002, "LA Riots 4:4", "2026-10-12T03:00:00Z", backUrl),
    item(11162612003, "Den spanske borgerkrig 1:4 - Første afsnit", "2026-10-21T03:00:00Z", backUrl),
    item(11162612004, "Den spanske borgerkrig 2:4 - Næste afsnit", "2026-10-22T03:00:00Z", backUrl)
  ]),
  catalogueRows, registry: backReg, now
});
assert.equal(back.report.created.length, 2);
assert.equal(back.registry.records.find(x => x.discovery_key === "nye perspektiver").title, "Nye perspektiver");
assert.equal(back.registry.records.find(x => x.discovery_key === "den spanske borgerkrig").podcast_id, "bakspejl-auto-v1-4962cdc5");
assert.equal(back.report.already_registered.some(x => x.title === "Den spanske borgerkrig"), true, "Bakspejl 2:4 reuses one canonical child route");
const mergedBack = mergeAutoDiscoveredBakspejlRows(catalogueRows, back.registry);
const borgerkrigRow = mergedBack.find(x => x["Podcast-ID"] === "bakspejl-auto-v1-4962cdc5");
assert.equal(borgerkrigRow["Kort beskrivelse"], back.registry.records.find(x => x.discovery_key === "den spanske borgerkrig").description);
assert.equal(borgerkrigRow["Vuring (1-10)"], undefined);
assert.equal(mergeSheetFeedConfigs({rows:mergedBack}).configs.bakspejl_lyd_full.routes.some(r =>
  r.podcast_key === borgerkrigRow["Podcast-ID"]), true);

assert.throws(() => discoverVerifiedFullStandalone({
  showKey: "djaevlen", html: "<html></html>", catalogueRows, registry, now
}), /Invalid DR Lyd/);
assert.throws(() => discoverVerifiedFullStandalone({
  showKey: "djaevlen", html: html([]), catalogueRows, registry, now
}), /Incomplete DR Lyd/);

console.log("Full DR verified standalone discovery and protected catalogue tests passed");
