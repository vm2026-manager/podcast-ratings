import assert from "node:assert/strict";
import { auditMedianoFeedXml } from "./audit-mediano-public-feed.mjs";
import { routePublicMedianoTitle } from "./mediano-public-routing.mjs";

assert.equal(routePublicMedianoTitle("MEDIANO PL: Runde 1").route.canonicalTitle, "Mediano PL");
assert.equal(routePublicMedianoTitle("mediano serie a — runde 1").route.canonicalTitle, "Mediano Serie A");
assert.equal(routePublicMedianoTitle("Mediano PL spiller omtaler Mediano Superliga").status, "unmatched");
assert.equal(routePublicMedianoTitle("Brüchmann ringer til #7: Gæst").route.canonicalTitle, "Brüchmann ringer til");
assert.equal(routePublicMedianoTitle("Bruchmann ringer til #7: Gæst").route.canonicalTitle, "Brüchmann ringer til");
const routes = [
  { canonicalTitle: "One", podcastId: "one", aliases: ["Shared"] },
  { canonicalTitle: "Two", podcastId: "two", aliases: ["Shared"] }
];
assert.equal(routePublicMedianoTitle("Shared: episode", routes).status, "ambiguous");

const report = auditMedianoFeedXml(`<?xml version="1.0"?><rss><channel>
  <item><guid>a</guid><title>Mediano PL: Runde 1</title><pubDate>Tue</pubDate><enclosure url="https://audio/a"/></item>
  <item><guid>b</guid><title>Ukendt format: episode</title><pubDate>Wed</pubDate><enclosure url="https://audio/b"/></item>
  <item><guid>a</guid><title>Mediano PL: Runde 1</title><pubDate>Tue</pubDate><enclosure url="https://audio/a"/></item>
</channel></rss>`);
assert.equal(report.totalItems, 3);
assert.equal(report.routedItems["Mediano PL"].count, 2);
assert.equal(report.unmatchedItems.length, 1);
assert.equal(report.duplicateCandidates.length, 3);
assert.equal(report.dryRun, true);
console.log("Mediano public routing dry-run tests passed");
