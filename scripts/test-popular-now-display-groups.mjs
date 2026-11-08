import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [app, groupsPayload, cataloguePayload] = await Promise.all([
  readFile(new URL("app.js", root), "utf8"),
  readFile(new URL("data/podcast-display-groups.json", root), "utf8").then(JSON.parse),
  readFile(new URL("data/podcasts.json", root), "utf8").then(JSON.parse)
]);
const catalogueRows = Array.isArray(cataloguePayload) ? cataloguePayload : cataloguePayload.rows;

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const bodyStart = app.indexOf("{", app.indexOf(")", start) + 1);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const normalizeMatchKey = (value) => normalizeText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/&/g, " og ").replace(/[^a-z0-9æøå ]/g, " ").replace(/\s+/g, " ").trim();
const groups = groupsPayload.groups.filter((group) => ["narkobetjenten", "kirsten-ringer-til-rasmus"].includes(group.id));
assert.equal(groups.length, 2, "tests use both verified production display-group configurations");

const selectedRows = groups.flatMap((group) => group.memberLegacyKeys.map((legacyKey) => {
  const row = catalogueRows.find((candidate) => normalizeMatchKey(candidate.Titel) === normalizeMatchKey(legacyKey));
  assert.ok(row, `verified catalogue member exists for ${group.id}: ${legacyKey}`);
  return row;
}));
const podcasts = selectedRows.map((row) => ({
  key: normalizeMatchKey(row.Titel), legacyKey: normalizeMatchKey(row.Titel), title: row.Titel,
  podcastId: row["Podcast-ID"], genre: row.Genre, ratingValue: row["Vuring (1-10)"]
}));
const unmatchedCatalogueRows = catalogueRows.filter((row) =>
  /^(?:bandeland|barn med den forkerte|huset færch|røverhistorier)\b.*\(\s*sæson\s+\d+\s*\)$/iu.test(String(row.Titel || ""))
);
assert.ok(unmatchedCatalogueRows.length >= 4, "real unmapped season rows from the issue are present in the catalogue fixture");
const unmatchedCatalogueSeasons = unmatchedCatalogueRows.map((row) => ({
  key: normalizeMatchKey(row.Titel), legacyKey: normalizeMatchKey(row.Titel), title: row.Titel,
  podcastId: row["Podcast-ID"], genre: row.Genre
}));
podcasts.push(...unmatchedCatalogueSeasons);
const statsByKey = Object.create(null);
const state = {
  podcastDisplayGroups: groups,
  podcasts,
  communityStatsByKey: statsByKey,
  popularNowUnmatchedSeasonReviewKeys: new Set()
};

function getDisplayGroupMemberPodcasts(group) {
  const catalogueMembers = group.memberLegacyKeys.map((legacyKey) =>
    podcasts.find((podcast) => podcast.legacyKey === normalizeMatchKey(legacyKey))
  );
  assert.ok(catalogueMembers.every(Boolean), `all exact configured members resolve for ${group.id}`);
  const seasons = (group.seasonIdentities || []).map((season) => ({
    key: season.podcast_key, legacyKey: season.podcast_key, title: season.title,
    podcastId: season.podcast_key, genre: "True Crime", isDisplayGroupSeason: true,
    displayGroupId: group.id
  }));
  return [...catalogueMembers, ...seasons];
}

function createRankingDisplayGroup(group) {
  return {
    key: `display-group:${group.id}`, legacyKey: `display-group:${group.id}`, title: group.title,
    isDisplayGroup: true, displayGroupId: group.id, displayGroupMembers: getDisplayGroupMemberPodcasts(group)
  };
}

const getKey = (podcast) => podcast.key;
const getLegacyKey = (podcast) => podcast.legacyKey;
const resolveCanonicalPodcastId = (key) => key;
const getActivityStat = new Function(
  "state", "normalizeText", "resolveCanonicalPodcastId", "getPodcastKey",
  `${extractFunction("getPopularNowActivityStat")}; return getPopularNowActivityStat;`
)(state, normalizeText, resolveCanonicalPodcastId, getKey);
const isValidActivity = new Function(
  `${extractFunction("hasValidPopularNowActivityStat")}; return hasValidPopularNowActivityStat;`
)();
const isEligible = new Function(
  "getPopularNowActivityStat", "hasValidPopularNowActivityStat",
  `${extractFunction("hasDocumentedRecentActivity")}; return hasDocumentedRecentActivity;`
)(getActivityStat, isValidActivity);
const compare = new Function(
  "getPopularNowActivityStat", "getPodcastKey",
  `${extractFunction("comparePopularNowCandidates")}; return comparePopularNowCandidates;`
)(getActivityStat, getKey);
const isStandaloneSeason = new Function(
  `${extractFunction("isStandaloneSeasonPodcast")}; return isStandaloneSeasonPodcast;`
)();
const candidates = new Function(
  "state", "normalizeMatchKey", "normalizeText", "getLegacyPodcastKey", "getPodcastKey",
  "getDisplayGroupMemberPodcasts", "createRankingDisplayGroup", "getPopularNowActivityStat",
  "hasValidPopularNowActivityStat", "hasDocumentedRecentActivity", "isStandaloneSeasonPodcast",
  "deduplicatePodcastResults", "console",
  `${extractFunction("getPopularNowCandidates")}; return getPopularNowCandidates;`
)(state, normalizeMatchKey, normalizeText, getLegacyKey, getKey, getDisplayGroupMemberPodcasts,
  createRankingDisplayGroup, getActivityStat, isValidActivity, isEligible, isStandaloneSeason,
  (items) => [...new Map(items.map((item) => [item.key, item])).values()], { warn() {} });

