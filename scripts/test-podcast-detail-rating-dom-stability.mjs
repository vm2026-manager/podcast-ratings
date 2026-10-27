import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const bodyStart = app.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const refresh = extractFunction("refreshOpenPodcastDetailSheet");
const ratingUpdater = extractFunction("updatePodcastDetailRatingSummary");
assert.match(refresh, /updatePodcastDetailRatingSummary\(dialog, podcast\)/u);
assert.doesNotMatch(refresh, /renderPodcastDetailSheetContent\(dialog, podcast\)/u);
assert.match(refresh, /updatePodcastDisplayGroupRatingCells\(dialog, podcast\)/u);
assert.match(refresh, /updatePodcastDisplayGroupSeasonRows\(dialog, podcast\)/u);
assert.match(refresh, /updatePodcastEpisodeOverview\(dialog\)/u);

class TextNode {
  constructor(value) { this.nodeType = 3; this.nodeValue = value; }
}

class ValueNode {
  constructor(value) {
    this.childNodes = [new TextNode(value), { nodeType: 1, textContent: "/10" }];
  }
  get firstChild() { return this.childNodes[0]; }
  insertBefore(node, before) { this.childNodes.splice(this.childNodes.indexOf(before), 0, node); }
}

class Cell {
  constructor() { this.innerHTML = "original"; this.textContent = ""; this.hidden = false; this.classes = new Set(); }
  classList = {
    toggle: (name, force) => force ? this.classes.add(name) : this.classes.delete(name),
    remove: (name) => this.classes.delete(name)
  };
}

const madsValue = new ValueNode("7,4");
const usersValue = new ValueNode("8,1");
const userCount = new Cell();
const ownCell = new Cell();
const mobileHelp = new Cell();
const recommendations = { id: "recommendation-container" };
const recommendationTrack = { id: "recommendation-track", scrollLeft: 184 };
const cards = [{ id: "recommended-card-1" }, { id: "recommended-card-2" }];
const covers = [{ id: "cover-1" }, { id: "cover-2" }];
const detailCover = { id: "podcast-cover" };
const content = { scrollTop: 237, scrollLeft: 11, scrollTo() { assert.fail("rating refresh must preserve detail scroll without scrolling"); } };
const elements = new Map([
  ["[data-podcast-detail-content]", content],
  [".podcast-detail-sheet__rating-cell--mads strong", madsValue],
  [".podcast-detail-sheet__rating-cell--users strong", usersValue],
  [".podcast-detail-sheet__rating-cell--users em", userCount],
  [".podcast-detail-sheet__rating-cell--own", ownCell],
  ["[data-podcast-detail-episode-rating-mobile-help]", mobileHelp]
]);
const dialog = {
  isConnected: true,
  classList: { contains: () => false },
  querySelector: (selector) => elements.get(selector) || null,
  recommendationContainer: recommendations,
  recommendationTrack,
  recommendationCards: cards,
  coverNodes: covers,
  detailCover
};
const state = {
  activePodcastDetailKey: "show-a",
  podcastDetailView: "detail",
  communityStatsStatus: "ready",
  communityStatsHasSuccessfulLoad: true
};
const podcast = { key: "show-a" };
let ownRatingUpdates = 0;
let controlUpdates = 0;
const detailRating = new Function(
  "dialog", "podcast", "state", "Node", "document", "getPodcastKey", "getPodcastDetailRatingData",
  "formatUserRatingCount", "updatePodcastDetailOwnRatingCell", "updatePodcastRatingControls",
  `${ratingUpdater}; return updatePodcastDetailRatingSummary;`
)(
  dialog,
  podcast,
  state,
  { TEXT_NODE: 3 },
  { createTextNode: (value) => new TextNode(value) },
  (value) => value.key,
  () => ({ mads: "7,5", users: "8,3", userCount: 42 }),
  (count) => `${count} brugervurderinger`,
  () => { ownRatingUpdates += 1; },
  () => { controlUpdates += 1; }
);
const identitiesBefore = {
  recommendations: dialog.recommendationContainer,
  recommendationTrack,
  cards: [...dialog.recommendationCards],
  covers: [...dialog.coverNodes],
  detailCover: dialog.detailCover,
  content
};
detailRating(dialog, podcast);

assert.equal(madsValue.childNodes[0].nodeValue, "7,5", "editorial rating updates in place");
assert.equal(usersValue.childNodes[0].nodeValue, "8,3", "community average updates in place");
assert.equal(userCount.textContent, "42 brugervurderinger", "community rating count updates");
assert.equal(ownRatingUpdates, 1, "own rating cell updates through its existing helper");
assert.equal(controlUpdates, 1, "rating controls update after the save");
assert.strictEqual(dialog.recommendationContainer, identitiesBefore.recommendations, "recommendation container identity remains stable");
assert.strictEqual(dialog.recommendationTrack, identitiesBefore.recommendationTrack, "recommendation track identity remains stable");
assert.equal(recommendationTrack.scrollLeft, 184, "recommendation horizontal scroll position remains stable");
assert.deepEqual(dialog.recommendationCards, identitiesBefore.cards, "recommendation card identities remain stable");
assert.deepEqual(dialog.coverNodes, identitiesBefore.covers, "recommendation image identities remain stable");
assert.strictEqual(dialog.detailCover, identitiesBefore.detailCover, "main cover identity remains stable");
assert.strictEqual(dialog.querySelector("[data-podcast-detail-content]"), identitiesBefore.content, "detail content identity remains stable");
assert.equal(content.scrollTop, 237, "detail vertical scroll position remains stable");
assert.equal(content.scrollLeft, 11, "detail horizontal scroll position remains stable");

console.log("Podcast detail rating DOM-stability regression checks passed.");
