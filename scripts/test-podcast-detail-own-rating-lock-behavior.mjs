import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("../app.js", import.meta.url));
const app = await readFile(appPath, "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const boundaries = [app.indexOf("\nfunction ", start + 1), app.indexOf("\nasync function ", start + 1)]
    .filter((index) => index >= 0);
  return app.slice(start, boundaries.length ? Math.min(...boundaries) : app.length);
}

const runtimeSource = [
  "getPodcastDetailEpisodeRatingState",
  "canEditPodcastDetailInlineRating",
  "getPodcastDetailOwnRatingMarkup",
  "bindPodcastDetailInlineRatingEvents",
  "updatePodcastDetailOwnRatingCell"
].map(extractFunction).join("\n");

class FakeElement {
  constructor() {
    this.listeners = new Map();
    this.isConnected = true;
    this.hidden = false;
    this.disabled = false;
    this.dataset = {};
    this.focusCalls = 0;
  }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  emit(type, event = {}) {
    const listener = this.listeners.get(type);
    return listener?.({ preventDefault() {}, stopPropagation() {}, ...event });
  }
  setAttribute() {}
  focus() { this.focusCalls += 1; }
}

class FakeRatingCell extends FakeElement {
  constructor() {
    super();
    this.classList = { add() {} };
    this.nodes = new Map();
    this._innerHTML = "";
  }
  set innerHTML(value) {
    this._innerHTML = value;
    this.nodes = new Map();
    for (const name of [
      "data-podcast-detail-inline-rating-input",
      "data-podcast-detail-inline-rating-reveal",
      "data-podcast-detail-inline-rating-save",
      "data-podcast-detail-inline-rating-message"
    ]) {
      if (value.includes(name)) this.nodes.set(name, new FakeElement());
    }
  }
  get innerHTML() { return this._innerHTML; }
  querySelector(selector) {
    return this.nodes.get(selector.slice(1, -1)) || null;
  }
}

function createHarness({ eligible = false, ratings = {}, manualRating = null, activeKey = "podcast-a" } = {}) {
  const episodeState = {
    items: [{ id: "episode-1" }, { id: "episode-2" }],
    eligibilityResolved: eligible,
    loading: false,
    userRatingsById: { ...ratings }
  };
  const state = { authUser: { id: "user-1" }, activePodcastDetailKey: activeKey, podcastDetailView: "detail" };
  const saveCalls = [];
  const helpers = new Function(
    "state", "podcastSupportsEpisodes", "getPodcastEpisodeState", "getEpisodeIdsForQuery",
    "getPodcastEpisodeUserRatingSummary", "getPodcastKey", "getUserRating", "formatCompactRating", "escapeHtml",
    "savePodcastDetailInlineRating",
    `${runtimeSource}; return { getPodcastDetailEpisodeRatingState, canEditPodcastDetailInlineRating, getPodcastDetailOwnRatingMarkup, updatePodcastDetailOwnRatingCell };`
  )(
    state,
    () => true,
    () => episodeState,
    (items) => items.map((item) => item.id),
    () => {
      const values = Object.values(episodeState.userRatingsById).filter((value) => value !== null && value !== undefined);
      return { count: values.length, average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null };
    },
    (podcast) => podcast.key,
    () => manualRating,
    (value) => Number(value).toFixed(1),
    (value) => String(value),
    async () => { saveCalls.push("save"); }
  );
  const ratingCell = new FakeRatingCell();
  const dialog = {
    isConnected: true,
    classList: { contains: () => false },
    querySelector: (selector) => selector === ".podcast-detail-sheet__rating-cell--own" ? ratingCell : null,
    cover: { id: "cover-node" },
    recommendations: { id: "recommendation-node" }
  };
  return { state, episodeState, helpers, dialog, ratingCell, saveCalls, podcast: { key: "podcast-a" } };
}

