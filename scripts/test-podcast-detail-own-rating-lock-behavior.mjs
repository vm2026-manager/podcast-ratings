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
    this.attributes = new Map();
  }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  emit(type, event = {}) {
    const listener = this.listeners.get(type);
    return listener?.({ preventDefault() {}, stopPropagation() {}, target: this, ...event });
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  contains(node) { return node === this; }
  focus() { this.focusCalls += 1; }
}

class FakeRatingCell extends FakeElement {
  constructor() {
    super();
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      toggle: (name, force) => {
        const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        return shouldAdd;
      },
      contains: (name) => classes.has(name)
    };
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
      "data-podcast-detail-inline-rating-message",
      "data-podcast-detail-episode-rating-lock-trigger"
    ]) {
      if (value.includes(name)) {
        const node = new FakeElement();
        if (name === "data-podcast-detail-inline-rating-input") node.disabled = /\bdisabled\b/u.test(value);
        this.nodes.set(name, node);
      }
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
    (value) => Number(value).toFixed(1).replace(".", ","),
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

// Existing single and multiple episode ratings restore the historical muted, disabled control.
for (const [ratings, expected] of [
  [{ "episode-1": 7, "episode-2": null }, /7,0/u],
  [{ "episode-1": 7, "episode-2": 9 }, /8,0/u],
  [{ "episode-1": 7, "episode-2": 6.4, "episode-3": 7.5 }, /7,0/u]
]) {
  const h = createHarness({ eligible: true, ratings });
  h.helpers.updatePodcastDetailOwnRatingCell(h.dialog, h.podcast);
  assert.match(h.ratingCell.innerHTML, expected);
  assert.match(h.ratingCell.innerHTML, /Beregnet fra episoder/u);
  assert.match(h.ratingCell.innerHTML, /is-episode-calculated/u, "historical muted locked styling is applied");
  assert.match(h.ratingCell.innerHTML, /Din vurdering/u, "the own-rating label remains in the mobile markup");
  assert.match(h.ratingCell.innerHTML, /own-rating-suffix">\/10/u, "the derived score keeps its /10 suffix");
  assert.match(h.ratingCell.innerHTML, /podcast-detail-sheet__rating-icon/u, "the own-rating icon remains in the locked markup");
  assert.match(h.ratingCell.innerHTML, /role="tooltip"/u, "the locked state includes the keyboard-focusable explanation");
  assert.equal(h.ratingCell.querySelector("[data-podcast-detail-inline-rating-input]")?.disabled, true);
  assert.equal(h.ratingCell.querySelector("[data-podcast-detail-inline-rating-save]"), null);
  assert.equal(h.ratingCell.classList.contains("is-episode-rating-locked"), true, "only the locked cell receives mobile lock styling");
}

// On a coarse pointer, the locked surface is informational: it never opens an
// editor, but tapping it toggles the existing explanation for touch users.
{
  const originalMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    const h = createHarness({ eligible: true, ratings: { "episode-1": 7, "episode-2": 6.4, "episode-3": 7.5 } });
    h.helpers.updatePodcastDetailOwnRatingCell(h.dialog, h.podcast);
    const trigger = h.ratingCell.querySelector("[data-podcast-detail-episode-rating-lock-trigger]");
    assert.ok(trigger, "the historical info trigger remains available to touch users");
    h.ratingCell.emit("click");
    assert.equal(h.ratingCell.classList.contains("is-episode-rating-lock-open"), true, "a touch tap reveals the explanation");
    assert.equal(trigger.attributes.get("aria-expanded"), "true");
    h.ratingCell.emit("click");
    assert.equal(h.ratingCell.classList.contains("is-episode-rating-lock-open"), false, "a second tap dismisses the explanation");
    assert.equal(trigger.attributes.get("aria-expanded"), "false");
    assert.equal(h.ratingCell.querySelector("[data-podcast-detail-inline-rating-save]"), null, "touching a lock never exposes editing");
  } finally {
    if (originalMatchMedia === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = originalMatchMedia;
  }
}

// Fine-pointer/desktop activation keeps the established hover/focus tooltip
// behavior; it does not opt into the mobile in-flow toggle.
{
  const originalMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: false });
  try {
    const h = createHarness({ eligible: true, ratings: { "episode-1": 7 } });
    h.helpers.updatePodcastDetailOwnRatingCell(h.dialog, h.podcast);
    h.ratingCell.emit("click");
    assert.equal(h.ratingCell.classList.contains("is-episode-rating-lock-open"), false, "desktop clicks preserve the existing tooltip interaction");
  } finally {
    if (originalMatchMedia === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = originalMatchMedia;
  }
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
