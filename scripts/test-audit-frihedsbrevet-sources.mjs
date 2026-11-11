import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  FRIHEDSBREVET_SOURCE_REGISTRY,
  auditFrihedsbrevetCatalogue,
  classifyFeedEvidence,
  classifyRssItem,
  parseRssEvidence,
  summarizeFeedEvidence,
  validateFeedAssignments,
  validateSourceRegistry,
  verifyFrihedsbrevetSources
} from "./audit-frihedsbrevet-sources.mjs";
import { FRIHEDSBREVET_EDITORIAL_MASTER_SNAPSHOT } from "./fixtures/frihedsbrevet-editorial-master-snapshot.mjs";
import {
  FRIIS_DIPLOMATPOST_RSS,
  I_KRIG_MED_HA_RSS,
  MALFORMED_RSS,
  PET_EMPTY_CANDIDATE_RSS
} from "./fixtures/frihedsbrevet-rss-snapshots.mjs";

const catalogue = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const before = structuredClone(catalogue);
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

const report = auditFrihedsbrevetCatalogue(deepFreeze(catalogue));
assert.equal(report.dryRun, true);
assert.equal(report.writesPerformed, false);
assert.equal(report.supabaseCalls, 0);
assert.equal(report.expectedRows, 36);
assert.equal(report.matchedRows, 36);
assert.equal(report.editorialSnapshotRows, 36);
assert.equal(report.catalogFieldMismatchCount, 0, "latest main matches the audited editorial master fields");
assert.deepEqual(report.unexpectedRows, []);
assert.deepEqual(catalogue, before, "audit must not mutate the catalogue JSON");
assert.deepEqual(auditFrihedsbrevetCatalogue(catalogue), report, "second run is deterministic and idempotent");

const currentById = new Map(catalogue.rows.map((row) => [row["Podcast-ID"], row]));
for (const expected of FRIHEDSBREVET_SOURCE_REGISTRY) {
  const row = currentById.get(expected.podcastId);
  assert.ok(row, `preserved Podcast-ID: ${expected.podcastId}`);
  assert.equal(row.Titel, expected.title, `preserved title: ${expected.podcastId}`);
  assert.equal(row.catalogue_id, expected.catalogueId, `preserved catalogue UUID: ${expected.podcastId}`);
}
assert.equal(new Set(FRIHEDSBREVET_SOURCE_REGISTRY.map((entry) => entry.podcastId)).size, 36);
assert.equal(new Set(FRIHEDSBREVET_SOURCE_REGISTRY.map((entry) => entry.catalogueId)).size, 36);
assert.ok(currentById.has("huset færch sæson 1"));
assert.ok(currentById.has("huset færch sæson 2"));
assert.notEqual(currentById.get("huset færch sæson 1").catalogue_id, currentById.get("huset færch sæson 2").catalogue_id);

const friMads = report.records.find((entry) => entry.podcastId === "fri mads");
assert.equal(friMads.sourceKind, "article");
assert.equal(friMads.approvedLink, "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/");
assert.equal(friMads.catalogueLink, "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/");
assert.equal(friMads.linkMismatch, false);
assert.deepEqual(friMads.catalogFieldMismatches, []);
assert.equal(friMads.editorialMaster.link, "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/");
assert.equal(friMads.editorialMaster.source, "https://frihedsbrevet.dk/fri-mads-140-verden-af-i-gaar/");
assert.equal(currentById.get("fri mads").accessEvidenceUrl, friMads.editorialMaster.source, "article #140 source history remains intact");
assert.equal(friMads.editorialMaster.series, "");
assert.equal(friMads.editorialMaster.access, "Delvist");
assert.equal(friMads.importAllowed, false, "article source cannot create rateable audio episodes");
assert.equal(report.records.find((entry) => entry.podcastId === "noter fra bruxelles").sourceKind, "article");
assert.equal(report.records.find((entry) => entry.podcastId === "hashpladeforbandelsen").importAllowed, false, "paid source fails closed");
assert.equal(report.records.find((entry) => entry.podcastId === "frihedsbrevets intranet").sourceStatus, "unresolved");

const ha = parseRssEvidence(I_KRIG_MED_HA_RSS, { expectedChannelTitle: "I krig med HA" });
assert.equal(ha.channelMatches, true);
assert.equal(ha.itemCount, 4);
assert.equal(ha.sampleGuid, "76138e02-3d02-4cf7-93ac-b3bc00dcdc16");
assert.equal(summarizeFeedEvidence(ha).verifiedGuids.length, 4, "the audit retains exact item GUID evidence");
assert.deepEqual(summarizeFeedEvidence(ha).classifications, {
  full_public_episode: 0, trailer: 4, paywalled: 0, unresolved: 0
});
assert.equal(classifyFeedEvidence(ha, { expectedChannelTitle: "I krig med PET" }), "wrong_feed");

