import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const catalogue = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8")).rows;
function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const end = start + app.slice(start).search(/\n}\r?\n/);
  return app.slice(start, end + 2);
}

const version = Number(app.match(/const UDFORSK_RECOMMENDATION_VERSION = (\d+);/)[1]);
assert.equal(version, 8, "personalized recommendation snapshots use the corrected matching version");
assert.match(index, /app\.js\?v=20261103-explore-host-identity-v1/u,
  "the asset URL changes so clients request the corrected matcher after deployment");

const context = vm.createContext({});
vm.runInContext([
  "normalizeText", "normalizeComparable", "getComparableHostParts", "hostsMatchComparable"
].map(extractFunction).join("\n"), context);
const matches = context.hostsMatchComparable;

assert.equal(matches("Mads & Martin", "Martin Grønne & Henning Kristensen"), false,
  "HjerneRO's short host credits do not match full Bakspejl names");
assert.equal(matches("Martin Grønne", "Martin Grønne & Henning Kristensen"), true,
  "a full host name matches the same person in a group");
assert.equal(matches("Henning Kristensen", "Martin Grønne & Henning Kristensen"), true,
  "the other full host name matches the same group");
assert.equal(matches("  CÉLINE   KLINT ", "Celine Klint"), true,
  "identical normalized full host names match");
assert.equal(matches("Martin Petersen", "Martin Grønne"), false,
  "a shared first name does not identify a host");
assert.equal(matches("Henning Hansen", "Henning Kristensen"), false,
  "a shared first name does not identify a host");
assert.equal(matches("Grønne", "Martin Grønne"), false,
  "a partial surname does not identify a host");
assert.equal(matches("Anne-Marie Nielsen", "Anne Marie Nielsen"), false,
  "similar or substring names are not fuzzy-matched");
assert.equal(matches("Mads & Martin", "Mads & Martin"), true,
  "identical normalized host groups still match exactly");

const hjerneRoRow = catalogue.find((row) => row["Podcast-ID"] === "hjernero");
const bakspejlRows = catalogue.filter((row) => row.Hovedserie === "Bakspejl" && row.Vært);
const bakspejlSeedRow = bakspejlRows.find((row) => row.Vært === "Martin Grønne & Henning Kristensen");
assert.ok(hjerneRoRow && bakspejlSeedRow, "exact HjerneRO and Bakspejl catalogue rows exist");
assert.equal(hjerneRoRow.Vært, "Mads & Martin", "HjerneRO catalogue host credit remains unchanged");
assert.equal(bakspejlSeedRow.Vært, "Martin Grønne & Henning Kristensen", "Bakspejl catalogue host credit remains unchanged");

const toPodcast = (row) => ({
  key: row["Podcast-ID"], title: row.Titel, host: row.Vært, mainSeries: row.Hovedserie
});
const seedPodcast = toPodcast(bakspejlSeedRow);
const publicPodcasts = [hjerneRoRow, ...bakspejlRows]
  .filter((row, index, rows) => rows.findIndex((candidate) => candidate["Podcast-ID"] === row["Podcast-ID"]) === index)
  .map(toPodcast);
const seed = { key: seedPodcast.key, podcast: seedPodcast, rating: 9, source: "rating" };
const profile = {
  ratingSeeds: [seed], savedSeeds: [], ratedKeys: new Set([seed.key]), savedKeys: new Set(),
  seedKeys: new Set([seed.key]), hostSignals: [{ value: seedPodcast.host, weight: 1 }],
  mainSeriesSignals: new Map()
};
const sectionContext = vm.createContext({
  state: { podcastSimilarityProductStatus: "loading", exploreClustersStatus: "ready" },
  EXPLORE_PERSONAL_MINIMUM_GROUP_SIZE: 3,
  isLoggedIn: () => true,
  getExplorePreferenceProfile: () => profile,
  getExploreDailySeedPool: () => ({ dayKey: "20261103", seeds: [seed], diagnostics: [{ key: seed.key }] }),
  getExploreClusterSections: () => [],
  getExploreRecommendationInputFingerprint: () => "host-identity-test",
  getExploreSeedSectionItems: () => [],
  getExploreSeedTitle: () => `Fordi du gav ${seedPodcast.title}`,
  getPodcastKey: (podcast) => podcast?.key,
  resolvePublicPodcastDisplayItem: (podcast) => podcast,
  getPublicDisplayPodcasts: () => publicPodcasts,
  matchesExploreFilters: () => true,
  getExploreCandidateFit: (podcast) => ({ podcast, reason: "host", score: 1 }),
  getExplorePersonalCandidateItems: () => [],
  markExplorePersonalSeedsShown: () => {}
});
vm.runInContext([
  extractFunction("normalizeText"), extractFunction("normalizeComparable"),
  extractFunction("getComparableHostParts"), extractFunction("hostsMatchComparable"),
  extractFunction("getExplorePersonalSections")
].join("\n"), sectionContext);
const sections = sectionContext.getExplorePersonalSections({ maxSections: 1, limit: 30 });
assert.equal(sections.length, 1, "a Bakspejl host section is produced from the exact catalogue values");
assert.equal(sections[0].eyebrow, "Mere med en favoritvært");
assert.equal(sections[0].title, "Mere med Martin Grønne & Henning Kristensen");
assert.ok(sections[0].items.length >= 3, "legitimate Bakspejl host recommendations remain visible");
assert.ok(!sections[0].items.some((item) => item.podcast.key === hjerneRoRow["Podcast-ID"]),
  "HjerneRO is excluded from the Bakspejl host-based Explore section");

console.log("Explore host identity regression checks passed.");
