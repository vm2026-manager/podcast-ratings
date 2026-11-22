import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  FRI_MADS_BASELINE_NUMBER,
  FRI_MADS_CATALOGUE_ID,
  FRI_MADS_HISTORICAL_SOURCE_URL,
  FRI_MADS_MAX_ARCHIVE_ITEMS,
  FRI_MADS_MAX_NEW_RELEASES,
  FRI_MADS_OVERVIEW_URL,
  FRI_MADS_PODCAST_ID,
  FRI_MADS_SECOND_PAGE_URL,
  discoverFriMadsArticles,
  parseFriMadsOverview,
  runFriMadsDiscovery,
  runFriMadsArchiveDiscovery
} from "./discover-fri-mads-releases.mjs";
import { FRIHEDSBREVET_SOURCE_REGISTRY } from "./audit-frihedsbrevet-sources.mjs";
import {
  FRI_MADS_OVERVIEW_172_TO_146_HTML,
  FRI_MADS_OVERVIEW_145_TO_119_HTML,
  FRI_MADS_OVERVIEW_173_TO_147_HTML,
  makeFriMadsOverview
} from "./fixtures/fri-mads-overview-snapshot.mjs";

const MIN_CATALOGUE_ROWS = 1376;

function assertCatalogueSnapshotIntegrity(snapshot) {
  assert.ok(snapshot && Array.isArray(snapshot.rows), "catalogue snapshot has a rows array");
  assert.ok(snapshot.rows.length >= MIN_CATALOGUE_ROWS,
    `catalogue snapshot retains at least the previous ${MIN_CATALOGUE_ROWS} rows`);

  const podcastIds = snapshot.rows.map((row) => row["Podcast-ID"]);
  assert.ok(podcastIds.every((id) => typeof id === "string" && id.length > 0),
    "every catalogue row has an exact Podcast-ID");
  assert.equal(new Set(podcastIds).size, podcastIds.length, "catalogue Podcast-IDs are unique");

  const catalogueIds = snapshot.rows.map((row) => row.catalogue_id).filter((id) => id != null);
  assert.equal(new Set(catalogueIds).size, catalogueIds.length, "catalogue_id values are unique");

  const expectedIdentities = new Map(FRIHEDSBREVET_SOURCE_REGISTRY.map((entry) => [entry.podcastId, entry.catalogueId]));
  const frihedsbrevetRows = snapshot.rows.filter((row) => expectedIdentities.has(row["Podcast-ID"]));
  assert.equal(expectedIdentities.size, 36, "the source audit covers all 36 exact Frihedsbrevet identities");
  assert.equal(frihedsbrevetRows.length, 36, "all 36 Frihedsbrevet rows occur exactly once");
  const byPodcastId = new Map(frihedsbrevetRows.map((row) => [row["Podcast-ID"], row]));
  for (const [podcastId, catalogueId] of expectedIdentities) {
    assert.equal(byPodcastId.get(podcastId)?.catalogue_id, catalogueId,
      `catalogue identity is preserved for ${podcastId}`);
  }
}

function assertCatalogueUnchanged(before, after) {
  assert.deepEqual(after, before, "discovery leaves all catalogue rows and identities unchanged");
}

const firstPage = parseFriMadsOverview(FRI_MADS_OVERVIEW_172_TO_146_HTML);
assert.equal(firstPage.length, 27);
assert.deepEqual([firstPage[0].number, firstPage.at(-1).number], [172, 146]);
assert.deepEqual(firstPage.map((item) => item.number), Array.from({ length: 27 }, (_, index) => 172 - index));
assert.equal(firstPage[0].title, "Fri Mads #172: Alle elsker Mette");
assert.equal(firstPage[0].url, "https://frihedsbrevet.dk/fri-mads-172-alle-elsker-mette/");
assert.equal(firstPage[0].author, "Mads Brügger");
assert.equal(firstPage[0].publishedDate, "2026-11-08");

