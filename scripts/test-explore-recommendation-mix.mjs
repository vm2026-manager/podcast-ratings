import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const end = start + app.slice(start).search(/\n}\r?\n/);
  return app.slice(start, end + 2);
}
const version = Number(app.match(/const UDFORSK_RECOMMENDATION_VERSION = (\d+);/)[1]);
assert.ok(version > 5, "old cluster-first snapshots must be invalidated");
const minimum = Number(app.match(/const EXPLORE_PERSONAL_MINIMUM_GROUP_SIZE = (\d+);/)[1]);

assert.match(
  app,
  /const personalSectionKeys = new Set\([\s\S]*?sectionsToRender\.flatMap/,
  "editorial recommendations must reserve personal section podcast keys"
);
assert.match(
  app,
  /getExploreUnderratedGemItems\([\s\S]*?\),\s*personalSectionKeys\s*\)/,
  "Oversete favoritter must dedupe against personal recommendation rows"
);
assert.doesNotMatch(
  app,
  /const usedEditorialKeys = new Set\(\);/,
  "editorial recommendations must not use an isolated dedupe scope"
);

function fixture() {
  const catalogue = new Map();
  const podcast = (key, host = "", mainSeries = "") => {
    if (!catalogue.has(key)) catalogue.set(key, { key, title: key, host, mainSeries });
    return catalogue.get(key);
  };
  const items = (keys) => keys.map((key) => ({ podcast: podcast(key), reason: "fixture", score: 1 }));
  const ratingSeeds = ["seed-a", "seed-b", "seed-c"].map((key, index) => ({
    key, podcast: podcast(key, index < 2 ? "Shared Host" : "Solo Host", "Universe"),
    source: "rating", rating: 9
  }));
  const direct = {
    "seed-a": items(["shared", "a1", "a2", "a3"]),
    "seed-b": items(["shared", "c1", "h1", "b1", "b2", "b3", "b4"]),
    "seed-c": items(["d1", "d2", "d3", "d4"])
  };
  ["shared", "c1", "h1", "h2", "h3", "h4"].forEach((key) => {
    podcast(key).host = "Shared Host";
  });
  ["solo1", "solo2", "solo3", "solo4"].forEach((key) => podcast(key, "Solo Host"));
  ["shared", "c1", "h1", "b1", "u1", "u2", "u3", "u4"].forEach((key) => {
    podcast(key).mainSeries = "Universe";
  });
  const clusters = [1, 2, 3, 4, 5].map((n) => ({
    clusterId: `cluster-${n}`, title: `Theme ${n}`, eyebrow: "Ud fra dine vurderinger",
    note: "Multiple positive ratings", seedPodcastIds: ["seed-a", "seed-b"],
    items: items(n === 1 ? ["shared", "c1", "c1", "c2", "c3", "c4"] : [`x${n}a`, `x${n}b`, `x${n}c`])
  }));
  const fallback = items(["shared", "f1", "f2", "f3", "f4"]);
  const profile = {
    ratingSeeds, savedSeeds: [], ratedKeys: new Set(ratingSeeds.map((seed) => seed.key)),
    savedKeys: new Set(), seedKeys: new Set(ratingSeeds.map((seed) => seed.key)),
    // A singleton with greater weight must lose to repeated positive evidence.
    hostSignals: [{ value: "Solo Host", weight: 99 }, { value: "Shared Host", weight: 1 }],
    mainSeriesSignals: new Map([["universe", 3]])
  };
  const storage = new Map();
  let shown = [];
  const context = vm.createContext({
    state: {
      authUser: { id: "user" }, podcasts: [...catalogue.values()],
      podcastByKey: Object.fromEntries(catalogue), exploreClustersStatus: "ready",
      podcastSimilarityProductStatus: "ready"
    },
    window: { localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    } },
    UDFORSK_RECOMMENDATION_VERSION: version,
    EXPLORE_PERSONAL_MINIMUM_GROUP_SIZE: minimum,
    EXPLORE_PERSONAL_SNAPSHOT_STORAGE_KEY: "snapshot",
    isLoggedIn: () => true,
    getPodcastKey: (p) => p?.key,
    normalizeComparable: (s) => String(s || "").toLowerCase().trim(),
    getExplorePreferenceProfile: () => profile,
    getExploreDailySeedPool: () => ({
      dayKey: "20261002", seeds: [...profile.ratingSeeds, ...profile.savedSeeds],
      diagnostics: [...profile.ratingSeeds, ...profile.savedSeeds].map((seed) => ({ key: seed.key }))
    }),
    getExploreClusterSections: () => clusters,
    getExploreRecommendationInputFingerprint: () => "ratings-and-saved",
    getExploreSeedSectionItems: (seed, { limit, usedKeys }) => (direct[seed.key] || [])
      .filter((item) => !usedKeys.has(item.podcast.key)).slice(0, limit),
    getExploreSeedTitle: (seed) => `Fordi du ${seed.source === "saved" ? "gemte" : "gav"} ${seed.key}`,
    markExplorePersonalSeedsShown: (seeds) => { shown = seeds.map((seed) => seed.key); },
    matchesExploreFilters: () => true,
    getExploreCandidateFit: (p) => ({ podcast: p, reason: "match", score: 1 }),
    getExplorePersonalCandidateItems: (_profile, { usedKeys, limit }) => fallback
      .filter((item) => !usedKeys.has(item.podcast.key)).slice(0, limit)
  });
  vm.runInContext([
    "getComparableHostParts", "hostsMatchComparable", "getExplorePersonalSnapshotUserKey",
    "readExplorePersonalSnapshot", "persistExplorePersonalSnapshot", "getExplorePersonalSections"
  ].map(extractFunction).join("\n"), context);
  return { context, profile, clusters, direct, storage, shown: () => shown,
    run: (options) => context.getExplorePersonalSections(options) };
}
function validate(rows, maxSections, limit = 4) {
  assert.ok(rows.length <= maxSections, "section budget is respected");
  const keys = rows.flatMap((row) => {
    assert.ok(row.items.length >= minimum && row.items.length <= limit, "no empty/undersized rows");
    return row.items.map((item) => item.podcast.key);
  });
  assert.equal(new Set(keys).size, keys.length, "podcasts are globally unique across all reasons");
}

