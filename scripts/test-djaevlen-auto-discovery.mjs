import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { discoverDjaevlenChildren, mergeAutoDiscoveredDjaevlenRows } from "./djaevlen-auto-discovery.mjs";
import { buildDjaevlenRoutes } from "../supabase/functions/import-podcast-episodes/djaevlen-routing.mjs";
const base={version:1,baseline_published_at:"2026-09-23T14:25:00.000Z",processed_guids:[],records:[]},rated={Titel:"Rated","Podcast-ID":"rated-key",Hovedserie:"Djævlen i detaljen"};
const old=discoverDjaevlenChildren({catalogueRows:[rated],registry:base,episodeItems:[{guid:"old",title:"Old series 1:3",published_at:"2026-09-23T14:25:00.000Z"}]});assert.equal(old.report.created.length,0);assert.equal(old.report.baseline_ignored.length,1);assert.equal(discoverDjaevlenChildren({catalogueRows:[rated],registry:base,episodeItems:[{guid:"after",title:"After baseline 1:3",published_at:"2026-09-23T14:25:01.000Z"}]}).report.created.length,1);
const first=discoverDjaevlenChildren({catalogueRows:[rated],registry:base,episodeItems:[{guid:"new",title:"Ny dansk Djævlen-serie 1:3",published_at:"2026-09-24T00:00:00Z"},{guid:"hist",title:"Coke i containeren",published_at:"2026-09-24T00:00:00Z"}]});assert.equal(first.report.created.length,1);assert.equal(first.report.unsafe.length,1);const again=discoverDjaevlenChildren({catalogueRows:[rated],registry:first.registry,episodeItems:[{guid:"new",title:"Ny dansk Djævlen-serie 1:3",published_at:"2026-09-24T00:00:00Z"},{guid:"next",title:"Ny dansk Djævlen-serie 2:3",published_at:"2026-09-25T00:00:00Z"}]});assert.equal(again.registry.records.length,1);assert.equal(again.report.duplicate_guid_ignored.length,1);
assert.equal(discoverDjaevlenChildren({catalogueRows:[rated],registry:base,episodeItems:[{guid:"bad",title:"Broken 1:3",published_at:"not-a-date"},{guid:"good",title:"Good child 1:3",published_at:"2026-09-24T00:00:00Z"}]}).report.created.length,1);
const dk=discoverDjaevlenChildren({catalogueRows:[rated],registry:base,episodeItems:[{guid:"dk",title:"Åben Ærø-serie 1:2",published_at:"2026-09-24T00:00:00Z"}]});const merged=mergeAutoDiscoveredDjaevlenRows([rated],dk.registry);assert.equal(merged.at(-1).Titel,"Åben Ærø-serie");assert.equal(buildDjaevlenRoutes(merged).routes.at(-1).podcast_key,dk.registry.records[0].podcast_id);
assert.equal(discoverDjaevlenChildren({catalogueRows:[{Titel:"Ny dansk Djævlen-serie","Podcast-ID":"other",Hovedserie:"Other"}],registry:base,episodeItems:[{guid:"c",title:"Ny dansk Djævlen-serie 1:3",published_at:"2026-09-24T00:00:00Z"}]}).report.collisions.length,1);assert.equal(discoverDjaevlenChildren({catalogueRows:[rated],registry:base,aliases:{"legacy rated title":"rated-key"},episodeItems:[{guid:"l",title:"Legacy rated title 1:3",published_at:"2026-09-24T00:00:00Z"}]}).report.created.length,0);
// Real, explicitly verified singleton episode from DR Lyd. The automatic
// discovery intentionally never invents a singleton, but a reviewed registry
// entry is safely merged into every Sheet-derived catalogue publication.
const approvedRegistry = JSON.parse(readFileSync(new URL("../data/auto-discovered-djaevlen.json", import.meta.url), "utf8"));
const approved = approvedRegistry.records.filter(item => item.discovery_key === "draeberurten");
assert.equal(approved.length, 1, "Only one canonical Dræberurten identity is allowed");
assert.equal(approved[0].podcast_id, "dræberurten");
assert.equal(approved[0].hovedserie, "Djævlen i detaljen");
const inserted = mergeAutoDiscoveredDjaevlenRows([rated], approvedRegistry);
assert.equal(inserted.length, 1 + approvedRegistry.records.length);
const approvedRow = inserted.find(row => row["Podcast-ID"] === "dræberurten");
assert.equal(approvedRow.Titel, "Dræberurten");
assert.equal(approvedRow.Vuring, undefined, "Never invent an editorial score");
assert.equal(approvedRow.Billedlink, approved[0].cover);
assert.equal(approvedRow["Kort beskrivelse"], approved[0].description);
assert.equal(approvedRow.Genre, "True Crime");
assert.match(merged.at(-1)["Kort beskrivelse"], /DR-podcasten/);
assert.ok(buildDjaevlenRoutes(inserted).routes.some(route => route.podcast_key === "dræberurten"));
assert.equal(mergeAutoDiscoveredDjaevlenRows([...inserted], approvedRegistry).length, inserted.length);
assert.throws(() => mergeAutoDiscoveredDjaevlenRows([{Titel:"Dræberurten",Hovedserie:"Djævlen i detaljen","Podcast-ID":"unrelated-id"}], approvedRegistry), /Unsafe Sheet takeover/);
assert.throws(() => mergeAutoDiscoveredDjaevlenRows([{Titel:"Unrelated podcast",Hovedserie:"Other","Podcast-ID":"dræberurten"}], approvedRegistry), /Podcast-ID collision/);

// Both the legacy RSS and full DR Lyd importer derive these same catalogue
// routes; no teaser is persisted by the full-episode importer.
const { mergeSheetFeedConfigs } = await import("../supabase/functions/import-podcast-episodes/runtime-feed-config.ts");
const { parseDrLydEpisodes, mapDrLydEpisodes, routeEpisodes } = await import("../supabase/functions/import-podcast-episodes/core.ts");
const configs = mergeSheetFeedConfigs({rows:inserted}).configs;
const fullFeed = configs.djaevlen_lyd_full;
assert.equal(fullFeed.enabled, true);
const url = "https://www.dr.dk/lyd/special-radio/djaevlen-i-detaljen/djaevlen-i-detaljen-2026/draeberurten-16122692641";
const html = '<html><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({props:{pageProps:{episodesGroups:[{items:[
  {productionNumber:"16122692641",title:"Dræberurten",startTime:"2026-10-14T03:00:00Z",durationMilliseconds:2147000,presentationUrl:url}
]}]}}}) + '</script></html>';
const mappedFull = mapDrLydEpisodes(parseDrLydEpisodes(html), fullFeed, "2026-10-15T07:00:00Z");
const routedFull = routeEpisodes(mappedFull.episodes, fullFeed);
assert.equal(routedFull.report.unmatched.length, 0);
assert.equal(routedFull.episodes.length, 1);
assert.equal(routedFull.episodes[0].title, "Dræberurten");
assert.equal(routedFull.episodes[0].podcast_key, "dræberurten");
assert.equal(routedFull.episodes[0].episode_url, url);
assert.equal(routedFull.episodes[0].duration_seconds, 2147);
assert.equal(routedFull.episodes[0].is_active, true);
console.log("Djævlen auto-discovery tests passed");
