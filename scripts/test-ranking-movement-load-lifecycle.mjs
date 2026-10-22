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
const setRankingResultsText = extractFunction("setRankingResultsText");
const getRankingMovementMarkup = extractFunction("getRankingMovementMarkup");
const getRankingMovementId = extractFunction("getRankingMovementId");

const state = {
  rankingMovementLoadAttempted: false,
  rankingMovementLoading: false,
  rankingMovementPeriodLabel: "",
  rankingMovementSnapshotValid: false,
  communityStatsHasSuccessfulLoad: false,
  podcastDisplayGroupsReady: false,
  rankingMovementByKey: new Map(),
  supabase: null
};
let historyQueries = 0;
let renders = 0;
let selectedDate = "";
let baseline = { snapshotDate: "2026-10-20", periodLabel: "siden 20. oktober", mode: "initial" };
let response = {
  data: [{ snapshot_date: "2026-10-20", source: "users", podcast_key: "podcast-a", average_rating: 8.2, rating_count: 4 }],
  count: 1,
  error: null
};
state.supabase = {
  from(table) {
    assert.equal(table, "podcast_ranking_rating_snapshots");
    return {
      select(columns, options) {
        assert.equal(columns, "snapshot_date,source,podcast_key,average_rating,rating_count");
        assert.deepEqual(options, { count: "exact" });
        return this;
      },
      eq(column, value) {
        if (column === "snapshot_date") selectedDate = value;
        if (column === "source") assert.equal(value, "users");
        return this;
      },
      limit(size) {
        assert.equal(size, 1000);
        historyQueries += 1;
        return Promise.resolve(response);
      }
    };
  }
};
const ready = new Function("state", `${isRankingMovementDataReady}; return isRankingMovementDataReady;`)(state);
const movementApi = {
  getSnapshotBaseline: () => baseline,
  hasCompleteSnapshot(rows, count, date) {
    return rows.length > 0 && rows.length === count && rows.every((row) => row.snapshot_date === date && row.source === "users");
  },
  compareSnapshotsToCurrent(current, rows, options) {
    assert.equal(options.expectedDate, baseline.snapshotDate);
    assert.equal(options.historicalDate, baseline.snapshotDate);
    assert.equal(rows.length, 1);
    assert.equal(current[0].averageRating, 8.4);
    return new Map([["podcast-a", 1]]);
  }
};
const load = new Function(
  "state", "isRankingMovementDataReady", "isRankingMovementEligible", "window",
  "getRankingCandidates", "getRankingMovementKey", "getRankingMovementFirstListedAt", "isVerifiedNewRankingListing",
  "getPodcastRatingForActiveSource", "getCommunityRatingCount",
  "resolveCanonicalPodcastId", "isRankingRoute", "renderPodcastGrid", "console",
  `${loadRankingMovementSnapshot}; return loadRankingMovementSnapshot;`
)(
  state,
  ready,
  () => true,
  { PodcastRankingMovement: movementApi },
  () => [{ id: "podcast-a" }],
  (podcast) => podcast.id,
  () => null,
  () => false,
  () => 8.4,
  () => 5,
  (key) => key,
  () => true,
  () => { renders += 1; },
  { warn() {} }
);

// A slow or failed community-stat load must not use the one history request.
await load();
assert.equal(historyQueries, 0);
assert.equal(state.rankingMovementLoadAttempted, false);
state.communityStatsStatus = "error";
await load();
assert.equal(historyQueries, 0);
assert.equal(state.rankingMovementLoadAttempted, false);

// The initial comparison reads the verified 20 October snapshot only once.
state.communityStatsHasSuccessfulLoad = true;
await load();
assert.equal(historyQueries, 0, "display-group readiness also gates comparison");
state.podcastDisplayGroupsReady = true;
await load();
await load();
assert.equal(historyQueries, 1);
assert.equal(selectedDate, "2026-10-20");
assert.equal(state.rankingMovementLoadAttempted, true);
assert.equal(state.rankingMovementPeriodLabel, "siden 20. oktober");
assert.equal(state.rankingMovementSnapshotValid, true);
assert.equal(state.rankingMovementByKey.get("podcast-a"), 1);
assert.equal(renders, 1);