const secondPage = parseFriMadsOverview(FRI_MADS_OVERVIEW_145_TO_119_HTML);
assert.equal(secondPage.length, 27);
assert.deepEqual([secondPage[0].number, secondPage.at(-1).number], [145, 119]);
assert.deepEqual(secondPage.map((item) => item.number), Array.from({ length: 27 }, (_, index) => 145 - index));
assert.equal(secondPage.find((item) => item.number === 121)?.url,
  "https://frihedsbrevet.dk/fri-mads-121-%d1%84%d0%b0%d0%bb%d0%b0%d1%84%d0%b5%d0%bb%d0%bb%d0%b0%d0%bd%d0%b4%d0%b8%d1%8f/",
  "the official Cyrillic permalink is preserved exactly");

for (const [number, title, url] of [
  [6, "Fri Mads #6: Manden fra Cypern", "https://frihedsbrevet.dk/fri-mads-manden-fra-cypern/"],
  [3, "Fri Mads #3: Lyd over land", "https://frihedsbrevet.dk/lyd-over-land/"],
  [28, "Fri Mads #28 Hr. Krabbes mismods vinter", "https://frihedsbrevet.dk/fri-mads-28-hr-krabbes-mismods-vinter/"],
  [63, "Fri Mads #63 – Jeg holder af hverdagen", "https://frihedsbrevet.dk/fri-mads-63-jeg-holder-af-hverdagen/"]
]) {
  const parsed = parseFriMadsOverview(makeFriMadsOverview([number], { [number]: { title, url } }));
  assert.equal(parsed[0].number, number, `official legacy/title variant for #${number} retains its exact number`);
  assert.equal(parsed[0].url, url, `official legacy/title variant for #${number} retains its exact permalink`);
}

const unchanged = discoverFriMadsArticles(FRI_MADS_OVERVIEW_172_TO_146_HTML);
assert.equal(unchanged.status, "no_new_releases", "the established #172 baseline is not historically backfilled");
assert.deepEqual(unchanged.releases, []);
assert.deepEqual(unchanged.latestOverviewReleases.map((item) => item.releaseNumber), [172, 171, 170, 169, 168],
  "the same bounded parser result exposes only the five newest verified overview cards for the static sidecar");
assert.equal(unchanged.latestOverviewReleases[0].title, "Fri Mads #172: Alle elsker Mette");
assert.equal(unchanged.latestOverviewReleases[0].canonicalUrl, "https://frihedsbrevet.dk/fri-mads-172-alle-elsker-mette/");
assert.equal(unchanged.sourceOverview, FRI_MADS_OVERVIEW_URL);
assert.equal(unchanged.supplementalFeed, "not_requested_overview_is_primary");
assert.equal(unchanged.pagesRequested.length, 0, "pure parsing does not claim network requests");

const newPage = discoverFriMadsArticles(FRI_MADS_OVERVIEW_173_TO_147_HTML);
assert.equal(newPage.status, "new_metadata_discovered");
assert.equal(newPage.candidateCount, 27);
assert.equal(newPage.releases.length, 1);
const release = newPage.releases[0];
assert.equal(release.releaseNumber, 173);
assert.equal(release.title, "Fri Mads #173: Testpost 173");
assert.equal(release.canonicalUrl, "https://frihedsbrevet.dk/fri-mads-173-testpost-173/");
assert.equal(release.publishedDate, "2026-11-08");
assert.equal(release.author, "Mads Brügger");
assert.equal(release.podcastId, "fri mads");
assert.equal(release.catalogueId, "catalogue-v1-d94fc39e");
assert.equal(release.accessType, "paid");
assert.equal(release.contentKind, "article");
assert.equal(release.metadataOnly, true);
assert.equal(release.playable, false);
assert.equal(release.rateable, false);
assert.equal(release.audioUrl, null);
assert.equal(release.sourceGuid, null);
assert.equal(release.sourceGuidStatus, "official_overview_has_no_guid");
assert.equal(newPage.writesPerformed, false);
assert.equal(newPage.supabaseCalls, 0);
assert.equal(newPage.sheetWrites, 0);
assert.equal(newPage.catalogueWrites, 0);
assert.equal(newPage.episodeImports, 0);
assert.equal(newPage.articleRequests, 0);
assert.equal(JSON.stringify(newPage).includes("Fri Mads article body"), false);

