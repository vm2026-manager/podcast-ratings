import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const groups = JSON.parse(await readFile(new URL("../data/podcast-display-groups.json", import.meta.url), "utf8"));
const group = groups.groups.find((item) => item.id === "narkobetjenten");
assert.ok(group, "Narkobetjenten display group remains configured");
assert.equal(group.memberLegacyKeys.length + group.seasonIdentities.length, 24);

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  let depth = 0;
  const bodyStart = app.slice(start).search(/\)\s*\{/u);
  assert.ok(bodyStart >= 0, `${name} has a function body`);
  const openBrace = app.indexOf("{", start + bodyStart);
  for (let index = openBrace; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const state = {
  podcasts: [
    { key: "narko-1", title: "Narkobetjenten sæson 1" },
    { key: "narko-15", title: "Narkobetjenten sæson 15" },
    { key: "narko-gade", title: "Narkobetjenten på gaden (sæson 1)" },
    { key: "ordinary", title: "Almindelig podcast" },
    { key: "popular", title: "Populær podcast" }
  ],
  podcastDetailPublicItemByPodcastKey: {
    "narko-1": { id: "narkobetjenten" },
    "narko-15": { id: "narkobetjenten" }
  }
};
const publicGroup = { key: "display-group:narkobetjenten", title: "Narkobetjenten", isDisplayGroup: true };
const displayRuntime = new Function("state", `
  const getPodcastKey = (podcast) => podcast?.key || "";
  const createRankingDisplayGroup = () => (${JSON.stringify(publicGroup)});
  ${extractFunction("resolvePublicPodcastDisplayItem")}
  ${extractFunction("getPublicDisplayPodcasts")}
  return getPublicDisplayPodcasts;
`)(state);
const publicItems = displayRuntime();
assert.equal(publicItems.filter((item) => item.isDisplayGroup).length, 1);
assert.ok(publicItems.some((item) => item.title === "Narkobetjenten på gaden (sæson 1)"));
assert.ok(!publicItems.some((item) => item.title === "Narkobetjenten sæson 15"));
assert.equal(
  publicItems.filter((item) => item.isDisplayGroup && item.key === "display-group:narkobetjenten").length,
  1,
  "the main-series seasons resolve to one public recommendation identity"
);

const sharedPoolFunctions = [
  "getHomeLatestEditorialReviews", "getHomeRecentPodcasts",
  "getPodcastlistenPlacementPool", "getPodcastlistenTopPodcasts",
  "getExplorePersonalCandidateItems", "getExploreRecommendationItems",
  "getExploreRelatedItems", "getExploreSeedSectionItems",
  "getExploreUnderratedGemItems", "getExploreFavoriteGenreSections",
  "renderExploreGenreSections"
];
for (const name of sharedPoolFunctions) {
  assert.match(extractFunction(name), /getPublicDisplayPodcasts\(/u, `${name} uses shared public display identities`);
}
assert.match(extractFunction("getExplorePersonalSections"), /resolvePublicPodcastDisplayItem/u,
  "cluster and cached personal rows collapse to public identities before deduplication");
assert.match(extractFunction("readExplorePersonalSnapshot"), /getRankingDisplayItemByKey/u,
  "personal snapshots can restore a cached display group");
assert.match(extractFunction("getHomeCommunityPopularSourcePodcasts"), /displayGroupItem/u,
  "eligible individual seasons retain their grouped rating destination");
assert.match(extractFunction("createHomePopularCardElement"), /renderPodcastDisplayGroupSeasonWorkspace/u,
  "clicking an individual season opens its group season workspace");

const candidateState = {
  podcasts: [
    { key: "season-1", title: "Narkobetjenten sæson 1", ratingValue: 8, image: "cover", host: "Host" },
    { key: "season-15", title: "Narkobetjenten sæson 15", ratingValue: 9, image: "cover", host: "Host" },
    { key: "gade", title: "Narkobetjenten på gaden (sæson 1)", ratingValue: 7, image: "gade-cover" },
    { key: "ordinary", title: "Almindelig podcast" },
    { key: "popular", title: "Populær podcast" }
  ],
  podcastDisplayGroups: [{ id: "narkobetjenten", rankingEnabled: true }],
  podcastDetailDisplayGroupByPodcastKey: {
    "season-1": { id: "narkobetjenten" },
    "season-15": { id: "narkobetjenten" },
    "display-season:narkobetjenten:4": { id: "narkobetjenten" }
  },
  communityStatsByKey: {
    "season-1": { averageRating: 7, ratingCount: 1 },
    "season-15": { averageRating: 5.9, ratingCount: 9 },
    "display-season:narkobetjenten:4": { averageRating: 6.5, ratingCount: 1 },
    gade: { averageRating: 6.5, ratingCount: 1 },
    ordinary: { averageRating: 7.5, ratingCount: 2 },
    popular: { averageRating: 8, ratingCount: 3 }
  },
  displayGroupCommunityStatsById: {}
};
const communityRuntime = new Function("state", `
  const HOME_COMMUNITY_MIN_RATING = 6;
  const HOME_COMMUNITY_PRIMARY_MIN_COUNT = 3;
  const HOME_COMMUNITY_SECONDARY_MIN_COUNT = 2;
  const HOME_POPULAR_CAROUSEL_POOL_LIMIT = 50;
  const getPodcastKey = (podcast) => podcast?.key || "";
  const getDisplayGroupSeasonIdentities = () => [{
    key: "display-season:narkobetjenten:4", title: "Narkobetjenten (sæson 4)"
  }];
  const createRankingDisplayGroup = () => ({
    displayGroupMembers: [{ image: "group-cover", imageSources: { large: "group-cover" }, host: "Shared Host", publisher: "Shared Publisher", genre: "Krimi" }]
  });
  const getCommunityStat = (key) => state.communityStatsByKey[key] || null;
  const parseNumber = (value) => value === null || value === undefined ? null : Number(value);
  const normalizeText = (value) => String(value || "");
  ${extractFunction("getHomeCommunityCandidateLevel")}
  ${extractFunction("getHomeCommunityPopularitySignals")}
  ${extractFunction("getHomeCommunityPopularSourcePodcasts")}
  ${extractFunction("getHomeCommunityPopularCandidatePools")}
  return { getHomeCommunityPopularCandidatePools, getHomeCommunityCandidateLevel };
`)(candidateState);
const pools = communityRuntime.getHomeCommunityPopularCandidatePools();
const popularSeasons = pools.tertiary.map((item) => item.podcast);
assert.deepEqual(popularSeasons.map((podcast) => podcast.key).sort(), [
  "display-season:narkobetjenten:4", "gade", "season-1"
].sort(), "6+ one-rating seasons qualify, while unrated and under-six seasons do not");
const synthetic = popularSeasons.find((podcast) => podcast.key === "display-season:narkobetjenten:4");
assert.equal(synthetic.image, "group-cover");
assert.equal(synthetic.host, "Shared Host");
assert.ok(synthetic.displayGroupItem, "synthetic community cards resolve to the group workspace");
assert.deepEqual(pools.secondary.map((item) => item.podcast.key), ["ordinary"]);
assert.deepEqual(pools.primary.map((item) => item.podcast.key), ["popular"]);
assert.equal(communityRuntime.getHomeCommunityCandidateLevel(6, 1), "tertiary");
assert.equal(communityRuntime.getHomeCommunityCandidateLevel(6, 2), "secondary");
assert.equal(communityRuntime.getHomeCommunityCandidateLevel(6, 3), "primary");
assert.equal(communityRuntime.getHomeCommunityCandidateLevel(5.99, 9), null);
assert.equal(communityRuntime.getHomeCommunityCandidateLevel(8, 0), null);

const recommendationState = {
  podcastDetailCanonicalGroupKeyByPodcastKey: {},
  podcastDetailDisplayGroupByPodcastKey: {
    "narko-season-1": { id: "narkobetjenten" },
    "narko-season-15": { id: "narkobetjenten" },
    "narko-gade": null
  }
};
const recommendationRuntime = new Function("state", `
  const getPodcastKey = (podcast) => podcast?.key || "";
  const normalizeComparable = (value) => String(value || "").trim().toLocaleLowerCase("da-DK");
  const normalizeMatchKey = normalizeComparable;
  const normalizeText = (value) => String(value || "");
  ${extractFunction("getPodcastDetailCanonicalGroupKey")}
  ${extractFunction("isNarkobetjentenMainSeasonPodcast")}
  ${extractFunction("getRecommendationDiversityKey")}
  ${extractFunction("selectPodcastDetailRecommendations")}
  return { selectPodcastDetailRecommendations, isNarkobetjentenMainSeasonPodcast };
`)(recommendationState);
const narkobetjentenSource = { key: "narko-season-1" };
const narkobetjentenCandidates = [
  { item: { podcast: { key: "narko-season-15" } }, source: "manual" },
  { item: { podcast: { key: "narko-gade" } }, source: "separate-release" },
  { item: { podcast: { key: "ordinary" } }, source: "external" }
];
const safeNarkobetjentenRecommendations =
  recommendationRuntime.selectPodcastDetailRecommendations(narkobetjentenCandidates, 4, {
    sourcePodcast: narkobetjentenSource
  });
assert.deepEqual(
  safeNarkobetjentenRecommendations.map((item) => item.item.podcast.key),
  ["narko-gade", "ordinary"],
  "manual and automatic recommendations cannot cross-link main-series seasons, while the separate Narkobetjenten på gaden release remains eligible"
);
assert.equal(
  recommendationRuntime.isNarkobetjentenMainSeasonPodcast({ key: "narko-gade" }),
  false,
  "Narkobetjenten på gaden is not assigned to the main-series display group"
);

console.log("Narkobetjenten public display regressions passed.");
