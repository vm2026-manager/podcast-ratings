import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const app = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  if (app.lastIndexOf("async ", start) === start - 6) start -= 6;
  assert.ok(start >= 0, `${name} must exist`);
  let depth = 0;
  for (let index = start; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const isRankingMovementDataReady = extractFunction("isRankingMovementDataReady");
const loadRankingMovementSnapshot = extractFunction("loadRankingMovementSnapshot");
const state = {
  rankingMovementLoadAttempted: false,
  rankingMovementLoading: false,
  communityStatsHasSuccessfulLoad: false,
  podcastDisplayGroupsReady: false,
  rankingMovementByKey: new Map(),
  supabase: null
};
let historyQueries = 0;
let renders = 0;
state.supabase = {
  from(table) {
    assert.equal(table, "podcast_ranking_rating_snapshots");
    return {
      select() { return this; },
      eq() { return this; },
      limit(size) {
        assert.equal(size, 1000);
        historyQueries += 1;
        return Promise.resolve({
          data: [{
            snapshot_date: "2026-10-14", source: "users", podcast_key: "podcast-a",
            average_rating: 8.2, rating_count: 4
          }], error: null
        });
      }
    };
  }
};
const ready = new Function("state", `${isRankingMovementDataReady}; return isRankingMovementDataReady;`)(state);
const load = new Function(
  "state", "isRankingMovementDataReady", "isRankingMovementEligible", "window", "getUtcDateDaysAgo",
  "getRankingCandidates", "getRankingMovementKey", "getPodcastRatingForActiveSource", "getCommunityRatingCount",
  "resolveCanonicalPodcastId", "isRankingRoute", "renderPodcastGrid", "console",
  `${loadRankingMovementSnapshot}; return loadRankingMovementSnapshot;`
)(
  state,
  ready,
  () => true,
  { PodcastRankingMovement: { compareSnapshotsToCurrent: () => new Map([["podcast-a", 1]]) } },
  () => "2026-10-14",
  () => [{ id: "podcast-a" }],
  (podcast) => podcast.id,
  () => 8.4,
  () => 5,
  (key) => key,
  () => true,
  () => { renders += 1; },
  { warn() {} }
);

// Initial slow startup and a failed first community request must not spend the
// page's single historical read attempt or lock an empty comparison in memory.
await load();
assert.equal(historyQueries, 0);
assert.equal(state.rankingMovementLoadAttempted, false);
state.communityStatsStatus = "error";
await load();
assert.equal(historyQueries, 0);
assert.equal(state.rankingMovementLoadAttempted, false);

// Recovery is allowed once rating data and catalogue display groups are both
// hydrated. The snapshot is fetched once and subsequent renders reuse it.
state.communityStatsHasSuccessfulLoad = true;
await load();
assert.equal(historyQueries, 0, "display-group readiness also gates comparison");
state.podcastDisplayGroupsReady = true;
await load();
await load();
assert.equal(historyQueries, 1);
assert.equal(state.rankingMovementLoadAttempted, true);
assert.equal(state.rankingMovementByKey.get("podcast-a"), 1);
assert.equal(renders, 1);

console.log("Ranking movement hydration lifecycle regression tests passed.");