const friis = parseRssEvidence(FRIIS_DIPLOMATPOST_RSS, { expectedChannelTitle: "Friis' diplomatpost" });
assert.equal(friis.itemCount, 3);
assert.equal(friis.sampleGuid, "52f9b062-feef-45b7-8555-b4f900ebb261");
assert.equal(summarizeFeedEvidence(friis).classifications.trailer, 3);

const emptyPetCandidate = parseRssEvidence(PET_EMPTY_CANDIDATE_RSS, { expectedChannelTitle: "I krig med PET" });
assert.equal(emptyPetCandidate.itemCount, 0);
assert.equal(classifyFeedEvidence(emptyPetCandidate, { expectedChannelTitle: "I krig med PET" }), "empty_feed");
assert.throws(() => parseRssEvidence(MALFORMED_RSS), /complete RSS XML document|malformed/u);
assert.throws(() => parseRssEvidence('<?xml version="1.0"?><rss><channel><title>Broken</channel></rss>'), /mismatched/u);

assert.equal(classifyRssItem({ title: "E6. En stat i staten – Teaser", guid: "g1", episodeType: "full", hasEnclosure: true }), "trailer");
assert.equal(classifyRssItem({ title: "Confirmed full item", guid: "g2", episodeType: "full", hasAudioEnclosure: true }), "full_public_episode");
assert.equal(classifyRssItem({ title: "Confirmed full item", guid: "g2", episodeType: "full", hasAudioEnclosure: true }, { access: "paid" }), "paywalled");
assert.equal(classifyRssItem({ title: "Unidentified item", guid: "", episodeType: "", hasAudioEnclosure: true }), "unresolved");
const sparseFeed = parseRssEvidence('<?xml version="1.0"?><rss version="2.0"><channel><title>Sparse</title><item><title>Undated entry</title><guid>stable-guid</guid></item></channel></rss>');
assert.equal(sparseFeed.items[0].publishedAt, "", "missing publication date stays empty");
assert.equal(sparseFeed.items[0].hasEnclosure, false, "missing image/audio metadata is not fabricated");
assert.equal(sparseFeed.items[0].classification, "unresolved");
assert.equal(classifyFeedEvidence(null), "unavailable", "missing source evidence fails closed");

const encodedText = parseRssEvidence('<?xml version="1.0"?><rss><channel><title>Literal &amp;lt;tag&amp;gt; &amp; &#38;</title><item><title><![CDATA[A &amp; B]]></title><guid>xml-entity-guid</guid></item></channel></rss>');
assert.equal(encodedText.channelTitle, "Literal &lt;tag&gt; & &", "XML entities decode once rather than recursively");
assert.equal(encodedText.items[0].title, "A &amp; B", "CDATA text is not entity-decoded");

const audioEnclosureFeed = parseRssEvidence('<?xml version="1.0"?><rss><channel><title>Audio</title><item><title>Full audio</title><guid>audio-guid</guid><itunes:episodeType>full</itunes:episodeType><enclosure url="https://cdn.example.test/episode.mp3" length="10" type="audio/mpeg"/></item></channel></rss>');
assert.equal(audioEnclosureFeed.items[0].hasAudioEnclosure, true);
assert.equal(audioEnclosureFeed.items[0].classification, "full_public_episode");
const imageEnclosureFeed = parseRssEvidence('<?xml version="1.0"?><rss><channel><title>Image</title><item><title>Not audio</title><guid>image-guid</guid><itunes:episodeType>full</itunes:episodeType><enclosure url="https://cdn.example.test/cover.jpg" length="10" type="image/jpeg"/></item></channel></rss>');
assert.equal(imageEnclosureFeed.items[0].hasEnclosure, true);
assert.equal(imageEnclosureFeed.items[0].hasAudioEnclosure, false);
assert.equal(imageEnclosureFeed.items[0].classification, "unresolved", "a non-audio enclosure cannot create a full episode classification");

const duplicateFeeds = validateFeedAssignments([
  { podcastId: "one", appleId: "111", feedUrl: "https://www.omnycontent.com/a/podcast.rss" },
  { podcastId: "two", appleId: "222", feedUrl: "https://www.omnycontent.com/a/podcast.rss" }
]);
assert.equal(duplicateFeeds.valid, false);
assert.equal(duplicateFeeds.duplicateFeeds.length, 1, "unrelated podcast identities cannot share a feed silently");
assert.equal(validateFeedAssignments([
  { podcastId: "huset færch sæson 1", appleId: "1700144386", sharedIdentity: "huset-faerch-seasons", feedUrl: "https://www.omnycontent.com/a/podcast.rss" },
  { podcastId: "huset færch sæson 2", appleId: "1700144386", sharedIdentity: "huset-faerch-seasons", feedUrl: "https://www.omnycontent.com/a/podcast.rss" }
]).valid, true, "two existing season identities may point to one exact Apple show");
assert.throws(() => validateFeedAssignments([{ feedUrl: "https://example.com/not-omny.rss" }]), /Untrusted RSS source URL/u);
assert.throws(() => validateSourceRegistry([...FRIHEDSBREVET_SOURCE_REGISTRY, {
  ...FRIHEDSBREVET_SOURCE_REGISTRY[0], podcastId: "wrong-id", catalogueId: "wrong-catalogue-id"
}]), /assigned to unrelated catalogue IDs/u);

