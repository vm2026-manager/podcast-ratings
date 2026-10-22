import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../ranking-movement.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const movement = context.globalThis.PodcastRankingMovement;
const resolve = (key) => ({ "old-alias-a": "a", "old-alias-b": "b" }[key] || key);
const rank = (entries, field = "score") => movement.rankSequential(entries, (entry) => entry.key, (entry) => entry[field]);

for (const date of ["2026-10-22T12:00:00Z", "2026-10-26T23:59:59Z", "2026-10-27T03:16:59Z"]) {
  assert.deepEqual({ ...movement.getSnapshotBaseline(new Date(date)) }, {
    snapshotDate: "2026-10-20", periodLabel: "siden 20. oktober", mode: "initial"
  });
}
assert.deepEqual({ ...movement.getSnapshotBaseline(new Date("2026-10-27T03:17:00Z")) }, {
  snapshotDate: "2026-10-20", periodLabel: "de seneste 7 dage", mode: "seven-day"
});
assert.deepEqual({ ...movement.getSnapshotBaseline(new Date("2026-10-28T03:17:00Z")) }, {
  snapshotDate: "2026-10-21", periodLabel: "de seneste 7 dage", mode: "seven-day"
}, "once weekly mode begins, a missing future baseline must not fall back to 20 October");
assert.equal(movement.getSnapshotBaseline(new Date("invalid")), null);

const completeRows = [
  { snapshot_date: "2026-10-20", source: "users", podcast_key: "a", average_rating: 8.2, rating_count: 3 },
  { snapshot_date: "2026-10-20", source: "users", podcast_key: "b", average_rating: 8.1, rating_count: 1 }
];
assert.equal(movement.hasCompleteSnapshot(completeRows, 2, "2026-10-20"), true);
assert.equal(movement.hasCompleteSnapshot(completeRows.slice(0, 1), 2, "2026-10-20"), false, "partial baseline response fails closed");
assert.equal(movement.hasCompleteSnapshot([], 0, "2026-10-20"), false, "missing baseline fails closed");
assert.equal(movement.hasCompleteSnapshot(completeRows, 2, "2026-10-21"), false, "wrong-date baseline fails closed");
assert.equal(movement.hasCompleteSnapshot(completeRows.map((row) => ({ ...row, source: "mads" })), 2, "2026-10-20"), false);
assert.equal(movement.hasCompleteSnapshot([completeRows[0], completeRows[0]], 2, "2026-10-20"), false, "duplicate identity makes a snapshot incomplete");

const ties = rank([
  { key: "e", score: 8.9 }, { key: "d", score: 9.1 }, { key: "c", score: 9.1 },
  { key: "b", score: 9.3 }, { key: "a", score: 9.5 }
]);
assert.deepEqual(["a", "b", "c", "d", "e"].map((key) => ties.get(key)), [1, 2, 3, 4, 5]);
const equalTie = rank([{ key: "z", score: 8 }, { key: "a", score: 8 }]);
assert.equal(equalTie.get("a"), 1);
assert.equal(equalTie.get("z"), 2);
assert.equal(movement.displayScore(9.04), 9);
assert.equal(movement.displayScore(9.05), 9.1);

// Equal displayed one-decimal scores are ordered by their exact averages.
const precise = rank([{ key: "b", score: 9.149 }, { key: "a", score: 9.14 }]);
assert.equal(precise.get("b"), 1);
assert.equal(precise.get("a"), 2);
const movementPrecise = movement.movementMap(
  [{ key: "a", score: 9.14 }, { key: "b", score: 9.149 }],
  [{ podcast_key: "a", average_rating: 9.149, rating_count: 1 },
   { podcast_key: "b", average_rating: 9.14, rating_count: 1 }],
  { keyOf: (entry) => entry.key, scoreOf: (entry) => entry.score }
);
assert.equal(movementPrecise.get("a"), -1);
assert.equal(movementPrecise.get("b"), 1);

const current = [
  { key: "a", score: 9.5 }, { key: "new-high", score: 9.4 },
  { key: "b", score: 9.3 }, { key: "c", score: 9.1 }
];
const historical = [
  { snapshot_date: "2026-10-14", source: "users", podcast_key: "a", average_rating: 9.5, rating_count: 2 },
  { snapshot_date: "2026-10-14", source: "users", podcast_key: "old-alias-b", average_rating: 9.3, rating_count: 3 },
  { snapshot_date: "2026-10-14", source: "users", podcast_key: "c", average_rating: 9.1, rating_count: 1 },
  { snapshot_date: "2026-10-14", source: "users", podcast_key: "discontinued", average_rating: 9.4, rating_count: 1 }
];
const deltas = movement.movementMap(current, historical, {
  keyOf: (entry) => entry.key,
  scoreOf: (entry) => entry.score,
  resolveCanonicalKey: resolve
});
assert.equal(deltas.has("new-high"), false);
assert.equal(deltas.has("discontinued"), false);
assert.equal(deltas.get("b"), 0);
assert.equal(deltas.get("c"), 0);