const movementMarkup = new Function(
  "state", "isRankingMovementEligible", "getRankingMovementKey", "getRankingMovementId", "escapeHtml",
  `${getRankingMovementMarkup}; return getRankingMovementMarkup;`
)(state, () => true, () => "podcast-a", () => "movement-podcast-a", (value) => value);
const upMarkup = movementMarkup({});
assert.match(upMarkup, /Steget 1 placering siden 20\. oktober/);
assert.match(upMarkup, /title="Steget 1 placering siden 20\. oktober"/);
state.rankingMovementByKey.set("podcast-a", -11);
assert.match(movementMarkup({}), /Faldet 11 placeringer siden 20\. oktober/);
state.rankingMovementByKey.set("podcast-a", 0);
const steadyMarkup = movementMarkup({});
assert.equal(steadyMarkup, "", "unchanged positions have no dash or movement marker");
const movementId = new Function(
  "state", "isRankingMovementEligible", "getRankingMovementKey",
  `${getRankingMovementId}; return getRankingMovementId;`
)(state, () => true, () => "podcast-a");
assert.equal(movementId({}), "", "unchanged positions do not create dangling aria-describedby IDs");

// The visible ranking note and assistive labels use the same period wording.
const resultsElement = { textContent: "" };
const setResults = new Function(
  "state", "elements", "isRankingMovementEligible", "getGenuineRankingMovementCount", "syncRankingMovementToggle",
  `${setRankingResultsText}; return setRankingResultsText;`
)(state, { resultsText: resultsElement, rankingMovementToggle: null }, () => true,
  () => [...state.rankingMovementByKey.values()].filter((delta) => Number.isFinite(delta) && delta !== 0).length,
  () => {});
setResults("Viser 18 af 263 podcasts");
assert.equal(resultsElement.textContent, "Viser 18 af 263 podcasts · Ingen placeringsændringer siden 20. oktober");
state.rankingMovementByKey = new Map([["a", 1], ["b", 0], ["c", -11]]);
setResults("Viser 18 af 263 podcasts");
assert.equal(resultsElement.textContent, "Viser 18 af 263 podcasts · 2 podcasts har ændret placering siden 20. oktober");
state.rankingMovementByKey = new Map();
setResults("Viser 18 af 263 podcasts");
assert.equal(resultsElement.textContent, "Viser 18 af 263 podcasts · Ingen placeringsændringer siden 20. oktober", "a valid empty cohort is a genuine zero-movement result");
state.rankingMovementPeriodLabel = "de seneste 7 dage";
state.rankingMovementByKey = new Map([["a", 2]]);
setResults("Viser 18 af 263 podcasts");
assert.equal(resultsElement.textContent, "Viser 18 af 263 podcasts · 1 podcast har ændret placering de seneste 7 dage");
state.rankingMovementPeriodLabel = "siden 20. oktober";
state.rankingMovementByKey = new Map();
const ineligibleResults = new Function(
  "state", "elements", "isRankingMovementEligible", "getGenuineRankingMovementCount", "syncRankingMovementToggle",
  `${setRankingResultsText}; return setRankingResultsText;`
)(state, { resultsText: resultsElement, rankingMovementToggle: null }, () => false, () => 0, () => {});
ineligibleResults("Viser 18 af 263 podcasts");
assert.equal(resultsElement.textContent, "Viser 18 af 263 podcasts", "editorial or filtered rankings do not show the user-ranking status");
state.rankingMovementByKey = new Map([["a", 1]]);
state.rankingMovementSnapshotValid = false;
setResults("Viser 18 af 263 podcasts");
assert.equal(resultsElement.textContent, "Viser 18 af 263 podcasts", "missing history is not presented as zero movement");
state.rankingMovementSnapshotValid = true;

// A later date selects exactly seven UTC calendar days prior. Missing or
// partial history is not replaced with the initial snapshot.
async function resetPageLoad(nextBaseline, nextResponse) {
  baseline = nextBaseline;
  response = nextResponse;
  state.rankingMovementLoadAttempted = false;
  state.rankingMovementSnapshotValid = false;
  state.rankingMovementPeriodLabel = "stale label";
  state.rankingMovementByKey = new Map([["stale", 99]]);
  await load();
}
baseline = { snapshotDate: "2026-10-21", periodLabel: "de seneste 7 dage", mode: "seven-day" };
response = { data: [], count: 0, error: null };
await resetPageLoad(baseline, response);
assert.equal(selectedDate, "2026-10-21");
assert.equal(state.rankingMovementByKey.size, 0);
assert.equal(state.rankingMovementPeriodLabel, "");
assert.equal(state.rankingMovementSnapshotValid, false);

response = {
  data: [{ snapshot_date: "2026-10-21", source: "users", podcast_key: "podcast-a", average_rating: 8.2, rating_count: 4 }],
  count: 2,
  error: null
};
await resetPageLoad(baseline, response);
assert.equal(selectedDate, "2026-10-21");
assert.equal(state.rankingMovementByKey.size, 0, "partial baseline fails closed");
assert.equal(state.rankingMovementPeriodLabel, "");
assert.equal(state.rankingMovementSnapshotValid, false);
assert.equal(historyQueries, 3, "one bounded query per eligible page load");

console.log("Ranking movement baseline and hydration lifecycle regression tests passed.");
