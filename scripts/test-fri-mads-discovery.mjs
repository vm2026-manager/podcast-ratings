import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  FRI_MADS_BASELINE_NUMBER,
  FRI_MADS_CATALOGUE_ID,
  FRI_MADS_HISTORICAL_SOURCE_URL,
  FRI_MADS_PODCAST_ID,
  FRI_MADS_PUBLIC_FEED_URL,
  discoverFriMadsArticles,
  runFriMadsDiscovery
} from "./discover-fri-mads-releases.mjs";
import { FRIHEDSBREVET_SOURCE_REGISTRY } from "./audit-frihedsbrevet-sources.mjs";
import { FRI_MADS_172_RSS } from "./fixtures/fri-mads-rss-snapshot.mjs";

function rss(items, channel = "Frihedsbrevet") {
  return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><rss version=\"2.0\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\"><channel><title>" +
    channel + "</title>" + items.join("") + "</channel></rss>";
}

function article({ number = 172, url, title, category = "Fri Mads", guid = "verified-guid-172", date = "Sun, 08 Nov 2026 05:00:00 +0000", author = "Mathias Helmuth", extra = "" } = {}) {
  const articleUrl = url || "https://frihedsbrevet.dk/fri-mads-" + number + "-alle-elsker-mette/";
  const articleTitle = title || "Fri Mads #" + number + ": Alle elsker Mette";
  return "<item><title>" + articleTitle + "</title><link>" + articleUrl + "</link><guid isPermaLink=\"false\">" + guid +
    "</guid>" + (date ? "<pubDate>" + date + "</pubDate>" : "") + "<dc:creator>" + author + "</dc:creator>" +
    "<category>" + category + "</category>" + extra + "</item>";
}

const first = discoverFriMadsArticles(FRI_MADS_172_RSS, { afterNumber: 171 });
assert.equal(first.status, "new_metadata_discovered");
assert.equal(first.dryRun, true);
assert.equal(first.writesPerformed, false);
assert.equal(first.supabaseCalls, 0);
assert.equal(first.sheetWrites, 0);
assert.equal(first.catalogueWrites, 0);
assert.equal(first.episodeImports, 0);
assert.equal(first.articleRequests, 0);
assert.equal(first.sourceFeed, FRI_MADS_PUBLIC_FEED_URL);
assert.equal(first.feedItemCount, 2);
assert.equal(first.candidateCount, 1);
assert.equal(first.releases.length, 1);
const release = first.releases[0];
assert.equal(release.podcastId, FRI_MADS_PODCAST_ID);
assert.equal(release.catalogueId, FRI_MADS_CATALOGUE_ID);
assert.equal(release.releaseNumber, 172);
assert.equal(release.title, "Fri Mads #172: Alle elsker Mette");
assert.equal(release.publishedAt, "2026-11-08T05:00:00.000Z");
assert.equal(release.canonicalUrl, "https://frihedsbrevet.dk/fri-mads-172-alle-elsker-mette/");
assert.equal(release.author, "Mathias Helmuth");
assert.equal(release.accessType, "paid");
assert.equal(release.contentKind, "article");
assert.equal(release.metadataOnly, true);
assert.equal(release.playable, false);
assert.equal(release.rateable, false);
assert.equal(release.audioUrl, null);
assert.equal(release.sourceGuid, null, "the public RSS GUID repeats the site root and is not a release identity");
assert.equal(release.sourceGuidStatus, "not_unique_in_feed");
assert.ok(release.releaseId.includes(release.canonicalUrl));
assert.equal(JSON.stringify(first).includes("Fri Mads article body"), false);
assert.equal(JSON.stringify(first).includes("<description"), false);

const defaultCursor = discoverFriMadsArticles(FRI_MADS_172_RSS);
assert.equal(defaultCursor.status, "no_new_releases", "the existing #172 baseline is not backfilled");
assert.deepEqual(defaultCursor.releases, []);