const mixed = fixture();
const rows = mixed.run({ maxSections: 5 });
assert.deepEqual(Array.from(rows, (row) => row.seedPodcastKey || row.clusterId || row.title),
  ["seed-a", "cluster-1", "Mere med Shared Host", "seed-b", "Mere fra Universe"]);
validate(rows, 5);
assert.deepEqual(Array.from(mixed.shown()), ["seed-a", "seed-b"], "cluster seeds can still explain distinct direct rows");
const reloaded = mixed.run({ maxSections: 5 });
const semantics = (sections) => JSON.stringify(Array.from(sections, (row) => ({
  title: row.title, eyebrow: row.eyebrow, note: row.note || "",
  clusterId: row.clusterId || "", seedPodcastIds: row.seedPodcastIds || [],
  seedPodcastKey: row.seedPodcastKey || "", seedSource: row.seedSource || "",
  seedRating: row.seedRating ?? null,
  items: Array.from(row.items, (item) => [item.podcast.key, item.reason])
})));
assert.equal(semantics(reloaded), semantics(rows), "snapshot preserves semantics, ordering and cluster identity");
assert.equal(reloaded[1].clusterId, "cluster-1", "reload retains the cluster rendering/rotation path");
assert.deepEqual(Array.from(reloaded[1].seedPodcastIds), ["seed-a", "seed-b"]);
for (const maxSections of [0, 1, 2, 3, 4, 5]) {
  const limited = mixed.run({ maxSections });
  validate(limited, maxSections);
  assert.equal(limited.length, maxSections, "cache cannot exceed a changed section budget");
}
validate(mixed.run({ maxSections: 4, limit: 3 }), 4, 3);

for (const missing of ["host", "cluster", "both"]) {
  const f = fixture();
  if (missing !== "cluster") f.profile.hostSignals = [];
  if (missing !== "host") f.clusters.length = 0;
  const result = f.run({ maxSections: 4 });
  validate(result, 4);
  assert.equal(result.length, 4, `missing ${missing} gracefully fills available slots`);
  assert.equal(result[0].seedPodcastKey, "seed-a");
  assert.ok(result.some((row) => row.seedPodcastKey === "seed-b"));
}
const sparse = fixture();
sparse.clusters.splice(0, sparse.clusters.length, {
  clusterId: "too-small", title: "Too small after dedupe", items: sparse.direct["seed-a"]
});
sparse.profile.hostSignals = [];
sparse.profile.mainSeriesSignals.clear();
sparse.direct["seed-b"] = [];
sparse.direct["seed-c"] = [];
const sparseRows = sparse.run({ maxSections: 4 });
validate(sparseRows, 4);
assert.equal(sparseRows.length, 2, "generic fallback survives exhausted/overlapping reasons");
assert.equal(sparseRows[1].title, "Prøv noget lidt anderledes");

const saved = fixture();
saved.profile.savedSeeds = [{ ...saved.profile.ratingSeeds[0], source: "saved" }];
saved.profile.ratingSeeds = [];
saved.profile.hostSignals = [];
saved.profile.mainSeriesSignals.clear();
saved.clusters.length = 0;
const savedRows = saved.run({ maxSections: 4 });
validate(savedRows, 4);
assert.ok(savedRows.some((row) => row.seedSource === "saved"), "saved seed fallback remains usable");
saved.context.isLoggedIn = () => false;
assert.equal(saved.run().length, 0, "personal rows still require login");

const stale = fixture();
stale.run();
const oldSnapshot = JSON.parse(stale.storage.get("snapshot"));
oldSnapshot.byUser.user.version = 5;
oldSnapshot.byUser.user.sections[0].title = "Old cluster-first snapshot";
stale.storage.set("snapshot", JSON.stringify(oldSnapshot));
assert.equal(stale.run()[0].seedPodcastKey, "seed-a");
assert.notEqual(stale.run()[0].title, "Old cluster-first snapshot");
console.log("Explore recommendation mix regression checks passed.");
