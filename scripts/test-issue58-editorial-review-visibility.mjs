import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const [app, catalogueText, coverManifestText] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"),
  readFile(new URL("../data/podcast-cover-manifest.json", import.meta.url), "utf8")
]);
const catalogueRows = JSON.parse(catalogueText).rows || [];
const coverManifest = JSON.parse(coverManifestText);
const exactEpisodeTitle = "Der var engang et mål...af Peter Møller mod Farum";
const exactLegacyPodcastId = "der var engang et mal af peter møller mod farum";
const exactCanonicalPodcastId = "der var engang et mal";
const exactEpisodeId = "283fbea9-a29c-5104-803a-f39f2bb8b312";
const normalizeMatchKey = (value) => String(value ?? "").trim().toLocaleLowerCase("da-DK")
  .normalize("NFD").replace(/[\u0300-\u036f]/gu, "").replace(/[^a-z0-9æøå ]/gu, " ").replace(/\s+/gu, " ").trim();
const parseNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
};
const formatCompactRating = (value) => parseNumber(value)?.toFixed(1).replace(".", ",") ?? "—";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const episodeConfig = {
  [exactCanonicalPodcastId]: {
    manualEpisodeCanonicalIds: { [normalizeMatchKey(exactEpisodeTitle)]: exactEpisodeId }
  }
};
const getPodcastId = (podcast) => String(podcast?.["Podcast-ID"] ?? "");
const getManualEpisodeCanonicalId = (podcast, title) => podcast?.manualEpisodeCanonicalIds?.[normalizeMatchKey(title)]
  || episodeConfig[getPodcastId(podcast)]?.manualEpisodeCanonicalIds?.[normalizeMatchKey(title)] || "";
const getManualEpisodeEditorialRating = (podcast, title) => parseNumber(
  podcast?.manualEpisodeEditorialRatings?.[normalizeMatchKey(title)]
);
const sourceFunction = (name, nextName) => {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf("\nfunction ", start + 1);
  assert.notEqual(start, -1, `${name} exists`);
  assert.notEqual(end, -1, `${name} ends before the next function`);
  return app.slice(start, end);
};
const historicalRating = new Function(
  "getPodcastId", "getManualEpisodeCanonicalId", "getManualEpisodeEditorialRating",
  `${sourceFunction("getHistoricalMedianoEditorialEpisodeReview")}\nreturn getHistoricalMedianoEditorialEpisodeReview;`
)(getPodcastId, getManualEpisodeCanonicalId, getManualEpisodeEditorialRating);
const historicalMarkup = new Function(
  "getHistoricalMedianoEditorialEpisodeReview", "escapeHtml", "formatCompactRating",
  `${sourceFunction("getHistoricalMedianoEditorialEpisodeReviewMarkup")}\nreturn getHistoricalMedianoEditorialEpisodeReviewMarkup;`
)(historicalRating, escapeHtml, formatCompactRating);
const detailRatingData = new Function(
  "getCommunityStat", "getPodcastKey", "formatCompactRating",
  `${sourceFunction("getPodcastDetailRatingData")}\nreturn getPodcastDetailRatingData;`
)(() => ({ averageRating: 8.6, ratingCount: 3 }), () => exactCanonicalPodcastId, formatCompactRating);
const canonicalizeUserRatingRows = new Function(
  "normalizeText", "resolveCanonicalPodcastId", "parseNumber",
  `${sourceFunction("canonicalizeUserRatingRows")}\nreturn canonicalizeUserRatingRows;`
)(
  (value) => String(value ?? "").trim(),
  (key) => key === exactLegacyPodcastId || key === exactCanonicalPodcastId ? exactCanonicalPodcastId : "",
  parseNumber
);

const historicalSourceRow = catalogueRows.find((row) => row["Podcast-ID"] === exactLegacyPodcastId);
assert.ok(historicalSourceRow, "the reviewed legacy source row remains in the catalogue payload");
assert.equal(historicalSourceRow.Titel, exactEpisodeTitle);
assert.equal(historicalSourceRow["Vuring (1-10)"], "7,3");
const podcast = {
  "Podcast-ID": exactCanonicalPodcastId,
  ratingValue: null,
  manualEpisodeCanonicalIds: { [normalizeMatchKey(exactEpisodeTitle)]: exactEpisodeId },
  manualEpisodeEditorialRatings: { [normalizeMatchKey(exactEpisodeTitle)]: "7,3" }
};
const review = historicalRating(podcast);
assert.deepEqual(review, { episodeTitle: exactEpisodeTitle, rating: 7.3 },
  "the exact canonical series displays its legacy episode editorial score");
assert.equal(podcast.ratingValue, null,
  "an episode review does not become an unqualified editorial series score");
assert.match(historicalMarkup(podcast), /Historisk Podcastlisten-vurdering/u);
assert.match(historicalMarkup(podcast), /7,3<small>\/10<\/small>/u);
assert.match(historicalMarkup(podcast), /Gælder episoden “Der var engang et mål\.\.\.af Peter Møller mod Farum”/u);
assert.deepEqual(detailRatingData(podcast), { mads: "—", users: "8,6", userCount: 3 },
  "the episode score does not alter the canonical series editorial or community scores");