const repeated = discoverFriMadsArticles(FRI_MADS_OVERVIEW_173_TO_147_HTML);
assert.deepEqual(repeated, newPage, "the same official listing and cursor produce the same release IDs/output on a second run");
assert.equal(release.releaseId, "fri-mads:173:https://frihedsbrevet.dk/fri-mads-173-testpost-173/");
const titleChangeSameUrl = makeFriMadsOverview([173], { 173: { title: "Fri Mads #173: Rettet redaktionel titel" } });
assert.equal(discoverFriMadsArticles(titleChangeSameUrl).releases[0].releaseId, release.releaseId,
  "a title edit does not change URL/number identity");
const teaser = makeFriMadsOverview([173], { 173: { title: "Fri Mads #173: Teaser" } });
assert.deepEqual(discoverFriMadsArticles(teaser).reasonCodes, ["teaser_or_trailer"]);

const unrelatedOnly = makeFriMadsOverview([], {});
assert.equal(discoverFriMadsArticles(unrelatedOnly).status, "empty_source");
const unrelatedWithSeries = FRI_MADS_OVERVIEW_172_TO_146_HTML.replace(
  "<main>",
  '<main><a href="https://frihedsbrevet.dk/anden-serie-4/"><h3 class="post-card-headline">Anden serie #4</h3></a>'
);
assert.equal(discoverFriMadsArticles(unrelatedWithSeries).status, "no_new_releases");

const wrongHost = makeFriMadsOverview([172], { 172: { url: "https://example.org/fri-mads-172-testpost-172/" } });
assert.equal(discoverFriMadsArticles(wrongHost).status, "source_invalid");
assert.deepEqual(discoverFriMadsArticles(wrongHost).releases, []);

const wrongPermalink = makeFriMadsOverview([172], { 172: { url: "https://frihedsbrevet.dk/fri-mads-171-testpost-171/" } });
assert.deepEqual(discoverFriMadsArticles(wrongPermalink).reasonCodes, ["number_permalink_conflict"]);

const duplicateNumber = makeFriMadsOverview([173, 173]);
assert.deepEqual(discoverFriMadsArticles(duplicateNumber).reasonCodes, ["duplicate_release_number"]);
const duplicateUrl = makeFriMadsOverview([173, 172], {
  173: { url: "https://frihedsbrevet.dk/fri-mads-173-testpost-173/" },
  172: { url: "https://frihedsbrevet.dk/fri-mads-173-testpost-173/" }
});
assert.deepEqual(discoverFriMadsArticles(duplicateUrl).reasonCodes, ["number_permalink_conflict"]);

const numberConflict = makeFriMadsOverview([173], {
  173: { title: "Fri Mads #172: Forkert nummer", url: "https://frihedsbrevet.dk/fri-mads-173-testpost-173/" }
});
assert.deepEqual(discoverFriMadsArticles(numberConflict).reasonCodes, ["number_permalink_conflict"]);
const historicalNumberConflict = makeFriMadsOverview([140], {
  140: { url: "https://frihedsbrevet.dk/fri-mads-140-wrong-story/" }
});
assert.deepEqual(discoverFriMadsArticles(historicalNumberConflict).reasonCodes, ["historical_source_conflict"]);
const historicalUrlConflict = makeFriMadsOverview([141], { 141: { url: FRI_MADS_HISTORICAL_SOURCE_URL } });
assert.deepEqual(discoverFriMadsArticles(historicalUrlConflict).reasonCodes, ["historical_source_conflict"]);

const missingNumber = makeFriMadsOverview([173, 171]);
assert.deepEqual(discoverFriMadsArticles(missingNumber).reasonCodes, ["release_number_gap"]);
const unknownTitleMarkup = makeFriMadsOverview([173]).replace("c-post-card__title", "unknown-title-class");
assert.deepEqual(discoverFriMadsArticles(unknownTitleMarkup).reasonCodes, ["overview_markup_changed"]);
const unknownCategoryMarkup = makeFriMadsOverview([173]).replace("c-post-card__category__title", "unknown-category-class");
assert.deepEqual(discoverFriMadsArticles(unknownCategoryMarkup).reasonCodes, ["overview_markup_changed"]);
const missingMetadata = makeFriMadsOverview([173]).replace("8. november 2026 kl. 06:00", "dato mangler");
assert.deepEqual(discoverFriMadsArticles(missingMetadata).reasonCodes, ["overview_metadata_changed"]);
assert.deepEqual(discoverFriMadsArticles("<!doctype html><html><body></body></html>").reasonCodes, ["empty_source"]);
assert.deepEqual(discoverFriMadsArticles("<html><body><a href=\"broken\">unclosed").reasonCodes, ["overview_markup_changed"]);

