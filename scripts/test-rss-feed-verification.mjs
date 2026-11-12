import assert from "node:assert/strict";
import { verifyCatalogueFeeds } from "./verify-rss-feed-catalogue.mjs";
import { fetchPublicHttpsText, verifyRssEvidence } from "./rss-feed-verification.mjs";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { parseFeed, validateExpectedRssIdentity, mapEpisodes, classifyEpisodes, runEpisodeImport } from "../supabase/functions/import-podcast-episodes/core.ts";
import { checkEpisodeFeedCoverage, verifyActiveRssSources } from "./monitor-episode-feed-coverage.mjs";

const row = {
  Titel: "Klar Tale Podcast", Udgiver: "Klar Tale Media", "Podcast-ID": "klar tale podcast",
  catalogue_id: "catalogue-v1-abc123", Link: "https://publisher.example/show/klar-tale",
  Feed: "https://publisher.example/show/klar-tale/rss.xml"
};
const xml = ({ title = row.Titel, owner = row.Udgiver, link = row.Link,
  self = row.Feed, guids = ["episode-a", "episode-b"], episodeTitle = "Samtale om hverdagen", enclosure = "https://cdn.example/audio.mp3" } = {}) =>
  `<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><atom:link rel="self" href="${self}"/><title>${title}</title><link>${link}</link><copyright>${owner}</copyright>${guids.map(guid => `<item><guid>${guid}</guid><title>${episodeTitle}</title><pubDate>Wed, 11 Nov 2026 05:00:00 +0000</pubDate><itunes:duration>600</itunes:duration><enclosure url="${enclosure}" type="audio/mpeg"/></item>`).join("")}</channel></rss>`;
const html = (feed = row.Feed, publisher = row.Udgiver, official = row.Link) =>
  `<html><head><link rel="canonical" href="${official}"><link rel="alternate" type="application/rss+xml" href="${feed}"><script type="application/ld+json">{"publisher":{"@type":"Organization","name":"${publisher}"}}</script></head></html>`;

const verified = verifyRssEvidence(row, xml(), html());
assert.equal(verified.status, "verified", `official page, channel ownership, and RSS identity jointly attest the feed (${verified.reason})`);
assert.equal(verified.unique_guid_count, 2);
for (const [feed, page, reason] of [
  [xml({ link: "https://publisher.example/show/another" }), html(), "rss_channel_link_mismatch"],
  [xml({ self: "https://publisher.example/other.xml" }), html(), "rss_self_link_mismatch"],
  [xml({ owner: "Someone else" }), html(), "rss_publisher_mismatch"],
  [xml({ title: "A different show" }), html(), "rss_channel_title_mismatch"],
  [xml(), html("https://publisher.example/other.xml"), "official_page_feed_link_or_publisher_mismatch"],
  [xml(), html(row.Feed, "Another publisher"), "official_page_feed_link_or_publisher_mismatch"],
  [xml({ guids: ["same", "same"] }), html(), "missing_or_duplicate_guid"],
  [xml({ episodeTitle: "Official trailer" }), html(), "teaser_or_trailer_present"],
  [xml({ enclosure: "" }), html(), "incomplete_or_non_audio_item_present"]
]) assert.equal(verifyRssEvidence(row, feed, page).reason, reason);

const fakeFetch = async url => url === row.Feed ? xml() : html();
const candidate = { rows: [{ ...row }] };
await verifyCatalogueFeeds(candidate, { rows: [] }, { fetchText: fakeFetch });
assert.equal(candidate.rows[0].episodeFeedVerification.status, "verified");
const config = mergeSheetFeedConfigs(candidate).configs.klar_tale_podcast;
assert.equal(config.enabled, true);
assert.equal(config.auto_verified_rss, true);
assert.equal(mergeSheetFeedConfigs(candidate).audit.active_feeds.find(x => x.source === config.source).origin, "auto_verified");
assert.equal(config.expected_rss_channel_link, row.Link);
assert.equal(config.expected_rss_publisher, row.Udgiver);
assert.equal(mergeSheetFeedConfigs(candidate).configs.klar_tale_podcast.source, config.source,
  "repeating the catalogue sync preserves the exact source identity");
const repeated = { rows: [{ ...candidate.rows[0] }] };
let repeatedFetches = 0;
await verifyCatalogueFeeds(repeated, candidate, { fetchText: async url => { repeatedFetches++; return fakeFetch(url); } });
assert.equal(repeatedFetches, 0, "a verified feed is cached across catalogue sync runs");
assert.equal(repeated.rows[0].episodeFeedVerification.status, "verified");
assert.equal(checkEpisodeFeedCoverage(repeated).findings.length, 0,
  "coverage reports the new verified RSS feed as active");
const liveAudit = await verifyActiveRssSources(candidate, { fetchText: fakeFetch, dayIndex: 0 });
assert.deepEqual(liveAudit.findings, [], "existing daily monitor confirms active source identity");
assert.equal(liveAudit.checked_source_count, 1);
const changedLiveFeed = await verifyActiveRssSources(candidate, {
  fetchText: async url => url === row.Feed ? xml({ title: "A different show" }) : html(), dayIndex: 0
});
assert.equal(changedLiveFeed.findings[0].blocking, "source_verification_rss_channel_title_mismatch");
assert.equal(changedLiveFeed.findings[0].required_approval, "human_source_identity_review_required");
const deferredLiveFeed = await verifyActiveRssSources(candidate, { fetchText: fakeFetch, maxChecks: 0, dayIndex: 0 });
assert.equal(deferredLiveFeed.checked_source_count, 0);
assert.equal(deferredLiveFeed.deferred_source_count, 1);