// A new high scorer does not shift the common cohort; actual swaps do.
const withEntrant = movement.movementMap(
  [{ key: "a", score: 9.2 }, { key: "new-high", score: 10 }, { key: "b", score: 9.5 }, { key: "c", score: 9.1 }],
  [{ podcast_key: "a", average_rating: 9.5, rating_count: 1 },
   { podcast_key: "b", average_rating: 9.2, rating_count: 1 },
   { podcast_key: "c", average_rating: 9.1, rating_count: 1 },
   { podcast_key: "discontinued-high", average_rating: 20, rating_count: 1 }],
  { keyOf: (entry) => entry.key, scoreOf: (entry) => entry.score }
);
assert.equal(withEntrant.has("new-high"), false);
assert.equal(withEntrant.get("a"), -1);
assert.equal(withEntrant.get("b"), 1);
assert.equal(withEntrant.get("c"), 0);

const groupDelta = movement.movementMap(
  [{ key: "display-group:narkobetjenten", score: 9.2 }],
  [{ podcast_key: "display-group:narkobetjenten", average_rating: 9, rating_count: 8 }],
  { keyOf: (entry) => entry.key, scoreOf: (entry) => entry.score }
);
assert.equal(groupDelta.get("display-group:narkobetjenten"), 0);

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  let depth = 0;
  for (let index = start; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}
const getRankingDisplayRank = new Function(
  "state", `${extractFunction("getRankingDisplayRank")}; return getRankingDisplayRank;`
)({ rankingPositionMode: "dynamic" });
assert.deepEqual(Array.from({ length: 1300 }, (_, index) => getRankingDisplayRank(index)),
  Array.from({ length: 1300 }, (_, index) => index + 1));
assert.equal(getRankingDisplayRank(0), 1);
assert.equal(new Function("state", `${extractFunction("getRankingDisplayRank")}; return getRankingDisplayRank;`)({ rankingPositionMode: "fixed" })(0), null);

const getPodcastUserRank = new Function(
  "state", "getRankingMovementKey", "getPodcastKey",
  `${extractFunction("getPodcastUserRank")}; return getPodcastUserRank;`
)({ userRankByKey: { "display-group:narkobetjenten": 7 } },
  (podcast) => podcast.isDisplayGroup ? "display-group:narkobetjenten" : "",
  () => "narkobetjenten");
assert.equal(getPodcastUserRank({ isDisplayGroup: true }), 7, "synthetic groups use the same rank key as rank rebuilding");

const rebuildUserRanks = new Function(
  "state", "getRankingCandidates", "getRankingMovementKey", "getPodcastKey", "getCommunityStat", "window", "parseNumber",
  `${extractFunction("rebuildUserRanks")}; return rebuildUserRanks;`
);
const podcasts = [
  { key: "a", score: 9.14 }, { key: "b", score: 9.149 },
  { key: "z-tie", score: 8.5 }, { key: "a-tie", score: 8.5 }, { key: "lower", score: 8.4 }
];
const rankState = { userRankByKey: {} };
rebuildUserRanks(rankState, () => podcasts, (podcast) => podcast.key.startsWith("display-group:") ? podcast.key : "",
  (podcast) => podcast.key, (key) => ({ averageRating: podcasts.find((podcast) => podcast.key === key)?.score }), { PodcastRankingMovement: movement },
  (value) => Number.isFinite(Number(value)) ? Number(value) : null)();
assert.deepEqual(Object.entries(rankState.userRankByKey), [["b", 1], ["a", 2], ["a-tie", 3], ["z-tie", 4], ["lower", 5]]);

assert.equal(movement.compareSnapshotsToCurrent(current, historical, {
  expectedDate: "2026-10-14", historicalDate: "2026-10-13"
}).size, 0);
assert.equal(movement.compareSnapshotsToCurrent(current, historical, {
  expectedDate: "2026-10-14", historicalDate: "2026-10-14",
  keyOf: (entry) => entry.key, scoreOf: (entry) => entry.score, resolveCanonicalKey: resolve
}).size, 3);
assert.equal(movement.compareSnapshotsToCurrent(current, [], { expectedDate: "2026-10-14", historicalDate: "2026-10-14" }).size, 0);

const eligible = { route: "ranglister", source: "users", userSort: "rating", direction: "desc", sort: "placement-asc" };
assert.equal(movement.isEligible(eligible), true);
for (const blocked of [
  { source: "mads" }, { hasFilter: true }, { hasSearch: true }, { hasMinimumRating: true },
  { freeOnly: true }, { languageFilter: "danish" }, { ownRatingSort: true },
  { userSort: "count" }, { direction: "asc" }, { sort: "placement-desc" }
]) assert.equal(movement.isEligible({ ...eligible, ...blocked }), false);

console.log("ranking movement regressions: PASS");
