import assert from "node:assert/strict";
import { verifyCatalogueFeeds } from "./verify-rss-feed-catalogue.mjs";
import { fetchPublicHttpsText, verifyRssEvidence, verifyPodimoPublicRssEvidence } from "./rss-feed-verification.mjs";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { parseFeed, validateExpectedRssIdentity, mapEpisodes, classifyEpisodes, runEpisodeImport } from "../supabase/functions/import-podcast-episodes/core.ts";
import { checkEpisodeFeedCoverage, verifyActiveRssSources } from "./monitor-episode-feed-coverage.mjs";
import { runRssDryRun } from "../supabase/functions/import-podcast-episodes/dry-run.ts";

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

const podimoId = "3520dd9b-1787-4183-b091-aaa5ebd74a5b";
const appleId = "6833021858";
const podimoRssUrl = "https://feeds.simplecast.com/JE_rplcf";
const podimoShowUrl = "https://podimo.com/dk/shows/politik-for-viderekomne-med-sos-huxi";
const podimoRow = { Titel: "Politik for viderekomne - med Søs & Huxi", Udgiver: "Podimo",
  Vært: "Søs Marie Serup & Huxi Bach", "Podcast-ID": "politik for viderekomne med søs og huxi",
  catalogue_id: "catalogue-v1-047662a4", Link: podimoShowUrl,
  Feed: `https://open.podimo.com/podcast/${podimoId}` };
const podimoPage = (showId = podimoId) => `<html><head><title>${podimoRow.Titel.replaceAll("&", "&amp;")}</title><link rel="canonical" href="${podimoShowUrl}"></head><script>{"id":"${showId}","isAudiobook":false,"authorName":"Huxi Bach, Søs Marie Serup","title":"${podimoRow.Titel.replaceAll("&", "\\u0026")}"}</script></html>`;
const podimoEpisode = ({ guid, title, date, duration, type }) => `<item><guid isPermaLink="false">${guid}</guid><title>${title}</title><pubDate>${date}</pubDate><itunes:duration>${duration}</itunes:duration><itunes:episodeType>${type}</itunes:episodeType><enclosure length="1000000" type="audio/mpeg" url="https://audio.example/${guid}.mp3"/></item>`;
const podimoXml = (showTitle = podimoRow.Titel, owner = "Podimo Studios", self = podimoRssUrl) =>
  `<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><atom:link rel="self" href="${self}"/><title>${showTitle.replaceAll("&", "&amp;")}</title><link>https://politik-for-viderekomne-med-sos-huxi.simplecast.com</link><itunes:owner><itunes:name>${owner}</itunes:name></itunes:owner>${podimoEpisode({ guid: "6058c15e-31a6-4c64-9f28-db7f732a69fe", title: "EP01: Mos-krigen, 179 medlemmer af eliten og politikernes bedste ven", date: "Fri, 13 Nov 2026 12:44:00 +0000", duration: "00:39:52", type: "full" })}${podimoEpisode({ guid: "931b18bd-0dc8-45a6-8952-17f6c9ed7820", title: "Trailer: Premiere fredag d. 13. november", date: "Tue, 10 Nov 2026 08:59:11 +0000", duration: "00:00:58", type: "trailer" })}</channel></rss>`;
const appleResult = (id = appleId, feed = podimoRssUrl) => ({ wrapperType: "track", kind: "podcast",
  collectionId: Number(id), trackId: Number(id), trackName: podimoRow.Titel, collectionName: podimoRow.Titel,
  artistName: "Huxi Bach, Søs Marie Serup", feedUrl: feed,
  collectionViewUrl: `https://podcasts.apple.com/dk/podcast/politik-for-viderekomne-med-s%C3%B8s-huxi/id${id}?uo=4` });
const appleSearch = { resultCount: 1, results: [appleResult()] };
const appleLookup = { resultCount: 1, results: [appleResult()] };

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