const gapAtPaginationBoundary = await runFriMadsDiscovery({
  afterNumber: 120,
  fetchImpl: async (url) => new Response(url === FRI_MADS_OVERVIEW_URL ? FRI_MADS_OVERVIEW_173_TO_147_HTML : FRI_MADS_OVERVIEW_145_TO_119_HTML, {
    status: 200, headers: { "content-type": "text/html; charset=UTF-8" }
  })
});
assert.equal(gapAtPaginationBoundary.status, "identity_conflict");
assert.deepEqual(gapAtPaginationBoundary.reasonCodes, ["pagination_boundary_gap"]);
assert.equal(gapAtPaginationBoundary.pagesRequested.length, 2);
assert.deepEqual(gapAtPaginationBoundary.releases, [], "a page-boundary gap cannot produce partial releases");

const tooOldCursor = await runFriMadsDiscovery({
  afterNumber: 119,
  fetchImpl: async (url) => new Response(url === FRI_MADS_OVERVIEW_URL
    ? FRI_MADS_OVERVIEW_173_TO_147_HTML
    : makeFriMadsOverview(Array.from({ length: 27 }, (_, index) => 146 - index)), {
    status: 200, headers: { "content-type": "text/html; charset=UTF-8" }
  })
});
assert.equal(tooOldCursor.status, "identity_conflict");
assert.deepEqual(tooOldCursor.reasonCodes, ["incremental_window_exceeded"]);
assert.equal(tooOldCursor.releases.length, 0, "bounded discovery refuses a broad historical backfill");
assert.equal(FRI_MADS_MAX_NEW_RELEASES, 27);

const archivePageOne = FRI_MADS_OVERVIEW_172_TO_146_HTML;
const archivePageTwo = FRI_MADS_OVERVIEW_145_TO_119_HTML;
const archivePageThree = makeFriMadsOverview(Array.from({ length: 14 }, (_, index) => 118 - index));
const archivePages = new Map([
  [FRI_MADS_OVERVIEW_URL, archivePageOne],
  [FRI_MADS_SECOND_PAGE_URL, archivePageTwo],
  ["https://frihedsbrevet.dk/nyhedsbrev/fri-mads/?paginate=3", archivePageThree]
]);
const archiveRequests = [];
const archiveReport = await runFriMadsArchiveDiscovery({ fetchImpl: async (url, options) => {
  archiveRequests.push({ url, options });
  return new Response(archivePages.get(url), { status: 200, headers: { "content-type": "text/html; charset=UTF-8" } });
} });
assert.equal(archiveReport.status, "archive_verified");
assert.deepEqual(archiveReport.reasonCodes, []);
assert.equal(archiveReport.discoveryMode, "full_archive");
assert.deepEqual(archiveReport.pagesRequested, [...archivePages.keys()]);
assert.equal(archiveReport.archiveReleases.length, 68);
assert.deepEqual([archiveReport.archiveReleases[0].releaseNumber, archiveReport.archiveReleases.at(-1).releaseNumber], [172, 105]);
assert.equal(archiveReport.latestOverviewReleases.length, 5);
assert.equal(archiveReport.archiveReleases.find((item) => item.releaseNumber === 121)?.canonicalUrl,
  "https://frihedsbrevet.dk/fri-mads-121-%d1%84%d0%b0%d0%bb%d0%b0%d1%84%d0%b5%d0%bb%d0%bb%d0%b0%d0%bd%d0%b4%d0%b8%d1%8f/");