const tokenLikeValue = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({ sub: "synthetic-test" })).toString("base64url"),
  "syntheticSignatureSegmentForTest"
].join(".");
const tokenLikeFeedUrl = `https://www.omnycontent.com/private/${tokenLikeValue}/podcast.rss`;
const sensitiveDuplicateFeeds = validateFeedAssignments([
  { podcastId: "private-one", appleId: "111", feedUrl: tokenLikeFeedUrl },
  { podcastId: "private-two", appleId: "222", feedUrl: tokenLikeFeedUrl }
]);
assert.equal(sensitiveDuplicateFeeds.duplicateFeeds[0].feedUrl, null);
assert.equal(sensitiveDuplicateFeeds.duplicateFeeds[0].feedUrlWithheld, true);
assert.equal(JSON.stringify(sensitiveDuplicateFeeds).includes(tokenLikeValue), false, "potential feed credentials never enter audit output");

const friMadsExpected = FRIHEDSBREVET_SOURCE_REGISTRY.find((entry) => entry.podcastId === "fri mads");
const friMadsEditorial = FRIHEDSBREVET_EDITORIAL_MASTER_SNAPSHOT.find((entry) => entry.podcastId === "fri mads");
const sensitiveCatalogueReport = auditFrihedsbrevetCatalogue({ rows: [{
  Titel: friMadsExpected.title,
  Udgiver: "Frihedsbrevet",
  "Podcast-ID": friMadsExpected.podcastId,
  catalogue_id: friMadsExpected.catalogueId,
  Link: friMadsEditorial.link,
  Feed: tokenLikeFeedUrl
}] }, { registry: [friMadsExpected], editorialSnapshot: [{ ...friMadsEditorial, feed: tokenLikeFeedUrl }] });
assert.equal(sensitiveCatalogueReport.records[0].feed, "");
assert.equal(sensitiveCatalogueReport.records[0].editorialMaster.feed, null);
assert.equal(sensitiveCatalogueReport.records[0].sensitiveUrlsWithheld, true);
assert.equal(JSON.stringify(sensitiveCatalogueReport).includes(tokenLikeValue), false, "catalogue output withholds token-like URLs");

const titleOnlySubstitute = {
  rows: [{ Titel: "Fri Mads", Udgiver: "Frihedsbrevet", "Podcast-ID": "new guessed id", catalogue_id: "new-uuid", Link: "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/" }]
};
const exactIdentityAudit = auditFrihedsbrevetCatalogue(titleOnlySubstitute, {
  registry: [FRIHEDSBREVET_SOURCE_REGISTRY.find((entry) => entry.podcastId === "fri mads")],
  editorialSnapshot: FRIHEDSBREVET_EDITORIAL_MASTER_SNAPSHOT.filter((entry) => entry.podcastId === "fri mads")
});
assert.equal(exactIdentityAudit.matchedRows, 0, "same title never substitutes for an exact Podcast-ID");
assert.equal(exactIdentityAudit.records[0].identityStatus, "missing_catalogue_id");

assert.throws(() => auditFrihedsbrevetCatalogue({ rows: {} }), /actual \{ rows: \[\.\.\.\] \} structure/u);

let unavailableRequests = 0;
const unavailable = await verifyFrihedsbrevetSources({
  fetchImpl: async () => { unavailableRequests += 1; return new Response("blocked", { status: 503 }); },
  registry: [FRIHEDSBREVET_SOURCE_REGISTRY.find((entry) => entry.podcastId === "doctor no")]
});
assert.equal(unavailable.writesPerformed, false);
assert.equal(unavailable.supabaseCalls, 0);
assert.equal(unavailable.htmlRequests, 0);
assert.equal(unavailable.records[0].status, "unavailable");
assert.ok(unavailableRequests >= 1 && unavailableRequests <= 2, "failure handling keeps requests bounded");

const sensitiveSourceReport = await verifyFrihedsbrevetSources({
  fetchImpl: async () => { throw new Error(`blocked feed ${tokenLikeFeedUrl}`); },
  registry: [{
    podcastId: "private-source", title: "Private source", catalogueId: "catalogue-v1-private", access: "partial",
    appleId: "123", appleTitle: "Private source", artist: "Frihedsbrevet", candidateFeedUrl: tokenLikeFeedUrl,
    sourceStatus: "candidate"
  }]
});
assert.equal(sensitiveSourceReport.records[0].feedUrl, null);
assert.equal(sensitiveSourceReport.records[0].feedUrlWithheld, true);
assert.equal(JSON.stringify(sensitiveSourceReport).includes(tokenLikeValue), false, "live error output withholds token-like URLs");
console.log("Frihedsbrevet source audit tests passed (36 exact IDs, no writes, no fuzzy identity matching).");