const podimoEvidence = await verifyPodimoPublicRssEvidence(podimoRow, podimoXml(), podimoPage(), appleSearch, appleLookup);
assert.equal(podimoEvidence.status, "verified", `exact Apple mapping and canonical Podimo page verify public RSS (${podimoEvidence.reason})`);
assert.equal(podimoEvidence.feed_url, podimoRssUrl);
assert.equal(podimoEvidence.podimo_show_id, podimoId);
assert.equal(podimoEvidence.apple_collection_id, appleId);
assert.equal(podimoEvidence.unique_guid_count, 2);
assert.equal(podimoEvidence.full_episode_count, 1);
assert.deepEqual(podimoEvidence.trailer_guids, ["931b18bd-0dc8-45a6-8952-17f6c9ed7820"]);
const retryPodimoCandidate = { rows: [{ ...podimoRow, episodeFeedVerification: {
  version: 1, status: "review_required", podcast_id: podimoRow["Podcast-ID"],
  catalogue_id: podimoRow.catalogue_id, feed_url: podimoRow.Feed, official_url: podimoRow.Link,
  publisher: podimoRow.Udgiver, reason: "special_source_requires_adapter"
} }] };
const fetchExactPodimoSource = async url => {
  if (url === podimoRow.Link) return podimoPage();
  if (url.includes("itunes.apple.com/search")) return JSON.stringify(appleSearch);
  if (url.includes("itunes.apple.com/lookup")) return JSON.stringify(appleLookup);
  if (url === podimoRssUrl) return podimoXml();
  throw new Error(`unexpected exact Podimo request: ${url}`);
};
await verifyCatalogueFeeds(retryPodimoCandidate, { rows: [structuredClone(retryPodimoCandidate.rows[0])] },
  { fetchText: fetchExactPodimoSource });
assert.equal(retryPodimoCandidate.rows[0].episodeFeedVerification.status, "verified",
  "a previously review-required Podimo row is rechecked after the verifier gains official Apple evidence");