assert.ok(archiveRequests.every(({ options }) => options.method === "GET" && options.redirect === "error"));
assert.equal(archiveRequests.length, 3, "archive discovery follows only the three official overview pages in this fixture");
assert.equal(archiveReport.articleRequests, 0, "full archive discovery never requests individual articles");
assert.equal(archiveReport.supabaseCalls + archiveReport.episodeImports + archiveReport.sheetWrites, 0);
assert.equal(FRI_MADS_MAX_ARCHIVE_ITEMS, 324, "pagination has a strict archive-record ceiling");

const missingArchivePageLink = await runFriMadsArchiveDiscovery({ fetchImpl: async () => new Response(
  archivePageOne.replace('<a href="https://frihedsbrevet.dk/nyhedsbrev/fri-mads/?paginate=2">Næste</a>', ""),
  { status: 200, headers: { "content-type": "text/html" } }
) });
assert.equal(missingArchivePageLink.status, "source_invalid");
assert.deepEqual(missingArchivePageLink.reasonCodes, ["pagination_terminal_page_ambiguous"]);
assert.equal(missingArchivePageLink.archiveReleases.length, 0, "a missing next-page link cannot silently truncate the archive");

let archiveCall = 0;
const archivePageFailure = await runFriMadsArchiveDiscovery({ fetchImpl: async () => {
  archiveCall += 1;
  return archiveCall === 1
    ? new Response(archivePageOne, { status: 200, headers: { "content-type": "text/html" } })
    : new Response("unavailable", { status: 403, headers: { "content-type": "text/html" } });
} });
assert.equal(archivePageFailure.status, "source_unavailable");
assert.deepEqual(archivePageFailure.reasonCodes, ["source_http_403"]);
assert.equal(archivePageFailure.archiveReleases.length, 0, "a later page failure discards partial archive results");

let requests = [];
const onePageRun = await runFriMadsDiscovery({ fetchImpl: async (url, options) => {
  requests.push({ url, options });
  return new Response(FRI_MADS_OVERVIEW_173_TO_147_HTML, { status: 200, headers: { "content-type": "text/html" } });
} });
assert.equal(onePageRun.status, "new_metadata_discovered");
assert.equal(requests.length, 1, "normal daily discovery reads only the first official overview page");
assert.equal(requests[0].url, FRI_MADS_OVERVIEW_URL);
assert.equal(requests[0].options.method, "GET");
assert.equal(requests[0].options.redirect, "error");

requests = [];
const boundaryRun = await runFriMadsDiscovery({ afterNumber: 120, fetchImpl: async (url, options) => {
  requests.push({ url, options });
  return new Response(url === FRI_MADS_OVERVIEW_URL ? FRI_MADS_OVERVIEW_173_TO_147_HTML : FRI_MADS_OVERVIEW_145_TO_119_HTML, {
    status: 200, headers: { "content-type": "text/html" }
  });
} });
assert.equal(boundaryRun.status, "identity_conflict");
assert.deepEqual(requests.map((request) => request.url), [FRI_MADS_OVERVIEW_URL, FRI_MADS_SECOND_PAGE_URL]);
assert.ok(requests.every((request) => request.options.method === "GET" && request.options.redirect === "error"));

for (const status of [403, 404]) {
  let fetches = 0;
  const unavailable = await runFriMadsDiscovery({ fetchImpl: async () => {
    fetches += 1;
    return new Response("ignored", { status, headers: { "content-type": "text/html" } });
  } });
  assert.equal(unavailable.status, "source_unavailable");
  assert.deepEqual(unavailable.reasonCodes, [`source_http_${status}`]);
  assert.equal(fetches, 1);
}
const timeout = await runFriMadsDiscovery({ fetchImpl: async () => { const error = new Error("private source URL hidden"); error.name = "TimeoutError"; throw error; } });
assert.equal(timeout.status, "source_unavailable");
assert.deepEqual(timeout.reasonCodes, ["source_timeout"]);
assert.equal(JSON.stringify(timeout).includes("private source URL"), false);
const invalidType = await runFriMadsDiscovery({ fetchImpl: async () => new Response("<rss/>", { status: 200, headers: { "content-type": "application/xml" } }) });
assert.deepEqual(invalidType.reasonCodes, ["unexpected_content_type"]);
const networkError = await runFriMadsDiscovery({ fetchImpl: async () => { throw new Error("https://example.invalid/private-route"); } });
assert.deepEqual(networkError.reasonCodes, ["source_request_failed"]);
assert.equal(JSON.stringify(networkError).includes("example.invalid"), false);

