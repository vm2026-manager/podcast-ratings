import assert from "node:assert/strict";
import { detectRecentUmbrellaRoutingGaps, detectRecentFullLydRoutingGaps, formatReviewIssue, checkUmbrellaFeeds } from "./monitor-dr-umbrella-series.mjs";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { DJAEVLEN_FEED_KEY } from "../supabase/functions/import-podcast-episodes/djaevlen-routing.mjs";
import { BAKSPEJL_FEED_KEY } from "../supabase/functions/import-podcast-episodes/bakspejl-routing.mjs";

const rows = [
  { Titel: "Danmarks værste massemorder?", Hovedserie: "Djævlen i detaljen", "Podcast-ID": "danmarks vaerste massemorder" },
  { Titel: "Geniet i lommen", Hovedserie: "Bakspejl", "Podcast-ID": "geniet i lommen" },
  { Titel: "LA Riots", Hovedserie: "Bakspejl", "Podcast-ID": "la riots" }
];
const config = mergeSheetFeedConfigs({ rows }).configs;
const now = "2026-10-15T06:00:00Z";
const drXml = `<rss><channel><title>Djævlen i detaljen</title>
<item><guid>16122692741</guid><title>Teaser: Dræberurten</title><pubDate>Wed, 14 Oct 2026 03:00:00 GMT</pubDate><itunes:duration xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">00:02:18</itunes:duration></item>
<item><guid>16122692740</guid><title>Teaser: Danmarks værste massemorder? 5:5 - Sexgalning</title><pubDate>Wed, 07 Oct 2026 03:00:00 GMT</pubDate></item>
<item><guid>old</guid><title>Helt ukendt gammel serie</title><pubDate>Wed, 05 Sep 2023 03:00:00 GMT</pubDate></item>
</channel></rss>`;
const bakspejlXml = `<rss><channel><title>Bakspejl</title>
<item><guid>b1</guid><title>LA Riots 3:4</title><pubDate>Mon, 05 Oct 2026 03:00:00 GMT</pubDate></item>
<item><guid>b2</guid><title>Geniet i lommen 1:4</title><pubDate>Mon, 22 Jun 2026 03:00:00 GMT</pubDate></item>
</channel></rss>`;

const dr = detectRecentUmbrellaRoutingGaps({ feedKey: DJAEVLEN_FEED_KEY, feedXml: drXml, config: config[DJAEVLEN_FEED_KEY], now });
assert.equal(dr.enabled, true);
assert.equal(dr.candidates.length, 1);
assert.equal(dr.candidates[0].title, "Teaser: Dræberurten");
assert.equal(dr.candidates[0].guid, "16122692741");
assert.equal(dr.candidates[0].teaser_only, true);
assert.equal(dr.candidates[0].reason, "unmatched");
assert.equal(dr.candidates.some((entry) => entry.guid === "old"), false);
assert.equal(dr.candidates.some((entry) => entry.guid === "16122692740"), false);

const back = detectRecentUmbrellaRoutingGaps({ feedKey: BAKSPEJL_FEED_KEY, feedXml: bakspejlXml, config: config[BAKSPEJL_FEED_KEY], now });
assert.equal(back.candidates.length, 0);
assert.equal(back.configuration_problem, false);
const body = formatReviewIssue([dr, back], now);
assert.match(body, /Dræberurten/);
assert.match(body, /kun teaser i RSS/);
assert.doesNotMatch(body, /Helt ukendt gammel serie/);

const noRoutes = mergeSheetFeedConfigs({ rows: [{ Titel: "Another", Hovedserie: "Other", "Podcast-ID": "other" }] }).configs;
const noRoutesCheck = detectRecentUmbrellaRoutingGaps({ feedKey: DJAEVLEN_FEED_KEY, feedXml: drXml, config: noRoutes[DJAEVLEN_FEED_KEY], now });
assert.equal(noRoutesCheck.configuration_problem, true);

function drLydHtml(items) {
  return '<html><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({props:{pageProps:{episodesGroups:[{items}]}}}) + '</script></html>';
}
const drHtml = drLydHtml([
  {productionNumber:"16122692641",title:"Dræberurten",startTime:"2026-10-14T03:00:00Z",durationMilliseconds:2147000,presentationUrl:"https://www.dr.dk/lyd/special-radio/djaevlen-i-detaljen/djaevlen-i-detaljen-2026/draeberurten-16122692641"},
  {productionNumber:"16122692640",title:"Danmarks værste massemorder? 5:5 - Sexgalning",startTime:"2026-10-07T03:00:00Z",durationMilliseconds:1651000},
  {productionNumber:"16122292000",title:"Gammel ukendt serie",startTime:"2023-09-06T03:00:00Z",durationMilliseconds:1800000}
]);
const backHtml = drLydHtml([
  {productionNumber:"11162611014",title:"LA Riots 4:4",startTime:"2026-10-12T03:00:00Z",durationMilliseconds:2599000},
  {productionNumber:"11162611013",title:"LA Riots 3:4",startTime:"2026-10-05T03:00:00Z",durationMilliseconds:2378000}
]);
const full = detectRecentFullLydRoutingGaps({feedKey:DJAEVLEN_FEED_KEY,html:drHtml,config:config.djaevlen_lyd_full,now});
assert.equal(full.candidates.length,1);
assert.equal(full.candidates[0].title,"Dræberurten");
assert.equal(full.candidates[0].teaser_only,false);
assert.equal(full.candidates[0].duration_seconds,2147);
assert.equal(full.candidates[0].guid,"16122702641");
const fullBody = formatReviewIssue([full],now);
assert.match(fullBody,/Dræberurten/);
assert.match(fullBody,/35:47/);
assert.match(fullBody,/fuld episode i DR Lyd/);
assert.doesNotMatch(fullBody,/Gammel ukendt serie/);
const fetched = [];
const fakeFetch = async (url) => {
  fetched.push(url);
  if (url.endsWith("/data/podcasts.json")) return {ok:true,json:async()=>({rows})};
  if (url.includes("djaevlen-i-detaljen")) return {ok:true,text:async()=>drHtml};
  if (url.includes("bakspejl")) return {ok:true,text:async()=>backHtml};
  throw new Error("Unexpected fetch: "+url);
};
const live = await checkUmbrellaFeeds({ fetchFn: fakeFetch, now });
assert.deepEqual(live.map((item) => item.feed_key), [DJAEVLEN_FEED_KEY, BAKSPEJL_FEED_KEY]);
assert.equal(fetched.length, 3);
assert.equal(live[0].candidates.length, 1);
assert.equal(live[1].candidates.length, 0);
assert.equal(live[0].candidates[0].duration_seconds, 2147);
assert.equal(live[0].candidates[0].title, "Dræberurten");
assert.equal(live[1].fetched, 2);

console.log("DR umbrella new-series monitor tests passed");
