import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const app = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");

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

// The above-the-fold preview derives real examples from full sorted ranking data.
const previewPodcasts = Array.from({ length: 190 }, (_, index) => ({
  key: `podcast-${index + 1}`,
  title: `Podcast ${index + 1}`
}));
previewPodcasts[171].title = "Jagten på det evige liv";
previewPodcasts[172].title = "Livet ifølge Emil og Thomas";
previewPodcasts[174].title = "Stærkeste fald";
previewPodcasts.splice(7, 2, { isDisplayGroup: true, displayGroupId: "series", title: "Seriegruppe" }, { isDisplayGroup: true, displayGroupId: "series", title: "Duplicate series group" });
state.rankingChangesOnly = false;
state.rankingMovementSnapshotValid = true;
state.rankingMovementPeriodLabel = "siden 20. oktober";
state.rankingMovementByKey = new Map([
  ["podcast-172", 18],
  ["podcast-173", -1],
  ["podcast-175", -3],
  ["podcast-4", 2],
  ["display-group:series", 1]
]);
const previewFn = new Function(
  "state", "getFilteredPodcasts", "getRankingMovementKey", "isRankingMovementEligible",
  `${extractFunction("getRankingMovementPreviewItems")}; return getRankingMovementPreviewItems;`
)(state, () => previewPodcasts, getKey, eligibleFn);
let previewItems = previewFn(previewPodcasts);
assert.deepEqual(previewItems.map((item) => [item.rank, item.delta]), [[172, 18], [175, -3]], "preview uses strongest real gain and fall, ordered by original rank");
assert.equal(previewItems[0].podcast.title, "Jagten på det evige liv");
state.rankingMovementByKey = new Map([["podcast-172", 18], ["podcast-4", 2], ["display-group:series", 1]]);
previewItems = previewFn(previewPodcasts);
assert.deepEqual(previewItems.map((item) => [item.rank, item.delta]), [[4, 2], [172, 18]], "one-direction movement falls back to the two strongest genuine movers");
assert.equal(previewItems.filter((item) => getKey(item.podcast) === "display-group:series").length, 0, "preview does not use a weaker duplicate display-group example");
state.rankingMovementByKey = new Map([["display-group:series", 1]]);
assert.deepEqual(previewFn(previewPodcasts).map((item) => item.rank), [8], "duplicate synthetic groups produce only one preview example at the first group's original rank");
state.rankingMovementSnapshotValid = false;
assert.deepEqual(previewFn(previewPodcasts), [], "missing historical data never creates a preview");
state.rankingMovementSnapshotValid = true;
state.rankingMovementByKey = new Map([["podcast-172", 0]]);
assert.deepEqual(previewFn(previewPodcasts), [], "zero movement never creates a preview");
state.rankingMovementByKey = new Map([["podcast-172", 18]]);
eligible = false;
assert.deepEqual(previewFn(previewPodcasts), [], "editorial or incompatible ranking controls never create a preview");
eligible = true;
state.rankingChangesOnly = true;
assert.deepEqual(previewFn(previewPodcasts), [], "preview is hidden when the optional changes-only view is active");
state.rankingChangesOnly = false;
state.rankingMovementByKey = new Map([["podcast-172", 18], ["podcast-175", -3]]);

const previewElement = { hidden: true, innerHTML: "", replaceChildren() { this.cleared = true; } };
const renderPreview = new Function(
  "state", "elements", "getRankingMovementPreviewItems", "getFilteredPodcasts", "escapeHtml",
  `${extractFunction("renderRankingMovementPreview")}; return renderRankingMovementPreview;`
)(state, { rankingMovementPreview: previewElement }, previewFn, () => previewPodcasts, (value) => String(value));
renderPreview(previewPodcasts);
assert.equal(previewElement.hidden, false, "valid genuine movements render automatically");
assert.match(previewElement.innerHTML, /ranking-movement--up/);
assert.match(previewElement.innerHTML, /ranking-movement--down/);
assert.match(previewElement.innerHTML, /#172/);
assert.match(previewElement.innerHTML, /siden 20\. oktober/);
assert.match(previewElement.innerHTML, /Jagten på det evige liv/);
assert.match(previewElement.innerHTML, /aria-label="Steget 18 placeringer for Jagten på det evige liv, nu nummer 172 siden 20\. oktober"/);

const normalMovementMarkup = new Function(
  "state", "isRankingMovementEligible", "getRankingMovementKey", "getRankingMovementId", "escapeHtml",
  `${extractFunction("getRankingMovementMarkup")}; return getRankingMovementMarkup;`
)(state, eligibleFn, getKey, (podcast) => `movement-${getKey(podcast)}`, (value) => String(value));
assert.match(normalMovementMarkup(previewPodcasts[171]), /ranking-movement--up/);
assert.match(normalMovementMarkup(previewPodcasts[171]), />▲18</, "automatic full-list arrows remain rendered outside the preview");
assert.equal(displayRankFn(171, previewPodcasts[171]), 172, "the normal full ranking keeps the mover at #172 while the preview is displayed");
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
  "state", "elements", "isRankingMovementEligible", "getGenuineRankingMovementCount", "syncRankingMovementToggle", "renderRankingMovementPreview",
  `${extractFunction("setRankingResultsText")}; return setRankingResultsText;`
)(state, elements, eligibleFn, countFn, syncToggle, () => {});

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