let invalidCursorCalls = 0;
const invalidCursor = await runFriMadsDiscovery({ afterNumber: Number.MAX_SAFE_INTEGER + 1, fetchImpl: async () => {
  invalidCursorCalls += 1;
  return new Response(FRI_MADS_OVERVIEW_173_TO_147_HTML, { headers: { "content-type": "text/html" } });
} });
assert.equal(invalidCursor.status, "invalid_cursor");
assert.equal(invalidCursorCalls, 0, "invalid cursors do not request the source");

const catalogue = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const catalogueBefore = structuredClone(catalogue);
const expectedIdentities = new Map(FRIHEDSBREVET_SOURCE_REGISTRY.map((entry) => [entry.podcastId, entry.catalogueId]));
const frihedsbrevetRows = catalogue.rows.filter((row) => expectedIdentities.has(row["Podcast-ID"]));
assert.equal(expectedIdentities.size, 36);
assert.equal(frihedsbrevetRows.length, 36);
for (const row of frihedsbrevetRows) assert.equal(row.catalogue_id, expectedIdentities.get(row["Podcast-ID"]));
const friMadsRow = frihedsbrevetRows.find((row) => row["Podcast-ID"] === FRI_MADS_PODCAST_ID);
assert.equal(friMadsRow.catalogue_id, FRI_MADS_CATALOGUE_ID);
assert.equal(friMadsRow.Link, FRI_MADS_OVERVIEW_URL);
assert.equal(friMadsRow.accessEvidenceUrl, FRI_MADS_HISTORICAL_SOURCE_URL);
assert.equal(friMadsRow.Feed, undefined);
assert.equal(friMadsRow.manualEpisodes, undefined);
assertCatalogueSnapshotIntegrity(catalogue);
assertCatalogueUnchanged(catalogueBefore, catalogue);

const growthProbe = structuredClone(catalogueBefore);
growthProbe.rows.push({ "Podcast-ID": "__synthetic-catalogue-growth__", catalogue_id: "catalogue-test-only" });
assert.equal(growthProbe.rows.length, catalogueBefore.rows.length + 1,
  "catalogue growth is measured against the current input instead of a stale row count");
assertCatalogueSnapshotIntegrity(growthProbe);
assertCatalogueUnchanged(growthProbe, structuredClone(growthProbe));

const duplicateIdProbe = structuredClone(growthProbe);
duplicateIdProbe.rows.push(structuredClone(duplicateIdProbe.rows[0]));
assert.throws(() => assertCatalogueSnapshotIntegrity(duplicateIdProbe), /Podcast-IDs are unique/,
  "duplicate Podcast-IDs remain rejected");

const duplicateCatalogueIdProbe = structuredClone(growthProbe);
duplicateCatalogueIdProbe.rows.push({ "Podcast-ID": "__synthetic-second-growth__", catalogue_id: "catalogue-test-only" });
assert.throws(() => assertCatalogueSnapshotIntegrity(duplicateCatalogueIdProbe), /catalogue_id values are unique/,
  "duplicate catalogue_id values remain rejected");

const shrunkProbe = structuredClone(catalogueBefore);
shrunkProbe.rows = shrunkProbe.rows.slice(0, MIN_CATALOGUE_ROWS - 1);
assert.throws(() => assertCatalogueSnapshotIntegrity(shrunkProbe), /at least the previous 1376 rows/,
  "catalogue shrink below the historical minimum remains rejected");

const mutationProbe = structuredClone(catalogueBefore);
mutationProbe.rows[0].Link = "https://example.invalid/changed-link";
assert.throws(() => assertCatalogueUnchanged(catalogueBefore, mutationProbe), /all catalogue rows and identities/,
  "catalogue link and identity mutations remain prohibited");
assert.equal(FRI_MADS_BASELINE_NUMBER, 172);

console.log("Fri Mads official overview discovery tests passed.");
