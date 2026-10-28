import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const app = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");
const groups = JSON.parse(await readFile(new URL("../data/podcast-display-groups.json", import.meta.url), "utf8"));
const catalogue = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8")).rows;

function extract(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  let depth = 0;
  for (let index = start; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const longDescription = "Kirsten Birgit ringer til sin mangeårige makker Rasmus Bruun for at vende deres liv, medierne, politik og forholdene på r8Dio. Gennem sæsonerne følger vi det fiktive makkerpars løse telefonsamtaler, hvor aktuelle begivenheder, personlige problemer og interne konflikter på radiostationen blandes med satire og tilbagevendende figurer fra universet.";
const kirsten = groups.groups.find((group) => group.id === "kirsten-ringer-til-rasmus");
assert.equal(kirsten.description, longDescription);
const kirstenSource = catalogue.find((row) => row["Podcast-ID"] === "kirsten ringer til rasmus sæson 4");
assert.ok(kirstenSource);
assert.equal(kirstenSource["Vuring (1-10)"], "8,1");
assert.equal(kirstenSource.accessType, "paid");
assert.equal(kirstenSource["Udgiver"], "R8dio");
assert.equal(kirstenSource["Link"], "https://r8dio.dk/program/kirsten-ringer-til-rasmus/");
assert.deepEqual(kirstenSource.supplementarySimilarities.map(({ title }) => title), [
  "den korte podcast", "verdens klogeste land", "ingen kommentarer", "sig det løgn"
]);
assert.equal(kirsten.memberLegacyKeys.length + kirsten.seasonIdentities.length, 6);

const normalizeComparable = (value) => String(value ?? "").trim().toLocaleLowerCase("da");
const canonicalGenres = ["True Crime", "Historie", "Krig", "Politik", "Finans", "Samfund", "Sport", "Dokumentar", "Viden", "Underholdning"];
const detailGenresRuntime = new Function("normalizeComparable", "CANONICAL_GENRES", `${extract("getPodcastDetailGenres")}; return getPodcastDetailGenres;`)(normalizeComparable, canonicalGenres);
const sharedGenresRuntime = new Function("getPodcastDetailGenres", "normalizeComparable", `${extract("getSharedDisplayGroupGenres")}; return getSharedDisplayGroupGenres;`)(detailGenresRuntime, normalizeComparable);
const escapeHtmlTest = (value) => String(value ?? "").replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&#39;");
const genreMarkupRuntime = new Function("escapeHtml", `${extract("renderPodcastGenreTags")}; return renderPodcastGenreTags;`)(escapeHtmlTest);
const metadataRuntime = new Function("normalizeComparable", `${extract("getDisplayGroupSharedMetadata")}; return getDisplayGroupSharedMetadata;`)(normalizeComparable);
const realMember = {
  genre: "Underholdning", publisher: "r8Dio", host: "Kirsten Birgit & Rasmus Bruun", accessType: "paid", link: kirstenSource.Link
};
const syntheticSeasons = Array.from({ length: 5 }, () => ({ isDisplayGroupSeason: true, genre: "Dokumentar" }));
assert.deepEqual(metadataRuntime([realMember, ...syntheticSeasons]), {
  genre: "Underholdning", publisher: "r8Dio", host: "Kirsten Birgit & Rasmus Bruun", access: "", language: ""
});
assert.equal(metadataRuntime(syntheticSeasons).genre, "Dokumentar", "metadata falls back when a group has no catalogue members");

const recommendationSources = [];
const recommendationRuntime = new Function(
  "state", "getPodcastKey", "getPodcastDetailDynamicRecommendations", "getValidatedPodcastSimilarityProduct", "selectPodcastDetailRecommendations", "loadPodcastSimilarityProductData",
  `${extract("getDisplayGroupRecommendations")}; return getDisplayGroupRecommendations;`
)({ podcastSimilarityProductStatus: "ready" }, (member) => member.key, (member) => {
  recommendationSources.push(member);
  return member.recommendations || [];
}, () => null, (items) => items, () => {});
const realKirsten = { key: "kirsten-s4", recommendations: kirstenSource.supplementarySimilarities.map((item, rank) => ({ item: { podcast: { key: `recommendation-${rank}`, title: item.title } } })) };
const kirstenMembers = [realKirsten, ...syntheticSeasons.map((_, index) => ({ key: `synthetic-${index}`, isDisplayGroupSeason: true }))];
assert.deepEqual(
  recommendationRuntime(kirsten, kirstenMembers).map((item) => item.item.podcast.title),
  ["den korte podcast", "verdens klogeste land", "ingen kommentarer", "sig det løgn"]
);
assert.deepEqual(recommendationSources, [realKirsten], "synthetic seasons cannot contribute recommendation votes");

recommendationSources.length = 0;
const narkobetjenten = groups.groups.find((group) => group.id === "narkobetjenten");
const narkobetjentenRealMembers = Array.from({ length: narkobetjenten.memberLegacyKeys.length }, (_, index) => ({ key: `narko-${index}`, recommendations: [] }));
const narkobetjentenSynthetic = narkobetjenten.seasonIdentities.map((_, index) => ({ key: `narko-synthetic-${index}`, isDisplayGroupSeason: true }));
recommendationRuntime(narkobetjenten, [...narkobetjentenRealMembers, ...narkobetjentenSynthetic]);
assert.equal(recommendationSources.length, narkobetjenten.memberLegacyKeys.length, "all real Narkobetjenten catalogue rows remain recommendation sources");
assert.ok(recommendationSources.every((member) => !member.isDisplayGroupSeason));

const sharedMetadata = metadataRuntime;
const render = new Function(
  "state", "getDisplayGroupSeasonNumber", "parseNumber", "getDisplayGroupOwnRatingStats", "getDisplayGroupSharedMetadata", "getSharedDisplayGroupGenres", "renderPodcastGenreTags", "getDisplayGroupSimilarityMarkup", "escapeHtml", "getPodcastAccessIndicatorMarkup", "isValidPodcastLink", "setPodcastDetailPlacementControl", "getPodcastKey", "setImage", "getPodcastImageSources", "hydratePodcastSimilarityProduct", "bindPodcastDetailFilterButtons", "renderFavoriteButton", "handleFavoriteToggle", "isMobileViewport", "formatCompactRating", "formatUserRatingCount", "getUserRating", "getCommunityStat", "hasCommunityRating", "getPodcastDisplayGroupOwnRatingMarkup", "bindPodcastDisplayGroupRatingLock",
  `${extract("renderPodcastDisplayGroupContent")}; return renderPodcastDisplayGroupContent;`
)({ podcastDetailView: "", activePodcastDetailKey: "", podcastDetailRecommendationCache: new Map() }, () => 4, () => null,
  () => ({ average: null, count: 0 }), sharedMetadata, sharedGenresRuntime, genreMarkupRuntime, () => "", String,
  (podcast, options) => podcast.accessType === "paid" && options.detail ? "<span class=\"podcast-access-detail\">Kræver abonnement</span>" : "", (url) => url.startsWith("https://"),
  () => {}, (podcast) => podcast.key, () => {}, () => "", () => {}, () => {}, () => {}, () => {}, () => false,
  String, String, () => null, () => null, () => false, (own) => own.count ? `<strong>${own.average}</strong>` : "<strong>—</strong>", () => {});
let markup = "";
const content = { classList: { add() {}, remove() {} }, querySelector: () => null, querySelectorAll: () => [], set innerHTML(value) { markup = value; } };
const dialog = { querySelector: (selector) => selector === "[data-podcast-detail-content]" ? content : { replaceChildren() {} }, classList: { remove() {} } };
render(dialog, {
  key: "display-group:kirsten-ringer-til-rasmus", id: kirsten.id, title: kirsten.title, description: kirsten.description,
  ratingValue: 8.1, userAverageRating: 8.5, userRatingCount: 1, accessType: "paid", link: kirstenSource.Link,
  displayGroupMembers: [realMember, ...syntheticSeasons]
});
assert.match(markup, /Underholdning/u);
assert.match(markup, /data-value="Underholdning"/u);
assert.doesNotMatch(markup, /data-value="Dokumentar"/u, "display-group tags ignore synthetic season-only genres");
assert.match(markup, /r8Dio/u);
assert.match(markup, /Kirsten Birgit & Rasmus Bruun/u);
assert.match(markup, /Kræver abonnement/u);
assert.match(markup, /href="https:\/\/r8dio\.dk\/program\/kirsten-ringer-til-rasmus\/"/u);
assert.match(markup, new RegExp(longDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));

console.log("Kirsten display-group metadata, recommendations, description, access and catalogue-preservation regressions passed.");