const noDate = discoverFriMadsArticles(rss([article({ date: "" })]), { afterNumber: 171 });
assert.equal(noDate.releases[0].publishedAt, null, "missing publication dates are not invented");

const changedTitle = discoverFriMadsArticles(rss([article({ title: "Fri Mads #172: Ny redaktionel titel" })]), { afterNumber: 171 });
assert.equal(changedTitle.releases[0].releaseId, release.releaseId, "release identity is based on exact number and canonical URL, not title");

const unrelatedNewsletter = discoverFriMadsArticles(rss([
  article({ number: 8, category: "Fri Ukraine", title: "Fri Ukraine #8: Example", url: "https://frihedsbrevet.dk/fri-ukraine-8-example/" })
]), { afterNumber: 7 });
assert.equal(unrelatedNewsletter.status, "series_absent_from_feed_window");
assert.deepEqual(unrelatedNewsletter.releases, []);

const missingSeriesCategory = discoverFriMadsArticles(rss([article({ category: "Nyheder" })]), { afterNumber: 171 });
assert.equal(missingSeriesCategory.status, "identity_conflict");
assert.deepEqual(missingSeriesCategory.reasonCodes, ["series_marker_mismatch"]);

const wrongHost = discoverFriMadsArticles(rss([article({ url: "https://example.org/fri-mads-172-alle-elsker-mette/" })]), { afterNumber: 171 });
assert.equal(wrongHost.status, "identity_conflict");
assert.ok(wrongHost.reasonCodes.includes("untrusted_or_invalid_permalink"));

const wrongPermalink = discoverFriMadsArticles(rss([article({ url: "https://frihedsbrevet.dk/fri-mads-171-alle-elsker-mette/" })]), { afterNumber: 171 });
assert.equal(wrongPermalink.status, "identity_conflict");
assert.ok(wrongPermalink.reasonCodes.includes("number_permalink_conflict"));

const duplicateNumber = discoverFriMadsArticles(rss([
  article({ guid: "guid-one" }),
  article({ url: "https://frihedsbrevet.dk/fri-mads-172-duplicate-copy/", guid: "guid-two" })
]), { afterNumber: 171 });
assert.equal(duplicateNumber.status, "identity_conflict");
assert.ok(duplicateNumber.reasonCodes.includes("duplicate_release_number"));
assert.deepEqual(duplicateNumber.releases, [], "identity conflicts fail closed without partial discoveries");

const duplicateUrl = discoverFriMadsArticles(rss([
  article({ guid: "guid-one" }), article({ guid: "guid-two" })
]), { afterNumber: 171 });
assert.equal(duplicateUrl.status, "identity_conflict");
assert.ok(duplicateUrl.reasonCodes.includes("duplicate_release_number"));
assert.ok(duplicateUrl.reasonCodes.includes("duplicate_permalink"));

const mismatchedNumber = discoverFriMadsArticles(rss([
  article({ number: 173, url: "https://frihedsbrevet.dk/fri-mads-172-alle-elsker-mette/" })
]), { afterNumber: 171 });
assert.equal(mismatchedNumber.status, "identity_conflict");
assert.ok(mismatchedNumber.reasonCodes.includes("number_permalink_conflict"));

const historicalNumberConflict = discoverFriMadsArticles(rss([
  article({ number: 140, url: "https://frihedsbrevet.dk/fri-mads-140-en-anden-artikel/" })
]), { afterNumber: 139 });
assert.equal(historicalNumberConflict.status, "identity_conflict");
assert.ok(historicalNumberConflict.reasonCodes.includes("historical_source_conflict"));

const historicalUrlConflict = discoverFriMadsArticles(rss([
  article({ number: 141, url: FRI_MADS_HISTORICAL_SOURCE_URL })
]), { afterNumber: 140 });
assert.equal(historicalUrlConflict.status, "identity_conflict");
assert.ok(historicalUrlConflict.reasonCodes.includes("historical_source_conflict"));