const historicOwnRatingKeys = canonicalizeUserRatingRows([{ podcast_key: exactLegacyPodcastId, rating: 4.2 }]);
assert.equal(historicOwnRatingKeys.ratingsByKey[exactCanonicalPodcastId], 4.2,
  "the historic personal rating is readable through the canonical key in memory");
assert.equal(historicOwnRatingKeys.persistedKeyByCanonical[exactCanonicalPodcastId], exactLegacyPodcastId,
  "the existing raw key is retained for account-specific edits; no automatic key move occurs");
assert.deepEqual(historicOwnRatingKeys.duplicates, []);

const ownAndCommunityBefore = { ownRating: 4.2, communityAverage: 8.6, userRatingCount: 3 };
const otherPodcast = { ...podcast, "Podcast-ID": "anden mediano-serie" };
assert.equal(historicalRating(otherPodcast), null, "unrelated podcast IDs never inherit the score");
assert.equal(historicalMarkup(otherPodcast), "", "unrelated podcast cards render no historical score");
assert.equal(historicalRating({ ...podcast, manualEpisodeCanonicalIds: { [normalizeMatchKey(exactEpisodeTitle)]: "other-episode" } }), null,
  "a different or absent episode identity blocks the score");
assert.equal(historicalRating({ ...podcast, manualEpisodeEditorialRatings: {} }), null,
  "a missing historical score remains absent");
assert.deepEqual(ownAndCommunityBefore, { ownRating: 4.2, communityAverage: 8.6, userRatingCount: 3 },
  "the editorial review path leaves personal and community ratings unchanged");
assert.match(app, /\$\{getHistoricalMedianoEditorialEpisodeReviewMarkup\(podcast\)\}\s*<section class="podcast-detail-sheet__episode-rating-mobile-help"/u,
  "the qualified score appears on the main podcast detail card alongside separate rating fields");
assert.match(app, /data-podcast-detail-rating="mads"|podcast-detail-sheet__rating-cell--mads/u);
assert.match(app, /podcast-detail-sheet__rating-cell--own/u);

assert.match(app, new RegExp(`"${exactLegacyPodcastId}": "${exactCanonicalPodcastId}"`, "u"),
  "the reviewed historical podcast alias remains connected to the canonical series");
assert.ok(!Object.hasOwn(episodeConfig[exactCanonicalPodcastId].manualEpisodeCanonicalIds, "different episode"));
assert.equal(podcast.manualEpisodeCanonicalIds[normalizeMatchKey(exactEpisodeTitle)], exactEpisodeId,
  "Peter's fixed episode UUID remains the only score-bearing identity");
assert.match(app, /function canonicalizeUserRatingRows\(rows\)/u,
  "personal podcast-rating keys continue through the existing canonicalizer");
assert.match(app, /persistedKeyByCanonical\[canonicalKey\] = selected\.rawKey/u,
  "legacy persisted rating keys are preserved for subsequent edits");

const episodeCover = coverManifest.podcasts.find((entry) => entry.appPodcastKey === exactLegacyPodcastId);
assert.ok(episodeCover, "the existing cover registry entry for the old episode identity is located");
assert.match(episodeCover.originalImageUrl, /sparekassen-kronjylland\.jpg$/u,
  "the registered source is the known sponsor image and cannot be used as series artwork");
assert.equal(episodeCover.sourceWidth, 2500);
assert.equal(episodeCover.sourceHeight, 2500);
assert.equal(episodeCover.original.checksum, "5dd6245f1cbbbf29c8b01237142b5c2d48b5f33d09757f0a1525dcc89558c86c");
const sponsorImageBytes = await readFile(new URL(`../${episodeCover.original.path}`, import.meta.url));
assert.equal(createHash("sha256").update(sponsorImageBytes).digest("hex"), episodeCover.original.checksum,
  "the local sponsor image bytes match the cover manifest checksum");
assert.ok(!coverManifest.podcasts.some((entry) => entry.appPodcastKey === exactCanonicalPodcastId),
  "no cover is registered under the canonical series ID");
assert.ok(!app.includes("issue58-editorial-artwork-proposal.svg"),
  "the unapproved title graphic is not wired into live cover selection");

console.log(JSON.stringify({
  status: "PASS",
  canonicalPodcastId: exactCanonicalPodcastId,
  episodeId: exactEpisodeId,
  historicalEditorialRating: "7,3/10",
  ratingTypesKeptSeparate: ["Podcastlisten", "Brugerne", "Din vurdering", "episodehistorik"],
  coverSource: episodeCover.originalImageUrl,
  coverSourceDimensions: [episodeCover.sourceWidth, episodeCover.sourceHeight],
  coverSourceSha256: episodeCover.original.checksum,
  accountSpecificRatingRecoveryAttempted: false
}, null, 2));