assert.equal((await verifyPodimoPublicRssEvidence(podimoRow, podimoXml(), podimoPage("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), appleSearch, appleLookup)).reason,
  "podimo_show_id_not_on_canonical_page", "a wrong show UUID cannot inherit the Apple/RSS mapping");
assert.equal((await verifyPodimoPublicRssEvidence(podimoRow, podimoXml(), podimoPage(),
  { results: [appleResult(), appleResult("6833021859")] }, appleLookup)).reason,
  "apple_podcast_mapping_ambiguous", "ambiguous exact Apple matches remain blocked");
assert.equal((await verifyPodimoPublicRssEvidence(podimoRow, podimoXml("Different show"), podimoPage(), appleSearch, appleLookup)).reason,
  "rss_channel_title_mismatch", "the RSS channel must match the exact official show title");
assert.equal((await verifyPodimoPublicRssEvidence(podimoRow, podimoXml(podimoRow.Titel, "Someone else"), podimoPage(), appleSearch, appleLookup)).reason,
  "rss_publisher_not_podimo", "a public URL without a Podimo publisher remains blocked");
assert.equal((await verifyPodimoPublicRssEvidence(podimoRow, podimoXml(), podimoPage(), appleSearch,
  { results: [appleResult(appleId, "https://feeds.example/different.xml")] })).reason,
  "apple_lookup_mapping_mismatch", "the direct Apple lookup must confirm the exact feed URL");

const exactPodimoConfig = mergeSheetFeedConfigs({ rows: [podimoRow] }).configs.podimo_public_rss_politik_for_viderekomne_med_sos_og_huxi;
assert.equal(exactPodimoConfig.enabled, true, "the code-owned mapping enables only the exact Podcast-ID, catalogue ID and show UUID");
assert.equal(exactPodimoConfig.feed_url, podimoRssUrl);
assert.equal(exactPodimoConfig.format, "rss");
const wrongPodimoIdRow = { ...podimoRow, Feed: "https://open.podimo.com/podcast/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const wrongPodimoConfig = mergeSheetFeedConfigs({ rows: [wrongPodimoIdRow] });
assert.equal(wrongPodimoConfig.configs.podimo_public_rss_politik_for_viderekomne_med_sos_og_huxi.enabled, false);
assert.equal(wrongPodimoConfig.audit.feed_warnings.find(item => item.podcast_key === podimoRow["Podcast-ID"])?.reason,
  "podimo_show_id_mismatch", "a wrong Podimo show UUID is rejected by runtime routing");
const blockedPodimoRow = { ...row, Udgiver: "Podimo", Vært: "Host One & Host Two",
  "Podcast-ID": "blocked podimo podcast", catalogue_id: "catalogue-v1-blocked",
  Link: "https://podimo.com/dk/shows/blocked-podimo-podcast",
  Feed: "https://open.podimo.com/podcast/dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  episodeFeedVerification: {
  version: 1, status: "review_required", verification_kind: "apple_podimo_public_rss",
  podcast_id: "blocked podimo podcast", catalogue_id: "catalogue-v1-blocked",
  catalogue_feed_url: "https://open.podimo.com/podcast/dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  feed_url: "https://open.podimo.com/podcast/dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  official_url: "https://podimo.com/dk/shows/blocked-podimo-podcast", publisher: "Podimo",
  reason: "apple_exact_podcast_mapping_not_found"
} };
const blockedPodimoFinding = checkEpisodeFeedCoverage({ rows: [blockedPodimoRow] }).findings[0];
assert.equal(blockedPodimoFinding.cause, "podimo_public_rss_apple_exact_podcast_mapping_not_found");
assert.equal(blockedPodimoFinding.blocking, "source_verification_apple_exact_podcast_mapping_not_found");
assert.equal(blockedPodimoFinding.required_approval, "human_source_identity_review_required",
  "a blocked Podimo source report identifies the exact failed proof and required action");
assert.ok(checkEpisodeFeedCoverage({ rows: [podimoRow] }).findings.every(item => item.podcast_key !== podimoRow["Podcast-ID"]),
  "coverage treats the exact verified RSS route as active");
const podimoMapped = mapEpisodes(parseFeed(podimoXml()), exactPodimoConfig, "2026-11-14T12:00:00Z");
assert.equal(podimoMapped.episodes.find(item => item.external_guid === "6058c15e-31a6-4c64-9f28-db7f732a69fe")?.is_active, true);
assert.equal(podimoMapped.episodes.find(item => item.external_guid === "931b18bd-0dc8-45a6-8952-17f6c9ed7820")?.is_active, false,
  "an explicitly typed 58-second trailer is retained as inactive, never a rateable episode");
assert.equal(podimoMapped.episodes.find(item => item.external_guid === "931b18bd-0dc8-45a6-8952-17f6c9ed7820")?.metadata.episode_type, "trailer");

const newPodimoRow = { ...podimoRow, Titel: "Ny Podimo podcast", Udgiver: "Podimo", Vært: "Host One & Host Two",
  "Podcast-ID": "ny podimo podcast", catalogue_id: "catalogue-v1-newpodimo", Link: "https://podimo.com/dk/shows/ny-podimo-podcast",
  Feed: "https://open.podimo.com/podcast/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
const newPodimoApple = { ...appleResult("7000000001", "https://feeds.simplecast.com/newshow"),
  trackName: newPodimoRow.Titel, collectionName: newPodimoRow.Titel, artistName: "Host Two, Host One",
  collectionViewUrl: "https://podcasts.apple.com/dk/podcast/ny-podimo-podcast/id7000000001" };
const newPodimoSearch = { resultCount: 1, results: [newPodimoApple] };
const newPodimoPage = `<html><head><title>${newPodimoRow.Titel}</title><link rel="canonical" href="${newPodimoRow.Link}"></head><script>{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","authorName":"Host Two, Host One","title":"Ny Podimo podcast"}</script></html>`;
const newPodimoXml = `<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><atom:link rel="self" href="https://feeds.simplecast.com/newshow"/><title>Ny Podimo podcast</title><link>https://ny-podimo-podcast.simplecast.com</link><itunes:owner><itunes:name>Podimo Studios</itunes:name></itunes:owner>${podimoEpisode({ guid: "new-podimo-full", title: "Episode one", date: "Wed, 11 Nov 2026 05:00:00 +0000", duration: "00:30:00", type: "full" })}</channel></rss>`;
const newPodimoLookup = { resultCount: 1, results: [newPodimoApple] };
const newPodimoCandidate = { rows: [{ ...newPodimoRow }] };
const fetchNewPodimoSource = async url => {
  if (url === newPodimoRow.Link) return newPodimoPage;
  if (url.includes("itunes.apple.com/search")) return JSON.stringify(newPodimoSearch);
  if (url.includes("itunes.apple.com/lookup")) return JSON.stringify(newPodimoLookup);
  if (url === newPodimoApple.feedUrl) return newPodimoXml;
  throw new Error(`unexpected source request: ${url}`);
};
await verifyCatalogueFeeds(newPodimoCandidate, { rows: [] }, { fetchText: fetchNewPodimoSource });
assert.equal(newPodimoCandidate.rows[0].episodeFeedVerification.status, "verified");
const newPodimoConfig = mergeSheetFeedConfigs(newPodimoCandidate).configs.podimo_public_rss_ny_podimo_podcast;
assert.equal(newPodimoConfig.enabled, true, "a different public Podimo RSS feed auto-onboards only after exact Apple verification");
assert.equal(newPodimoConfig.feed_url, newPodimoApple.feedUrl);
assert.equal(newPodimoConfig.auto_verified_rss, true);
const liveNewPodimo = await verifyActiveRssSources(newPodimoCandidate, { fetchText: fetchNewPodimoSource, dayIndex: 0 });
assert.deepEqual(liveNewPodimo.findings, [], "the existing feed-coverage monitor rechecks Podimo RSS via pinned Apple lookup");
const conflictedPodimoCandidate = { rows: [newPodimoCandidate.rows[0], {
  ...newPodimoRow, "Podcast-ID": "another canonical podimo show", catalogue_id: "catalogue-v1-other",
  Feed: "https://open.podimo.com/podcast/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  episodeFeedVerification: { ...newPodimoCandidate.rows[0].episodeFeedVerification,
    podcast_id: "another canonical podimo show", catalogue_id: "catalogue-v1-other",
    catalogue_feed_url: "https://open.podimo.com/podcast/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    podimo_show_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }
}] };
assert.equal(mergeSheetFeedConfigs(conflictedPodimoCandidate).configs.podimo_public_rss_another_canonical_podimo_show, undefined,
  "one Apple/RSS identity cannot be claimed by a second Podcast-ID");

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
    async loadAutoFeedIdentityInventory() { return { episodes: [], rated_episode_ids: [], manual_episode_ids: [] }; },
    async loadExistingEpisodes() { throw new Error("identity collision must stop before existing-row merge"); },
    async upsertEpisodes() { upserts++; },
    async updateImportRun(_id, update) { runUpdate = update; }
  },
  fetchText: async () => xml(),
  now: () => "2026-11-11T12:00:00Z"
});
assert.equal(conflicting.status, "failed");
assert.match(conflicting.error, /historical_guid_collision/u);
assert.equal(upserts, 0, "historical GUID collision prevents every episode write");
assert.equal(runUpdate.status, "failed");

const preservedEpisode = { id: "uuid-existing-rated-history", podcast_key: podimoRow["Podcast-ID"],
  source: exactPodimoConfig.source, external_guid: "old-stable-guid", title: "Previously rated full episode",
  is_active: true, metadata: { rateable: true } };
const store = [preservedEpisode];
const ratingLocks = new Set([preservedEpisode.id]);
let idempotentWrites = 0;
const identityRepository = {
  async createImportRun() { return { id: `import-${idempotentWrites}` }; },
  async loadAutoFeedGuidOwners(guids) { return store.filter(item => guids.includes(item.external_guid)); },
  async loadAutoFeedIdentityInventory(podcastKey) {
    const episodes = store.filter(item => item.podcast_key === podcastKey);
    return { episodes, rated_episode_ids: episodes.filter(item => ratingLocks.has(item.id)).map(item => item.id), manual_episode_ids: [] };
  },
  async loadExistingEpisodes(source, guids) { return store.filter(item => item.source === source && guids.includes(item.external_guid)); },
  async upsertEpisodes(incoming) {
    idempotentWrites++;
    for (const episode of incoming) {
      const existing = store.find(item => item.source === episode.source && item.external_guid === episode.external_guid);
      if (existing) Object.assign(existing, episode, { id: existing.id });
      else store.push({ ...episode, id: `uuid-${episode.external_guid}` });
    }
  },
  async updateImportRun() {}
};
const rssImport = () => runEpisodeImport({
  feedKey: "podimo_public_rss_politik_for_viderekomne_med_sos_og_huxi",
  feedConfigs: { podimo_public_rss_politik_for_viderekomne_med_sos_og_huxi: exactPodimoConfig },
  repository: identityRepository, fetchText: async () => podimoXml(), now: () => "2026-11-14T12:00:00Z"
});
const firstImport = await rssImport();
assert.equal(firstImport.status, "success");
assert.equal(store.length, 3, "both source GUIDs import once while the older episode UUID remains present");
assert.equal(store.find(item => item.external_guid === preservedEpisode.external_guid)?.id, preservedEpisode.id);
assert.equal(ratingLocks.has(preservedEpisode.id), true, "a prior rated episode UUID remains untouched");
const importedFull = store.find(item => item.external_guid === "6058c15e-31a6-4c64-9f28-db7f732a69fe");
const importedTrailer = store.find(item => item.external_guid === "931b18bd-0dc8-45a6-8952-17f6c9ed7820");
assert.equal(importedFull.id, "uuid-6058c15e-31a6-4c64-9f28-db7f732a69fe");
assert.equal(importedTrailer.is_active, false);
ratingLocks.add(importedFull.id);
const dryRun = await runRssDryRun(exactPodimoConfig, async () => podimoXml(), "2026-11-14T12:00:00Z",
  { repository: identityRepository, feedConfigs: { podimo_public_rss_politik_for_viderekomne_med_sos_og_huxi: exactPodimoConfig } });
assert.equal(dryRun.status, "success");
assert.equal(dryRun.identity_preflight.rating_locked_episode_count, 1);
assert.equal(dryRun.identity_preflight.historical_rated_episode_count, 2);
assert.equal(dryRun.identity_preflight.preserved_historical_episode_count, 3);
const beforeIdempotentRepeat = new Map(store.map(item => [item.external_guid, item.id]));
const secondImport = await rssImport();
assert.equal(secondImport.status, "success");
assert.equal(store.length, 3, "running the same feed twice does not create duplicates");
assert.deepEqual(new Map(store.map(item => [item.external_guid, item.id])), beforeIdempotentRepeat,
  "the second import preserves every historical episode UUID");
assert.equal(ratingLocks.has(importedFull.id), true, "reimport cannot replace the UUID protected by a user rating");
assert.equal(idempotentWrites, 1, "second identical import is skipped without an upsert");

const oldSourceDryRun = await runRssDryRun(exactPodimoConfig, async () => podimoXml(), "2026-11-14T12:00:00Z", {
  repository: { ...identityRepository,
    async loadAutoFeedGuidOwners() { return []; },
    async loadAutoFeedIdentityInventory() { return { episodes: [{ ...preservedEpisode, source: "old_provider_source" }],
      rated_episode_ids: [preservedEpisode.id], manual_episode_ids: [] }; }
  },
  feedConfigs: { podimo_public_rss_politik_for_viderekomne_med_sos_og_huxi: exactPodimoConfig }
});
assert.equal(oldSourceDryRun.status, "partial");
assert.equal(oldSourceDryRun.identity_preflight.reason, "existing_podcast_episode_source_requires_review");
const manualMappingDryRun = await runRssDryRun(exactPodimoConfig, async () => podimoXml(), "2026-11-14T12:00:00Z", {
  repository: { ...identityRepository,
    async loadAutoFeedGuidOwners() { return []; },
    async loadAutoFeedIdentityInventory() { return { episodes: [{ ...preservedEpisode, external_guid: "old-guid" }],
      rated_episode_ids: [], manual_episode_ids: [preservedEpisode.id] }; }
  },
  feedConfigs: { podimo_public_rss_politik_for_viderekomne_med_sos_og_huxi: exactPodimoConfig }
});
assert.equal(manualMappingDryRun.identity_preflight.reason, "existing_manual_episode_identity_requires_review");
const sourceConflictDryRun = await runRssDryRun(exactPodimoConfig, async () => podimoXml(), "2026-11-14T12:00:00Z", {
  repository: identityRepository, feedConfigs: { exact: exactPodimoConfig, duplicate: { ...exactPodimoConfig, source: "other_source" } }
});
assert.equal(sourceConflictDryRun.identity_preflight.reason, "source_or_feed_url_has_multiple_active_owners");
assert.equal(idempotentWrites, 1, "all dry-run identity checks are read-only");

console.log("RSS verification, source pinning, and safe automatic activation tests passed.");
