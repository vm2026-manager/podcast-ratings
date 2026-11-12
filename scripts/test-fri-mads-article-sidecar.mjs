import assert from "node:assert/strict";
import {
  FRI_MADS_CATALOGUE_ID,
  FRI_MADS_OVERVIEW_URL,
  FRI_MADS_PODCAST_ID,
  discoverFriMadsArticles
} from "./discover-fri-mads-releases.mjs";
import {
  createFriMadsArticleSidecar,
  isValidFriMadsArticleSidecar
} from "./update-fri-mads-article-sidecar.mjs";
import {
  FRI_MADS_OVERVIEW_172_TO_146_HTML,
  FRI_MADS_OVERVIEW_173_TO_147_HTML,
  makeFriMadsOverview
} from "./fixtures/fri-mads-overview-snapshot.mjs";

const simulatedRead = (html, afterNumber = 172) => ({
  ...discoverFriMadsArticles(html, { afterNumber }),
  pagesRequested: [FRI_MADS_OVERVIEW_URL]
});
const report = simulatedRead(FRI_MADS_OVERVIEW_172_TO_146_HTML);
const sidecar = createFriMadsArticleSidecar(report);

assert.equal(sidecar.schemaVersion, 1);
assert.equal(sidecar.podcastId, FRI_MADS_PODCAST_ID);
assert.equal(sidecar.catalogueId, FRI_MADS_CATALOGUE_ID);
assert.equal(sidecar.sourceOverview, FRI_MADS_OVERVIEW_URL);
assert.equal(sidecar.accessType, "paid");
assert.equal(sidecar.contentKind, "article");
assert.equal(sidecar.metadataOnly, true);
assert.equal(sidecar.playable, false);
assert.equal(sidecar.rateable, false);
assert.equal(sidecar.audioUrl, null);
assert.deepEqual(sidecar.items.map((item) => item.releaseNumber), [172, 171, 170, 169, 168]);
assert.equal(sidecar.items[0].title, "Fri Mads #172: Alle elsker Mette");
assert.equal(sidecar.items[0].publishedDate, "2026-11-08");
assert.equal(sidecar.items[0].canonicalUrl, "https://frihedsbrevet.dk/fri-mads-172-alle-elsker-mette/");
assert.deepEqual(Object.keys(sidecar.items[0]).sort(), ["canonicalUrl", "publishedDate", "releaseId", "releaseNumber", "title"]);
assert.equal(isValidFriMadsArticleSidecar(sidecar), true);

const repeated = createFriMadsArticleSidecar(report, sidecar);
assert.equal(JSON.stringify(repeated), JSON.stringify(sidecar), "an identical daily report is byte-stable and makes no sidecar change");

const syntheticUpdateReport = simulatedRead(FRI_MADS_OVERVIEW_173_TO_147_HTML);
const syntheticUpdate = createFriMadsArticleSidecar(syntheticUpdateReport, sidecar);
assert.deepEqual(syntheticUpdate.items.map((item) => item.releaseNumber), [173, 172, 171, 170, 169]);
assert.equal(syntheticUpdate.items[0].title, "Fri Mads #173: Testpost 173", "#173 is test-only parser data, never part of the checked-in live sidecar");
assert.equal(sidecar.items.some((item) => item.releaseNumber === 173), false);

const updateItem = (number, overrides = {}) => {
  const canonicalUrl = overrides.canonicalUrl || `https://frihedsbrevet.dk/fri-mads-${number}-testpost-${number}/`;
  return {
    releaseId: `fri-mads:${number}:${canonicalUrl}`,
    podcastId: FRI_MADS_PODCAST_ID,
    catalogueId: FRI_MADS_CATALOGUE_ID,
    releaseNumber: number,
    title: `Fri Mads #${number}: Testpost ${number}`,
    publishedDate: "2026-11-08",
    canonicalUrl,
    author: "Mads Brügger",
    sourceGuid: null,
    sourceGuidStatus: "official_overview_has_no_guid",
    accessType: "paid",
    contentKind: "article",
    metadataOnly: true,
    playable: false,
    rateable: false,
    audioUrl: null,
    ...overrides
  };
};
const reportWithItems = (items, extras = {}) => ({
  ...report,
  latestOverviewReleases: items,
  ...extras
});
const mustReject = (candidate, message) => assert.throws(() => createFriMadsArticleSidecar(candidate), undefined, message);

