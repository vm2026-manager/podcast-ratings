import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const mobileCss = await readFile(new URL("../mobile-layout-regressions.css", import.meta.url), "utf8");

function source(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const end = app.indexOf("\nfunction ", start + 1);
  return app.slice(start, end < 0 ? app.length : end);
}

const ownComparator = source("comparePodcastsByEffectiveOwnRating");
const desktopRenderer = source("renderDesktopRanking");
const filtered = source("getFilteredPodcasts");
const effectiveOwnRating = source("getEffectiveOwnRatingForRanking");

assert.match(app, /const VALID_RANKING_SOURCES = new Set\(\["mads", "users"\]\)/u);
assert.doesNotMatch(app, /rankingSource === "mine"/u);
assert.doesNotMatch(html, /data-ranking-source="mine"|data-ranking-own-sort/u);
assert.doesNotMatch(mobileCss, /page-ranglister[\s\S]*?ranking-source-toggle\s*\{\s*grid-template-columns:\s*repeat\(3/u);
assert.equal((html.match(/data-ranking-source=/gu) || []).length, 2, "mobile and desktop share exactly two source buttons");
assert.match(desktopRenderer, /data-ranking-own-direction-toggle/u);
assert.match(desktopRenderer, /aria-sort/u);
assert.match(filtered, /comparePodcastsByEffectiveOwnRating/u);
assert.match(effectiveOwnRating, /getDisplayGroupOwnRatingStats/u);
assert.match(effectiveOwnRating, /getUserRatingForPodcast/u);

const state = { ownRatingDirection: "desc", rankingSource: "users", sort: "placement-asc" };
const compareOwn = new Function(
  "state", "getEffectiveOwnRatingForRanking", "comparePodcastsByActiveRankingOrder",
  `${ownComparator}; return comparePodcastsByEffectiveOwnRating;`
)(
  state,
  (podcast) => podcast.own ?? null,
  (a, b) => a.placement - b.placement || a.title.localeCompare(b.title, "da")
);
const podcasts = [
  { title: "Åben", placement: 3, own: null },
  { title: "Episode-afledt", placement: 2, own: 6.6 },
  { title: "Legacy", placement: 1, own: 8 },
  { title: "Displaygruppe", placement: 4, own: 8 },
  { title: "Uden vurdering", placement: 5, own: null }
];
assert.deepEqual(
  [...podcasts].sort(compareOwn).map((podcast) => podcast.title),
  ["Legacy", "Displaygruppe", "Episode-afledt", "Åben", "Uden vurdering"],
  "first click is descending and never interprets an unrated value as zero"
);
state.ownRatingDirection = "asc";
assert.deepEqual(
  [...podcasts].sort(compareOwn).map((podcast) => podcast.title),
  ["Episode-afledt", "Legacy", "Displaygruppe", "Åben", "Uden vurdering"],
  "second click is ascending while unrated rows remain last"
);
assert.equal(state.rankingSource, "users", "own-column sort never changes Kilde");
state.rankingSource = "mads";
assert.equal(state.rankingSource, "mads", "own-column sort also preserves Podcastlisten");

console.log("Own-rating desktop-header ranking regressions passed.");
