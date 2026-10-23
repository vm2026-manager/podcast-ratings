import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const app = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");
const indexHtml = await readFile(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const movementCss = await readFile(fileURLToPath(new URL("../ranking-movement.css", import.meta.url)), "utf8");

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  if (app.lastIndexOf("async ", start) === start - 6) start -= 6;
  assert.ok(start >= 0, `${name} must exist`);
  const openParen = app.indexOf("(", start);
  let parenDepth = 0;
  let quote = "";
  let escaped = false;
  let signatureEnd = -1;
  for (let index = openParen; index < app.length; index += 1) {
    const char = app[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
    if (char === "(") parenDepth += 1;
    if (char === ")" && --parenDepth === 0) { signatureEnd = index + 1; break; }
  }
  assert.ok(signatureEnd > 0, `${name} signature must close`);
  const bodyStart = app.indexOf("{", signatureEnd);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const state = {
  rankingMovementByKey: new Map(),
  rankingMovementPeriodLabel: "siden 20. oktober",
  rankingMovementSnapshotValid: true,
  rankingChangesOnly: false,
  rankingChangesOnlyRankByKey: new Map(),
  rankingPositionMode: "dynamic",
  visibleCount: 2,
  mobileRankingBatchLoading: false,
  mobileRankingObserverToken: 4,
  rankingSource: "users",
  communityStatsHasSuccessfulLoad: true,
  podcastDisplayGroupsReady: true
};
let eligible = true;
let resetCount = 0;
let renderCount = 0;
const podcasts = Array.from({ length: 200 }, (_, index) => ({ key: `podcast-${index + 1}` }));
podcasts.splice(7, 0, { isDisplayGroup: true, displayGroupId: "series" });
podcasts.splice(8, 0, { isDisplayGroup: true, displayGroupId: "series" });
const getKey = (podcast) => podcast?.isDisplayGroup ? `display-group:${podcast.displayGroupId}` : podcast?.key || "";
state.rankingMovementByKey = new Map([
  ["podcast-3", -6],
  ["display-group:series", 2],
  ["podcast-175", 19],
  ["leopold ii", 0],
  ["podcast-4", 0]
]);

const eligibleFn = () => eligible;
const countFn = new Function(
  "state", "isRankingMovementEligible", "getFilteredPodcasts", "getRankingMovementKey",
  `${extractFunction("getGenuineRankingMovementCount")}; return getGenuineRankingMovementCount;`
)(state, eligibleFn, () => podcasts, getKey);
const presentationFn = new Function(
  "state", "getFilteredPodcasts", "isRankingMovementEligible", "getGenuineRankingMovementCount", "getRankingMovementKey",
  `${extractFunction("getRankingPresentationPodcasts")}; return getRankingPresentationPodcasts;`
)(state, () => podcasts, eligibleFn, countFn, getKey);
const displayRankFn = new Function(
  "state", "getRankingMovementKey", `${extractFunction("getRankingDisplayRank")}; return getRankingDisplayRank;`
)(state, getKey);

assert.equal(countFn(), 3, "only finite nonzero movement map entries count");
const full = presentationFn();
assert.equal(full.length, podcasts.length, "normal ranking remains unfiltered automatically");
assert.equal(displayRankFn(176, podcasts[176]), 177);

// The removed toolbar preview must stay absent; genuine movements belong to
// their ranking rows in both the normal and optional changes-only views.
assert.doesNotMatch(app, /rankingMovementPreview|getRankingMovementPreviewItems|renderRankingMovementPreview/);
assert.doesNotMatch(indexHtml, /rankingMovementPreview|ranking-movement-preview/);
assert.doesNotMatch(movementCss, /ranking-movement-preview/);
assert.match(indexHtml, /id="rankingMovementToggle"[\s\S]*?Vis &#230;ndringer/, "the existing changes-only control remains in the toolbar");

const rankingPodcasts = Array.from({ length: 190 }, (_, index) => ({
  key: `podcast-${index + 1}`,
  title: `Podcast ${index + 1}`
}));
rankingPodcasts[171].title = "Jagten på det evige liv";
rankingPodcasts[172].title = "Livet ifølge Emil og Thomas";
rankingPodcasts.splice(7, 2, { isDisplayGroup: true, displayGroupId: "series", title: "Seriegruppe" }, { isDisplayGroup: true, displayGroupId: "series", title: "Duplicate series group" });
state.rankingChangesOnly = false;
state.rankingMovementSnapshotValid = true;
state.rankingMovementPeriodLabel = "siden 20. oktober";
state.rankingMovementByKey = new Map([
  ["podcast-172", 18],
  ["podcast-173", -1]
]);

const normalMovementMarkup = new Function(
  "state", "isRankingMovementEligible", "getRankingMovementKey", "getRankingMovementId", "escapeHtml",
  `${extractFunction("getRankingMovementMarkup")}; return getRankingMovementMarkup;`
)(state, eligibleFn, getKey, (podcast) => `movement-${getKey(podcast)}`, (value) => String(value));
const normalMovers = presentationFn(rankingPodcasts);
assert.equal(normalMovers.length, rankingPodcasts.length, "normal full ranking remains unfiltered when real movers are far down the list");
assert.match(normalMovementMarkup(rankingPodcasts[171]), /ranking-movement--up/);
assert.match(normalMovementMarkup(rankingPodcasts[171]), />▲18</, "the full normal ranking renders its real #172 arrow beside the row");
assert.match(normalMovementMarkup(rankingPodcasts[171]), /aria-label="Steget 18 placeringer siden 20\. oktober"/);
assert.match(normalMovementMarkup(rankingPodcasts[172]), />▼1</, "the full normal ranking renders its real #173 arrow beside the row");
assert.equal(displayRankFn(171, rankingPodcasts[171]), 172, "the normal full ranking preserves the mover's absolute #172 position");
state.rankingChangesOnly = true;
const filteredMovers = presentationFn(rankingPodcasts);
assert.deepEqual(filteredMovers.map(getKey), ["podcast-172", "podcast-173"], "the optional changes-only view retains both genuine movers");
assert.deepEqual(filteredMovers.map((podcast, index) => displayRankFn(index, podcast)), [172, 173], "filtered movements preserve their original absolute ranks");
assert.match(filteredMovers.map(normalMovementMarkup).join("\n"), />▲18[\s\S]*>▼1</, "both movement arrows remain attached to entries in changes-only mode");
state.rankingChangesOnly = false;
state.rankingMovementByKey = new Map([
  ["podcast-3", -6],
  ["display-group:series", 2],
  ["podcast-175", 19],
  ["leopold ii", 0],
  ["podcast-4", 0]
]);

state.rankingChangesOnly = true;
const changed = presentationFn();
assert.deepEqual(changed.map(getKey), ["podcast-3", "display-group:series", "podcast-175"], "changed rows retain original order and duplicate synthetic keys are shown once");
assert.equal(displayRankFn(2, changed[2]), 177, "the #177 mover keeps its full-list position");
assert.equal(displayRankFn(1, changed[1]), 8, "synthetic groups retain their original sequential rank");
assert.equal(changed.some((podcast) => getKey(podcast) === "leopold ii"), false, "zero-movement new entries stay hidden");
state.rankingPositionMode = "fixed";
assert.equal(displayRankFn(2, changed[2]), null, "fixed rank preference is preserved");
state.rankingPositionMode = "dynamic";

const movementButton = {
  hidden: false,
  disabled: false,
  textContent: "",
  attributes: {},
  setAttribute(name, value) { this.attributes[name] = value; }
};
const elements = {
  resultsText: { textContent: "" },
  rankingMovementToggle: movementButton
};
const syncToggle = new Function(
  "state", "elements", "getGenuineRankingMovementCount", "isRankingMovementEligible",
  `${extractFunction("syncRankingMovementToggle")}; return syncRankingMovementToggle;`
)(state, elements, countFn, eligibleFn);
const setResults = new Function(
  "state", "elements", "isRankingMovementEligible", "getGenuineRankingMovementCount", "syncRankingMovementToggle",
  `${extractFunction("setRankingResultsText")}; return setRankingResultsText;`
)(state, elements, eligibleFn, countFn, syncToggle);

state.rankingChangesOnly = false;
setResults("Viser 200 podcasts.");
assert.equal(movementButton.textContent, "Vis ændringer (3)");
assert.equal(movementButton.hidden, false);
assert.equal(movementButton.attributes["aria-pressed"], "false");
state.rankingChangesOnly = true;
setResults("Viser 3 podcasts.");
assert.equal(movementButton.textContent, "Vis alle");
assert.equal(movementButton.attributes["aria-pressed"], "true");
assert.match(elements.resultsText.textContent, /Viser kun podcasts med ændret placering/);

state.rankingMovementSnapshotValid = false;
setResults("Viser 200 podcasts.");
assert.equal(movementButton.hidden, true, "unknown historical data does not advertise a changes button");
assert.doesNotMatch(elements.resultsText.textContent, /Ingen placeringsændringer/);
assert.doesNotMatch(elements.resultsText.textContent, /har ændret placering/);
state.rankingMovementSnapshotValid = true;
state.rankingChangesOnly = false;
state.rankingMovementByKey = new Map();
setResults("Viser 200 podcasts.");
assert.equal(movementButton.hidden, true, "zero movement has no useless toggle");
assert.match(elements.resultsText.textContent, /Ingen placeringsændringer siden 20\. oktober/);

state.rankingMovementByKey = new Map([["podcast-3", -6], ["podcast-175", 19]]);
state.rankingChangesOnly = true;
eligible = false;
const incompatibleList = presentationFn();
assert.equal(incompatibleList.length, podcasts.length, "incompatible source, sorting, or filters restore the normal filtered list");
assert.equal(state.rankingChangesOnly, false, "changes-only mode cannot linger or reactivate after controls reset");
setResults("Viser 200 podcasts.");
assert.equal(movementButton.hidden, true);
eligible = true;

const toggleFn = new Function(
  "state", "isRankingMovementEligible", "getGenuineRankingMovementCount", "resetVisibleCount", "renderPodcastGrid",
  `${extractFunction("toggleRankingChangesOnly")}; return toggleRankingChangesOnly;`
)(state, eligibleFn, countFn, () => { resetCount += 1; }, () => { renderCount += 1; });
toggleFn();
assert.equal(state.rankingChangesOnly, true, "native button action enters changed-only view");
toggleFn();
assert.equal(state.rankingChangesOnly, false, "second activation restores all podcasts");
assert.equal(resetCount, 2);
assert.equal(renderCount, 2);

// Exercise the real mobile batch loader with a deterministic safe list. The
// appended third row is #177 in the full ranking, not #3 in the filtered view.
const batchState = { ...state, rankingChangesOnly: true, visibleCount: 2, mobileRankingBatchLoading: false, mobileRankingObserverToken: 4 };
batchState.rankingMovementSnapshotValid = true;
batchState.rankingMovementByKey = new Map([["podcast-3", -6], ["display-group:series", 2], ["podcast-175", 19]]);
const batchCountFn = new Function(
  "state", "isRankingMovementEligible", "getFilteredPodcasts", "getRankingMovementKey",
  `${extractFunction("getGenuineRankingMovementCount")}; return getGenuineRankingMovementCount;`
)(batchState, eligibleFn, () => podcasts, getKey);
const batchPresentationFn = new Function(
  "state", "getFilteredPodcasts", "isRankingMovementEligible", "getGenuineRankingMovementCount", "getRankingMovementKey",
  `${extractFunction("getRankingPresentationPodcasts")}; return getRankingPresentationPodcasts;`
)(batchState, () => podcasts, eligibleFn, batchCountFn, getKey);
const batchDisplayRankFn = new Function(
  "state", "getRankingMovementKey", `${extractFunction("getRankingDisplayRank")}; return getRankingDisplayRank;`
)(batchState, getKey);
const batchGrid = { querySelector: () => null, appendChild() {} };
let appended = [];
let batchRanks = [];
let mobileCards = 2;
const loadBatch = new Function(
  "state", "isRankingRoute", "elements", "getRankingPresentationPodcasts", "getRankingBatchSize", "updateLoadMoreUi", "setupMobileRankingAutoLoad", "disconnectMobileRankingObserver", "getMobileRankingCardCount", "appendRankingBatchItems", "getResultsText", "setRankingResultsText",
  `${extractFunction("loadNextMobileRankingBatch")}; return loadNextMobileRankingBatch;`
)(
  batchState,
  () => true,
  { podcastGrid: batchGrid, resultsText: { textContent: "" }, loadMoreButton: null },
  () => batchPresentationFn(),
  () => 2,
  () => {},
  () => {},
  () => {},
  () => mobileCards,
  (items, start) => {
    appended = items;
    batchRanks = items.map((podcast, index) => batchDisplayRankFn(start + index, podcast));
    mobileCards += items.length;
    return true;
  },
  () => "Viser ændrede podcasts",
  () => {}
);
assert.equal(loadBatch({ trigger: "button" }), true);
assert.deepEqual(appended.map(getKey), ["podcast-175"]);
assert.deepEqual(batchRanks, [177], "load more preserves absolute full-ranking position");

assert.match(app, /getRankingPresentationPodcasts\(\);\s*const isMobileTail/);
assert.match(app, /const filteredCount = getRankingPresentationPodcasts\(\)\.length/);
assert.match(app, /getRankingDisplayRank\(index, podcast\)/, "desktop list and card paths pass the podcast key when rendering ranks");
assert.match(app, /getRankingMovementMarkup\(podcast\)/, "normal rows continue to render automatic movement arrows");
assert.match(app, /rankingMovementToggle\?\.addEventListener\("click", toggleRankingChangesOnly\)/, "native keyboard-accessible button is wired to the toggle");

console.log("Ranking changes-only view regression checks passed.");