const wrongFeed = { rows: [{ ...row, Feed: "https://publisher.example/changed.xml" }] };
await verifyCatalogueFeeds(wrongFeed, { rows: [] }, { fetchText: async () => xml() });
assert.equal(wrongFeed.rows[0].episodeFeedVerification.status, "review_required");
assert.equal(mergeSheetFeedConfigs(wrongFeed).configs.klar_tale_podcast.enabled, false,
  "changed feed URL cannot reuse proof for the previous source");
const movedExisting = { rows: [{ ...row, Feed: "https://publisher.example/new-feed.xml" }] };
await verifyCatalogueFeeds(movedExisting, { rows: [{ ...row }] }, { fetchText: async () => { throw new Error("changed feed must not be probed for automatic approval"); } });
assert.equal(movedExisting.rows[0].episodeFeedVerification.reason, "feed_change_requires_code_approval");
const reowned = { rows: [{ ...row, "Podcast-ID": "new canonical show" }] };
await verifyCatalogueFeeds(reowned, { rows: [{ ...row }] }, { fetchText: async () => { throw new Error("historically owned URL must not be fetched"); } });
assert.equal(reowned.rows[0].episodeFeedVerification.reason, "historically_owned_feed_url");

const duplicateOwner = { rows: [{ ...row }, { ...row, "Podcast-ID": "another show" }] };
await verifyCatalogueFeeds(duplicateOwner, { rows: [] }, { fetchText: fakeFetch });
assert.equal(duplicateOwner.rows[0].episodeFeedVerification.reason, "feed_owned_by_multiple_catalogue_ids");
assert.equal(duplicateOwner.rows[1].episodeFeedVerification.reason, "feed_owned_by_multiple_catalogue_ids");

for (const unsafe of ["http://publisher.example/feed.xml", "https://127.0.0.1/feed.xml", "https://[::1]/feed.xml", "https://localhost/feed.xml", "https://user:pass@publisher.example/feed.xml"]) {
  await assert.rejects(fetchPublicHttpsText(unsafe), /unsafe_url|private_network_url/u);
}

const special = verifyRssEvidence({ ...row, "Podcast-ID": "112 for parforhold", Udgiver: "Podimo",
  Feed: "https://open.podimo.com/podcast/556dfd00-ae31-49b0-a346-0bf66eb9b0e3" }, xml(), html());
assert.equal(special.reason, "special_source_requires_adapter", "special provider formats do not enter generic RSS verification");

const pinned = { podcast_key: row["Podcast-ID"], source: config.source, feed_url: row.Feed,
  expected_rss_channel_title: row.Titel, expected_rss_channel_link: row.Link,
  expected_rss_self_url: row.Feed, expected_rss_publisher: row.Udgiver, expected_rss_unique_guids: true };
validateExpectedRssIdentity(parseFeed(xml()), pinned);
assert.throws(() => validateExpectedRssIdentity(parseFeed(xml({ link: "https://publisher.example/other" })), pinned), /official URL identity mismatch/u);
assert.throws(() => validateExpectedRssIdentity(parseFeed(xml({ guids: ["same", "same"] })), pinned), /duplicate GUID/u);
const mapped = mapEpisodes(parseFeed(xml()), pinned, "2026-11-11T12:00:00Z");
assert.equal(classifyEpisodes(mapped.episodes, mapped.episodes).skipped_count, 2,
  "same-source repeated GUIDs are idempotent and keep the episode identity");

const manyItems = Array.from({ length: 60 }, (_, index) =>
  '<item><guid>recent-' + index + '</guid><title>Episode ' + index + '</title><pubDate>' +
  new Date(Date.UTC(2026, 0, 1 + index)).toUTCString() +
  '</pubDate><itunes:duration>600</itunes:duration><enclosure url="https://cdn.example/' + index +
  '.mp3" type="audio/mpeg"/></item>').join("");
const bounded = mapEpisodes(parseFeed('<rss><channel><title>' + row.Titel + '</title><link>' + row.Link +
  '</link>' + manyItems + '</channel></rss>'),
  { ...pinned, auto_verified_rss: true }, "2026-11-11T12:00:00Z");
assert.equal(bounded.fetched_count, 60);
assert.equal(bounded.episodes.length, 50, "first auto-verified import is capped to the newest 50 episodes");
assert.equal(bounded.episodes[0].external_guid, "recent-59");

let upserts = 0; let runUpdate;
const conflicting = await runEpisodeImport({
  feedKey: "automatic", feedConfigs: { automatic: { ...config, ...pinned, auto_verified_rss: true } },
  repository: {
    async createImportRun() { return { id: "run-1" }; },
    async loadAutoFeedGuidOwners() { return [{ source: "legacy_source", podcast_key: row["Podcast-ID"], external_guid: "episode-a" }]; },
    async loadExistingEpisodes() { throw new Error("identity collision must stop before existing-row merge"); },
    async upsertEpisodes() { upserts++; },
    async updateImportRun(_id, update) { runUpdate = update; }
  },
  fetchText: async () => xml(),
  now: () => "2026-11-11T12:00:00Z"
});
assert.equal(conflicting.status, "failed");
assert.match(conflicting.error, /historical GUID collision/u);
assert.equal(upserts, 0, "historical GUID collision prevents every episode write");
assert.equal(runUpdate.status, "failed");

console.log("RSS verification, source pinning, and safe automatic activation tests passed.");