// Unresolved metadata is visibly non-editable and cannot expose a direct-save path.
{
  const h = createHarness();
  h.helpers.updatePodcastDetailOwnRatingCell(h.dialog, h.podcast);
  assert.match(h.ratingCell.innerHTML, /Indlæser episodevurderinger/u);
  assert.equal(h.ratingCell.querySelector("[data-podcast-detail-inline-rating-input]"), null);
  assert.equal(h.ratingCell.querySelector("[data-podcast-detail-inline-rating-save]"), null);
  assert.equal(h.dialog.cover.id, "cover-node");
  assert.equal(h.dialog.recommendations.id, "recommendation-node");
}

// A resolved zero-rating podcast remains editable; mouse/touch click and Enter share the real handler.
{
  const h = createHarness({ eligible: true, ratings: { "episode-1": null, "episode-2": null } });
  h.helpers.updatePodcastDetailOwnRatingCell(h.dialog, h.podcast);
  const reveal = h.ratingCell.querySelector("[data-podcast-detail-inline-rating-reveal]");
  const input = h.ratingCell.querySelector("[data-podcast-detail-inline-rating-input]");
  const save = h.ratingCell.querySelector("[data-podcast-detail-inline-rating-save]");
  assert.ok(reveal && input && save, "zero episode ratings exposes the direct editor");
  reveal.emit("click");
  assert.equal(input.focusCalls, 1, "pointer activation focuses the real input");
  await save.emit("click");
  await input.emit("keydown", { key: "Enter", isComposing: false, repeat: false });
  assert.deepEqual(h.saveCalls, ["save", "save"], "click/touch and keyboard paths call the same guarded save");
}

// Existing single and multiple episode ratings replace the controls with a derived, locked display.
for (const [ratings, expected] of [
  [{ "episode-1": 7, "episode-2": null }, /7\.0/u],
  [{ "episode-1": 7, "episode-2": 9 }, /8\.0/u]
]) {
  const h = createHarness({ eligible: true, ratings });
  h.helpers.updatePodcastDetailOwnRatingCell(h.dialog, h.podcast);
  assert.match(h.ratingCell.innerHTML, expected);
  assert.match(h.ratingCell.innerHTML, /Beregnet fra episoder/u);
  assert.equal(h.ratingCell.querySelector("[data-podcast-detail-inline-rating-input]"), null);
  assert.equal(h.ratingCell.querySelector("[data-podcast-detail-inline-rating-save]"), null);
}

// A stale control cannot save after async hydration locks the podcast; removal unlocks it again.
{
  const h = createHarness({ eligible: true, ratings: { "episode-1": null, "episode-2": null }, manualRating: 6 });
  h.helpers.updatePodcastDetailOwnRatingCell(h.dialog, h.podcast);
  const staleSave = h.ratingCell.querySelector("[data-podcast-detail-inline-rating-save]");
  h.episodeState.userRatingsById["episode-1"] = 8;
  h.helpers.updatePodcastDetailOwnRatingCell(h.dialog, h.podcast);
  await staleSave.emit("click");
  assert.deepEqual(h.saveCalls, [], "stale pointer/touch save is rejected after locking");
  h.episodeState.userRatingsById["episode-1"] = null;
  h.helpers.updatePodcastDetailOwnRatingCell(h.dialog, h.podcast);
  assert.ok(h.ratingCell.querySelector("[data-podcast-detail-inline-rating-input]"), "removing the final episode rating unlocks editing");
}

// Completion for another podcast or a closed dialog must not mutate the visible cell.
{
  const h = createHarness({ eligible: true, ratings: { "episode-1": null, "episode-2": null } });
  h.helpers.updatePodcastDetailOwnRatingCell(h.dialog, h.podcast);
  const before = h.ratingCell.innerHTML;
  h.state.activePodcastDetailKey = "podcast-b";
  h.helpers.updatePodcastDetailOwnRatingCell(h.dialog, h.podcast);
  assert.equal(h.ratingCell.innerHTML, before, "stale podcast completion is ignored");
}

console.log("Podcast detail own-rating lock behavioral checks passed.");