const validFive = [172, 171, 170, 169, 168].map((number) => updateItem(number));
mustReject(reportWithItems([validFive[0], { ...validFive[0] }]), "duplicate release numbers are rejected");
mustReject(reportWithItems([validFive[0], updateItem(170), ...validFive.slice(2)]), "number gaps are rejected");
mustReject(reportWithItems([validFive[0], updateItem(171, { canonicalUrl: "https://example.org/fri-mads-171-testpost-171/" }), ...validFive.slice(2)]), "foreign article domains are rejected");
mustReject(reportWithItems([validFive[0], updateItem(171, { canonicalUrl: "http://frihedsbrevet.dk/fri-mads-171-testpost-171/" }), ...validFive.slice(2)]), "non-HTTPS article URLs are rejected");
mustReject(reportWithItems([validFive[0], updateItem(171, { canonicalUrl: "https://frihedsbrevet.dk/fri-mads-171-testpost-171/?example=not-public" }), ...validFive.slice(2)]), "query-bearing article URLs are rejected");
mustReject(reportWithItems([validFive[0], updateItem(171, { title: "Fri Mads #170: Wrong number" }), ...validFive.slice(2)]), "title/number conflicts are rejected");
mustReject(reportWithItems([validFive[0], updateItem(171, { publishedDate: "2026-02-31" }), ...validFive.slice(2)]), "invalid publication dates are rejected");
mustReject(reportWithItems([validFive[0], updateItem(171, { rateable: true }), ...validFive.slice(2)]), "rateable article metadata is rejected");
mustReject(reportWithItems([validFive[0], updateItem(171, { playable: true }), ...validFive.slice(2)]), "playable article metadata is rejected");
mustReject(reportWithItems([validFive[0], updateItem(171, { audioUrl: "https://example.org/audio.mp3" }), ...validFive.slice(2)]), "audio URLs are rejected");
mustReject(reportWithItems([validFive[0], updateItem(171, { contentKind: "episode" }), ...validFive.slice(2)]), "episode classifications are rejected");
mustReject(reportWithItems([validFive[0], { ...validFive[1], injectedArticleText: "protected text" }, ...validFive.slice(2)]), "unapproved metadata fields are rejected");
mustReject(reportWithItems(validFive, { sourceOverview: "https://example.org/" }), "unapproved source URLs are rejected");
mustReject(reportWithItems(validFive, { status: "source_unavailable" }), "source failures fail closed");
mustReject(reportWithItems(validFive, { pagesRequested: [] }), "an unrequested or empty source fails closed");
mustReject(reportWithItems(validFive, { articleRequests: 1 }), "article-page requests are forbidden");
mustReject(reportWithItems(validFive, { supabaseCalls: 1 }), "Supabase calls are forbidden");
mustReject(reportWithItems(validFive, { writesPerformed: true }), "source writes are forbidden");

const conflictingUrl = createFriMadsArticleSidecar(reportWithItems(validFive.map((item, index) => index === 0
  ? { ...item, title: "Fri Mads #172: Rettet titel" }
  : item)));
assert.throws(() => createFriMadsArticleSidecar(reportWithItems(validFive.map((item, index) => index === 0
  ? updateItem(172, { canonicalUrl: "https://frihedsbrevet.dk/fri-mads-172-changed-permalink/" })
  : item)), sidecar), /existing_article_permalink_changed/u,
"an existing release number cannot silently switch to a different canonical permalink");
assert.equal(conflictingUrl.items[0].releaseNumber, 172, "a title correction on the same number/permalink remains identity-stable");

assert.equal(isValidFriMadsArticleSidecar({ ...sidecar, items: [...sidecar.items, { ...sidecar.items[0] }] }), false,
  "the browser validator rejects duplicate metadata");
assert.equal(isValidFriMadsArticleSidecar({ ...sidecar, privateArticleText: "must not publish" }), false,
  "the browser validator rejects unapproved or article-body fields");

const empty = simulatedRead(makeFriMadsOverview([]));
assert.equal(empty.status, "empty_source", "an empty official overview cannot produce a sidecar");
mustReject(empty, "empty source fails closed");

console.log("Fri Mads bounded article sidecar, identity, access, source-failure and idempotency tests passed.");
