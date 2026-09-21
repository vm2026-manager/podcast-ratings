import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const app = await readFile(new URL("app.js", root), "utf8");
const migration = await readFile(
  new URL("supabase/migrations/20260921092820_add_public_rating_momentum_stats.sql", root),
  "utf8"
);

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const next = app.indexOf("\nfunction ", start + 1);
  return app.slice(start, next === -1 ? app.length : next);
}

const popularityScore = new Function(
  "parseNumber", "HOME_COMMUNITY_MIN_RATING",
  `${extractFunction("getHomeCommunityPopularityScore")}\nreturn getHomeCommunityPopularityScore;`
)(
  (value) => (Number.isFinite(Number(value)) ? Number(value) : null),
  6
);

const oldInactive = { averageRating: 8.7, ratingCount: 40, recentUsers7d: 0, recentUsers30d: 0, recentUsers90d: 0 };
const recentActive = { averageRating: 8.5, ratingCount: 18, recentUsers7d: 7, recentUsers30d: 7, recentUsers90d: 7 };
assert.ok(popularityScore(recentActive) > popularityScore(oldInactive), "recent activity can outrank slightly stronger inactive history");

const recent7 = popularityScore({ averageRating: 8, ratingCount: 4, recentUsers7d: 1, recentUsers30d: 1, recentUsers90d: 1 });
const recent30 = popularityScore({ averageRating: 8, ratingCount: 4, recentUsers7d: 0, recentUsers30d: 1, recentUsers90d: 1 });
const recent90 = popularityScore({ averageRating: 8, ratingCount: 4, recentUsers7d: 0, recentUsers30d: 0, recentUsers90d: 1 });
const old = popularityScore({ averageRating: 8, ratingCount: 4, recentUsers7d: 0, recentUsers30d: 0, recentUsers90d: 0 });
assert.ok(recent7 > recent30 && recent30 > recent90 && recent90 > old, "momentum decays across 7/30/90-day bands");
assert.ok(popularityScore({ averageRating: 10, ratingCount: 1, recentUsers7d: 1, recentUsers30d: 1, recentUsers90d: 1 }) < popularityScore(recentActive), "one recent user cannot dominate a broad active audience");

assert.match(migration, /group by er\.user_id, pe\.podcast_key/u, "episode rows reduce to one user/podcast rating");
assert.match(migration, /max\(coalesce\(er\.updated_at, er\.created_at\)\)/u, "episode activity uses newest per-user activity");
assert.match(migration, /coalesce\(d\.activity_at, e\.activity_at\)/u, "direct-rating precedence also applies to activity");
assert.match(migration, /recent_users_7d/u);
assert.match(migration, /recent_users_30d/u);
assert.match(migration, /recent_users_90d/u);
assert.match(migration, /momentum_score/u);

assert.match(app, /const HOME_POPULAR_CAROUSEL_POOL_LIMIT = 100;/u, "candidate pool removes the old top-20 bottleneck");
assert.match(extractFunction("renderHomePopular"), /isMobileHome \? 14 : 15/u, "mobile and desktop counts remain unchanged");
assert.match(extractFunction("selectHomeCommunityPopularCandidates"), /deprioritizeKeys/u, "hero podcasts remain de-prioritized");
assert.match(extractFunction("selectHomeCommunityPopularCandidates"), /getExploreShuffleSeed/u, "selection is deterministic within a rotation key");

const selectCandidates = new Function(
  "getExploreHourBucket", "HOME_ROTATION_TOP_LIMIT", "getHomeCommunityPopularCandidatePools",
  "getHourlyRotationSeed", "getExploreShuffleSeed", "getPodcastKey", "arrangeWithoutAdjacentMainSeries",
  `${extractFunction("selectHomeCommunityPopularCandidates")}\nreturn selectHomeCommunityPopularCandidates;`
)(
  () => "unused", 100, () => ({}),
  (_section, key) => String(key),
  (value) => {
    let hash = 2166136261;
    for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return hash >>> 0;
  },
  (podcast) => podcast.key,
  (items, _seed, { limit }) => items.slice(0, limit)
);
const pool = Array.from({ length: 120 }, (_, index) => ({
  podcast: { key: `podcast-${index}`, mainSeries: index % 5 === 0 ? `series-${index}` : "" },
  popularityScore: 0.15 + (120 - index) / 150,
  communityRating: 6 + (index % 40) / 10,
  communityRatingCount: 1 + (index % 8),
  candidateLevel: index % 3 === 0 ? "primary" : index % 3 === 1 ? "secondary" : "tertiary"
}));
const candidatePools = { primary: pool.filter((item) => item.candidateLevel === "primary"), secondary: pool.filter((item) => item.candidateLevel === "secondary"), tertiary: pool.filter((item) => item.candidateLevel === "tertiary") };
const first = selectCandidates(15, { hourKey: "2026-09-21", candidatePools, deprioritizeKeys: new Set(["podcast-0"]) });
const sameBucket = selectCandidates(15, { hourKey: "2026-09-21", candidatePools, deprioritizeKeys: new Set(["podcast-0"]) });
const nextBucket = selectCandidates(15, { hourKey: "2026-09-22", candidatePools, deprioritizeKeys: new Set(["podcast-0"]) });
assert.equal(first.length, 15, "desktop receives 15 items when the pool supports it");
assert.equal(selectCandidates(14, { hourKey: "2026-09-21", candidatePools }).length, 14, "mobile receives 14 items when the pool supports it");
assert.deepEqual(first.map((item) => item.podcast.key), sameBucket.map((item) => item.podcast.key), "same bucket is deterministic");
assert.notDeepEqual(first.map((item) => item.podcast.key), nextBucket.map((item) => item.podcast.key), "a new bucket meaningfully rotates the selection");
assert.ok(!first.some((item) => item.podcast.key === "podcast-0"), "hero podcasts stay de-prioritized while alternatives exist");

console.log("Homepage community momentum regression checks passed.");
