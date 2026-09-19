import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { auditMedianoFeedXml } from "./audit-mediano-public-feed.mjs";
import { routePublicMedianoTitle } from "./mediano-public-routing.mjs";
import { MEDIANO_PUBLIC_ROUTE_DEFINITIONS, describeStotMedianoSource } from "../supabase/functions/import-podcast-episodes/mediano-routing.mjs";
import { buildMedianoCanonicalMigrationPlan } from "./mediano-canonical-migration-plan.mjs";

assert.equal(routePublicMedianoTitle("MEDIANO PL: Runde 1").route.canonicalTitle, "Mediano PL");
assert.equal(routePublicMedianoTitle("mediano serie a — runde 1").route.canonicalTitle, "Mediano Serie A");
assert.equal(routePublicMedianoTitle("MAX UPDATE: Sommerens internationale nyheder").route.canonicalTitle, "Max Mediano");
assert.equal(routePublicMedianoTitle("Max Mediano Special: Sæsonens hold").route.canonicalTitle, "Max Mediano");
assert.equal(routePublicMedianoTitle("Mediano PL Special - Optakt til finalen").route.canonicalTitle, "Mediano PL");
assert.equal(routePublicMedianoTitle("Superliga for Voksne #75 - Fodboldtrøjen").route.canonicalTitle, "Superliga for voksne");
assert.equal(routePublicMedianoTitle("MINI MAX: Danske matchvindere").route.canonicalTitle, "Minimax");
assert.equal(routePublicMedianoTitle("Fodbold var værre i 70’erne #5: Talentets skueplads").route.canonicalTitle, "Fodbold var værre i 70'erne");
assert.equal(routePublicMedianoTitle("Mediano PL spiller omtaler Mediano Superliga").status, "unmatched");
assert.equal(routePublicMedianoTitle("Max Update senere i udsendelsen").status, "unmatched");
assert.equal(routePublicMedianoTitle("Mini Maximum: ikke Minimax").status, "unmatched");
assert.equal(routePublicMedianoTitle("Superliga for Voksnehed: ikke serien").status, "unmatched");
assert.equal(routePublicMedianoTitle("Fodbold var værre i 70'erne senere").status, "unmatched");
assert.equal(routePublicMedianoTitle("Brüchmann ringer til #7: Gæst").status, "known_no_destination");
assert.equal(routePublicMedianoTitle("Bruchmann ringer til #7: Gæst").status, "known_no_destination");
for (const title of [
  "PL PREVIEW: Optakt til runden",
  "Premier League Update #8: Transfer",
  "DET SPILLER IKKE: Episode 4",
  "MEDIANO CL: Finaleoptakt",
  "Mediano Futsal - Optakt",
  "Mediano VM - Optakt",
  "Mediano Sócrates: Debat",
  "Mediano Talks #3: Gæster",
  "HILLSBOROUGH-KATASTROFEN 1989: Afsnit 1",
  "SUPERLIGAENS STØRSTE ØJEBLIKKE: Historien"
]) assert.equal(routePublicMedianoTitle(title).status, "known_no_destination", title);
assert.equal(routePublicMedianoTitle("PL Preview senere i udsendelsen").status, "unmatched");
assert.equal(routePublicMedianoTitle("Mediano Classic: ikke Mediano CL").status, "unmatched");
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
assert.equal(report.totalRouted, 2);
assert.equal(report.totalUnmatched, 1);
assert.equal(report.totalAmbiguous, 0);
assert.equal(report.canonicalRoutes["Mediano PL"].count, 2);
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

const statusReport = auditMedianoFeedXml(`<?xml version="1.0"?><rss><channel>
  <item><guid>pending</guid><title>Brüchmann ringer til #7: Gæst</title></item>
  <item><guid>dedicated</guid><title>Fodboldministeriet: Egen udsendelse</title></item>
  <item><guid>unknown</guid><title>Ukendt program: Test</title></item>
</channel></rss>`);
assert.equal(statusReport.totalKnownNoDestination, 1);
assert.equal(statusReport.knownNoDestinationItems[0].route, "Brüchmann ringer til");
assert.equal(statusReport.canonicalRoutes["Brüchmann ringer til"].count, 1);
assert.equal(statusReport.totalSkipped, 1);
assert.equal(statusReport.skippedItems[0].route, "Fodboldministeriet");
assert.equal(statusReport.canonicalRoutes.Fodboldministeriet.count, 1);
assert.equal(statusReport.totalUnmatched, 1);

const catalogue = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8")).rows;
const cataloguePodcastIds = new Set(catalogue.map((row) => row["Podcast-ID"]));
// The canonical Jennings row is deliberately a local frontend addition until
// the catalogue source is updated; its literal is regression-tested here.
cataloguePodcastIds.add("magasinet jennings");
assert.equal(routePublicMedianoTitle("Magasinet Jennings: FIFA og verden").route.podcastId, "magasinet jennings");
assert.equal(routePublicMedianoTitle("Jennings: FIFA og verden").route.podcastId, "magasinet jennings");
assert.equal(routePublicMedianoTitle("Jennings Ekstra: FIFA og verden").route.podcastId, "magasinet jennings");
assert.equal(routePublicMedianoTitle("Jennings senere i udsendelsen").status, "unmatched");
for (const route of MEDIANO_PUBLIC_ROUTE_DEFINITIONS.filter((route) => route.status === "enabled")) {
  assert(cataloguePodcastIds.has(route.podcastKey), `Enabled route must have catalogue Podcast-ID: ${route.key}`);
}
const plan = await buildMedianoCanonicalMigrationPlan();
assert.equal(plan.candidates.length, 24);
assert.equal(plan.candidates.filter((mapping) => mapping.editorialRatingPresent).length, 7);
assert.equal(plan.candidates.filter((mapping) => mapping.targetExistsInCatalogue).length, 2);
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