const duplicateGuid = discoverFriMadsArticles(rss([
  article({ number: 172, guid: "shared-source-guid" }),
  article({ number: 173, guid: "shared-source-guid", url: "https://frihedsbrevet.dk/fri-mads-173-et-nyt-afsnit/" })
]), { afterNumber: 171 });
assert.equal(duplicateGuid.status, "new_metadata_discovered");
assert.equal(duplicateGuid.releases.length, 2, "unique URLs/numbers remain distinct when RSS repeats one GUID");
assert.ok(duplicateGuid.releases.every((item) => item.sourceGuid === null && item.sourceGuidStatus === "not_unique_in_feed"));
assert.equal(new Set(duplicateGuid.releases.map((item) => item.releaseId)).size, 2);

const numberGap = discoverFriMadsArticles(rss([
  article({ number: 172 }),
  article({ number: 174, url: "https://frihedsbrevet.dk/fri-mads-174-et-nyt-afsnit/" })
]), { afterNumber: 172 });
assert.equal(numberGap.status, "identity_conflict", "an unseen release number stops discovery rather than silently skipping it");
assert.ok(numberGap.reasonCodes.includes("release_number_gap"));
assert.deepEqual(numberGap.releases, []);

const emptyFeed = discoverFriMadsArticles(rss([]));
assert.equal(emptyFeed.status, "empty_feed");
assert.deepEqual(emptyFeed.releases, []);

const wrongChannel = discoverFriMadsArticles(rss([article()], "Andet nyhedsbrev"), { afterNumber: 171 });
assert.equal(wrongChannel.status, "identity_conflict");
assert.ok(wrongChannel.reasonCodes.includes("wrong_channel_identity"));

const teaser = discoverFriMadsArticles(rss([article({ number: 173, title: "Fri Mads #173: Teaser" })]), { afterNumber: 172 });
assert.equal(teaser.status, "no_eligible_releases");
assert.deepEqual(teaser.releases, []);
assert.ok(teaser.reasonCodes.includes("teaser_or_trailer"));

const explicitTrailer = discoverFriMadsArticles(rss([article({
  number: 173,
  title: "Fri Mads #173: Preview",
  extra: "<itunes:episodeType>trailer</itunes:episodeType>"
})]), { afterNumber: 172 });
assert.equal(explicitTrailer.status, "no_eligible_releases");
assert.deepEqual(explicitTrailer.releases, []);

const audioNeedsReview = discoverFriMadsArticles(rss([article({
  number: 173,
  extra: "<enclosure url=\"https://cdn.example.test/audio.mp3\" type=\"audio/mpeg\" length=\"10\"/>"
})]), { afterNumber: 172 });
assert.equal(audioNeedsReview.status, "no_eligible_releases");
assert.ok(audioNeedsReview.reasonCodes.includes("audio_requires_separate_review"));
assert.deepEqual(audioNeedsReview.releases, [], "a detected enclosure is never imported as sound automatically");

const syntheticToken = ["eyJsyntheticpayload", "segmenttwo", "segmentthree"].join(".");
const withBodySentinel = rss([article({
  extra: "<description><![CDATA[Fri Mads article body; " + syntheticToken + "]]></description>"
})]);
const bodyFiltered = discoverFriMadsArticles(withBodySentinel, { afterNumber: 171 });
assert.equal(JSON.stringify(bodyFiltered).includes("Fri Mads article body"), false);
assert.equal(JSON.stringify(bodyFiltered).includes(syntheticToken), false);

const corruptXml = discoverFriMadsArticles("<?xml version=\"1.0\"?><rss><channel><item></rss>");
assert.equal(corruptXml.status, "source_invalid");
assert.deepEqual(corruptXml.reasonCodes, ["invalid_xml"]);

