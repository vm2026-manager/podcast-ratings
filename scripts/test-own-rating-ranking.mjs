import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const mobileCss = readFileSync(new URL("../mobile-layout-regressions.css", import.meta.url), "utf8");

function source(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const body = app.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = body; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}") depth -= 1;
    if (depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const activeRating = source("getPodcastRatingForActiveSource");
const effectiveOwnRating = source("getEffectiveOwnRatingForRanking");
const filtered = source("getFilteredPodcasts");
const context = source("setPodcastDetailRankingContext");
const sourceUi = source("updateRankingSourceUi");

assert.match(app, /const VALID_RANKING_SOURCES = new Set\(\["mads", "users", "mine"\]\)/u);
assert.match(html, /data-ranking-source="mine"[\s\S]*?Min vurdering/u);
assert.match(html, /data-ranking-own-sort="desc"[\s\S]*?Højeste vurdering/u);
assert.match(html, /data-ranking-own-sort="asc"[\s\S]*?Laveste vurdering/u);
assert.match(activeRating, /state\.rankingSource === "mine"/u);
assert.match(activeRating, /getEffectiveOwnRatingForRanking/u);
assert.match(effectiveOwnRating, /getDisplayGroupOwnRatingStats/u);
assert.match(effectiveOwnRating, /getUserRatingForPodcast/u);
assert.match(effectiveOwnRating, /!isLoggedIn\(\)/u);
assert.match(filtered, /state\.rankingSource === "mine" && getEffectiveOwnRatingForRanking\(podcast\) === null/u);
assert.match(filtered, /state\.minimumRating/u);
assert.match(filtered, /hasDesktopOwnRatingSort/u);
assert.match(filtered, /state\.ownRatingDirection === "asc"/u);
assert.match(context, /getFilteredPodcasts\(\)\.map/u);
assert.match(sourceUi, /button\.disabled = !isLoggedIn\(\)/u);
assert.match(app, /Du har ikke vurderet nogen podcasts endnu/u);
assert.match(mobileCss, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/u);
assert.match(app, /resolveCanonicalPodcastId/u);
assert.match(app, /getPodcastDetailEpisodeRatingState/u);

console.log("Own-rating ranking regressions passed.");
