import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../ranking-movement.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const movement = context.globalThis.PodcastRankingMovement;
const resolve = (key) => ({ "old-alias-a": "a", "old-alias-b": "b" }[key] || key);
const rank = (entries, field = "score") => movement.rankCompetition(entries, (entry) => entry.key, (entry) => entry[field]);

const ties = rank([
  { key: "a", score: 9.5 }, { key: "b", score: 9.3 }, { key: "c", score: 9.1 },
  { key: "d", score: 9.1 }, { key: "e", score: 8.9 }
]);
assert.deepEqual(["a", "b", "c", "d", "e"].map((key) => ties.get(key)), [1, 2, 3, 3, 5]);
assert.equal(movement.displayScore(9.04), 9);
assert.equal(movement.displayScore(9.05), 9.1);

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

const overtakes = movement.movementMap(
  [{ key: "a", score: 9.2 }, { key: "b", score: 9.5 }, { key: "c", score: 9.1 }],
  [{ podcast_key: "a", average_rating: 9.5, rating_count: 1 },
   { podcast_key: "b", average_rating: 9.2, rating_count: 1 },
   { podcast_key: "c", average_rating: 9.1, rating_count: 1 }],
  { keyOf: (entry) => entry.key, scoreOf: (entry) => entry.score }
);
assert.equal(overtakes.get("a"), -1);
assert.equal(overtakes.get("b"), 1);
assert.equal(overtakes.get("c"), 0);

const groupDelta = movement.movementMap(
  [{ key: "display-group:narkobetjenten", score: 9.2 }],
  [{ podcast_key: "display-group:narkobetjenten", average_rating: 9, rating_count: 8 }],
  { keyOf: (entry) => entry.key, scoreOf: (entry) => entry.score }
);
assert.equal(groupDelta.get("display-group:narkobetjenten"), 0);
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