assert.equal(discoverFriMadsArticles(FRI_MADS_172_RSS, { afterNumber: -1 }).status, "invalid_cursor");
let invalidCursorRequests = 0;
const invalidCursorRun = await runFriMadsDiscovery({ afterNumber: Number.MAX_SAFE_INTEGER + 1, fetchImpl: async () => {
  invalidCursorRequests += 1;
  return new Response(FRI_MADS_172_RSS);
} });
assert.equal(invalidCursorRun.status, "invalid_cursor");
assert.equal(invalidCursorRequests, 0, "invalid cursors do not spend a source request");

const fetchCalls = [];
const fetchSuccess = async (url, options) => {
  fetchCalls.push({ url, options });
  return new Response(FRI_MADS_172_RSS, { status: 200, headers: { "content-type": "application/rss+xml" } });
};
const runOne = await runFriMadsDiscovery({ fetchImpl: fetchSuccess, afterNumber: 171 });
const runTwo = await runFriMadsDiscovery({ fetchImpl: fetchSuccess, afterNumber: 171 });
assert.deepEqual(runOne, runTwo, "repeated dry-run with the same source and cursor is deterministic/idempotent");
assert.equal(fetchCalls.length, 2);
assert.ok(fetchCalls.every((call) => call.url === FRI_MADS_PUBLIC_FEED_URL));
assert.ok(fetchCalls.every((call) => call.options.method === "GET" && call.options.redirect === "error"));
assert.equal(runOne.articleRequests, 0, "the adapter never fetches linked article pages");

for (const status of [403, 404]) {
  const unavailable = await runFriMadsDiscovery({ fetchImpl: async () => new Response("ignored", { status }) });
  assert.equal(unavailable.status, "source_unavailable");
  assert.deepEqual(unavailable.reasonCodes, ["source_http_" + status]);
  assert.deepEqual(unavailable.releases, []);
}

const timeout = await runFriMadsDiscovery({ fetchImpl: async () => { const error = new Error("private URL omitted"); error.name = "TimeoutError"; throw error; } });
assert.equal(timeout.status, "source_unavailable");
assert.deepEqual(timeout.reasonCodes, ["source_timeout"]);
assert.equal(JSON.stringify(timeout).includes("private URL"), false);

const networkError = await runFriMadsDiscovery({ fetchImpl: async () => { throw new Error("https://example.invalid/?" + "token=" + "synthetic"); } });
assert.equal(networkError.status, "source_unavailable");
assert.deepEqual(networkError.reasonCodes, ["source_request_failed"]);
assert.equal(JSON.stringify(networkError).includes("synthetic"), false);

const oversize = await runFriMadsDiscovery({ fetchImpl: async () => new Response("x".repeat(262145), { status: 200 }) });
assert.equal(oversize.status, "source_unavailable");
assert.deepEqual(oversize.reasonCodes, ["response_too_large"]);

const catalogue = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const catalogueBefore = structuredClone(catalogue);
const expectedIdentities = new Map(FRIHEDSBREVET_SOURCE_REGISTRY.map((entry) => [entry.podcastId, entry.catalogueId]));
const frihedsbrevetRows = catalogue.rows.filter((row) => expectedIdentities.has(row["Podcast-ID"]));
assert.equal(expectedIdentities.size, 36);
assert.equal(frihedsbrevetRows.length, 36);
for (const row of frihedsbrevetRows) assert.equal(row.catalogue_id, expectedIdentities.get(row["Podcast-ID"]));
const friMadsRow = frihedsbrevetRows.find((row) => row["Podcast-ID"] === "fri mads");
assert.equal(friMadsRow.Link, "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/");
assert.equal(friMadsRow.accessEvidenceUrl, FRI_MADS_HISTORICAL_SOURCE_URL);
assert.equal(friMadsRow.Feed, undefined);
assert.equal(friMadsRow.manualEpisodes, undefined);
assert.equal(catalogue.rows.length, 1373);
assert.deepEqual(catalogue, catalogueBefore, "discovery does not mutate catalogue identities or rows");
assert.equal(FRI_MADS_BASELINE_NUMBER, 172);

console.log("Fri Mads metadata-only discovery tests passed.");
