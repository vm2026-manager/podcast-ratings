import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { auditMedianoFeedXml } from "./audit-mediano-public-feed.mjs";
import { routePublicMedianoTitle } from "./mediano-public-routing.mjs";
import { MEDIANO_PUBLIC_ROUTE_DEFINITIONS, describeStotMedianoSource } from "../supabase/functions/import-podcast-episodes/mediano-routing.mjs";
import { buildMedianoCanonicalMigrationPlan } from "./mediano-canonical-migration-plan.mjs";

assert.equal(routePublicMedianoTitle("MEDIANO PL: Runde 1").route.canonicalTitle, "Mediano PL");
assert.equal(routePublicMedianoTitle("mediano serie a — runde 1").route.canonicalTitle, "Mediano Serie A");
assert.equal(routePublicMedianoTitle("Mediano PL spiller omtaler Mediano Superliga").status, "unmatched");
assert.equal(routePublicMedianoTitle("Brüchmann ringer til #7: Gæst").status, "known_no_destination");
assert.equal(routePublicMedianoTitle("Bruchmann ringer til #7: Gæst").status, "known_no_destination");
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

const normalizedFingerprintReport = auditMedianoFeedXml(`<?xml version="1.0"?><rss><channel>
  <item><guid>one</guid><title>Mediano PL: Runde 1</title><pubDate>Tue</pubDate><itunes:duration>60</itunes:duration></item>
  <item><guid>two</guid><title>MEDIANO PL : Runde 1</title><pubDate>Tue</pubDate><itunes:duration>60</itunes:duration></item>
</channel></rss>`);
assert.equal(
  normalizedFingerprintReport.duplicateCandidates.filter((candidate) => candidate.identity === "title_published_duration").length,
  1
);

const catalogue = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8")).rows;
const cataloguePodcastIds = new Set(catalogue.map((row) => row["Podcast-ID"]));
for (const route of MEDIANO_PUBLIC_ROUTE_DEFINITIONS.filter((route) => route.status === "enabled")) {
  assert(cataloguePodcastIds.has(route.podcastKey), `Enabled route must have catalogue Podcast-ID: ${route.key}`);
}
const plan = await buildMedianoCanonicalMigrationPlan();
assert.equal(plan.mappings.length, 24);
assert.equal(plan.mappings.filter((mapping) => mapping.editorialRatingPresent).length, 7);
assert.equal(plan.mappings.filter((mapping) => mapping.targetExistsInCatalogue).length, 2);
const stotInterface = describeStotMedianoSource();
assert.equal(stotInterface.feed_url_env, "STOT_MEDIANO_RSS_URL");
assert.equal(Object.hasOwn(stotInterface, "feed_url"), false);
assert.equal(stotInterface.activation, "blocked_pending_private_audio_authorization");
for (const historicalPodcastId of [
  "hammer og bruchmann", "superliga for voksne", "superzoom", "mediano em speciel 2021",
  "fodbold var værre i 70 erne", "den store talentserie", "vm manager special", "hammers kaffebar", "souplesse", "super"
]) {
  assert(cataloguePodcastIds.has(historicalPodcastId), `Historical Mediano format must remain: ${historicalPodcastId}`);
}
console.log("Mediano public routing dry-run tests passed");