function activity({ key, seven = 0, thirty = 0, ninety = 0, momentum }) {
  statsByKey[key] = { recentUsers7d: seven, recentUsers30d: thirty, recentUsers90d: ninety, momentumScore: momentum };
}

// Exercise the exact verified catalogue identities: Narkobetjenten season 23
// and Kirsten's configured season 4, plus the group's catalogue members.
const narko = groups.find((group) => group.id === "narkobetjenten");
const kirsten = groups.find((group) => group.id === "kirsten-ringer-til-rasmus");
const narko23 = narko.seasonIdentities.find((season) => season.season === 23).podcast_key;
const kirsten4 = podcasts.find((podcast) => podcast.title.toLowerCase().includes("sæson 4"))?.key;
assert.ok(kirsten4, "the catalogue's Kirsten season 4 is present");
activity({ key: narko23, thirty: 1, ninety: 1, momentum: 0.4 });
activity({ key: podcasts.find((podcast) => podcast.legacyKey === normalizeMatchKey(narko.representativeMemberLegacyKey)).key,
  seven: 1, thirty: 1, ninety: 1, momentum: 0.8 });
activity({ key: kirsten4, thirty: 1, ninety: 1, momentum: 0.6 });
const allCandidates = candidates();
assert.equal(allCandidates.filter((podcast) => podcast.displayGroupId === "narkobetjenten").length, 1,
  "Narkobetjenten is represented by one main podcast even when season 23 has activity");
assert.equal(allCandidates.filter((podcast) => podcast.title === "Narkobetjenten (sæson 23)").length, 0,
  "season 23 never appears as an individual result");
assert.equal(allCandidates.filter((podcast) => podcast.displayGroupId === "kirsten-ringer-til-rasmus").length, 1,
  "Kirsten ringer til Rasmus appears once through the verified season 4 identity");
assert.equal(allCandidates.some((podcast) => podcast.isDisplayGroupSeason), false,
  "verified season identities are used only to qualify their main display group");
assert.equal(getActivityStat(allCandidates.find((podcast) => podcast.displayGroupId === "narkobetjenten")).momentumScore, 0.8,
  "the strongest validated season momentum is used without summing season activity");
assert.ok(compare(allCandidates.find((podcast) => podcast.displayGroupId === "narkobetjenten"),
  allCandidates.find((podcast) => podcast.displayGroupId === "kirsten-ringer-til-rasmus")) < 0,
"group ordering uses the most active season's momentum");

const unmatchedSeason = { key: "unverified series (sæson 2)", legacyKey: "unverified series (sæson 2)",
  title: "Unverified series (sæson 2)" };
state.podcasts.push(unmatchedSeason);
activity({ key: unmatchedSeason.key, seven: 1, thirty: 1, ninety: 1, momentum: 0.95 });
unmatchedCatalogueSeasons.forEach((season) =>
  activity({ key: season.key, seven: 1, thirty: 1, ninety: 1, momentum: 0.9 })
);
assert.equal(candidates().some((podcast) => podcast.key === unmatchedSeason.key), false,
  "an active standalone season without a verified group is suppressed, never fuzzy-linked");
assert.ok(state.popularNowUnmatchedSeasonReviewKeys.has(unmatchedSeason.key),
  "suppressed unmatched season is registered for editorial review");
assert.ok(unmatchedCatalogueSeasons.every((season) =>
  !candidates().some((podcast) => podcast.key === season.key) && state.popularNowUnmatchedSeasonReviewKeys.has(season.key)),
"actual unmapped catalogue season rows are hidden and added to the review diagnostic");

delete statsByKey[kirsten4];
assert.equal(candidates().some((podcast) => podcast.displayGroupId === "kirsten-ringer-til-rasmus"), false,
  "a main series without any season activity data is not shown");
activity({ key: kirsten4, thirty: 0, ninety: 0, momentum: 0 });
assert.equal(candidates().some((podcast) => podcast.displayGroupId === "kirsten-ringer-til-rasmus"), false,
  "inactive seasons beyond 90 days do not qualify their main series");
activity({ key: kirsten4, thirty: 0, ninety: 1, momentum: 0.1 });
assert.equal(candidates().filter((podcast) => podcast.displayGroupId === "kirsten-ringer-til-rasmus").length, 1,
  "documented activity in the 90-day window includes the main series once");
assert.equal(candidates().filter((podcast) => podcast.isDisplayGroupSeason).length, 0,
  "no individual verified season leaks into popular results");

assert.match(app, /state\.popularNowActive\s*\?\s*getPopularNowCandidates\(\)\s*:\s*getRankingCandidates\(\)/u,
  "normal ranking continues to use its independent, unchanged candidate builder");
assert.match(app, /if \(podcast\.isDisplayGroup\) renderPodcastDisplayGroupContent\(dialog, podcast\)/u,
  "the grouped result still opens the existing podcast detail view");
assert.match(app, /getPodcastRatingControlDescription|episode-derived|is-episode-rating-locked/u,
  "existing rating-lock behavior remains available for ranking controls");

console.log("PASS: verified season grouping, 90-day eligibility, conservative momentum, unmatched-season suppression, and ranking isolation.");
