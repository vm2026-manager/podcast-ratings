import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const desktopHomeCss = readFileSync(new URL("../desktop-home-mockup.css", import.meta.url), "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is present`);
  const bodyStart = app.indexOf(") {", start) + 2;
  assert.notEqual(bodyStart, 1, `${name} has a function body`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}") depth -= 1;
    if (depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const favoriteState = extractFunction("setFavoriteButtonState");
const popularCard = extractFunction("createHomePopularCardElement");
const popularRender = extractFunction("renderHomePopular");
const heroUpdate = extractFunction("updateHomeHeroCovers");
const rankingContext = extractFunction("setPodcastDetailRankingContext");
const rankingNavigation = extractFunction("navigatePodcastDetailRanking");
const swipe = extractFunction("initPodcastDetailRankingSwipe");

assert.match(favoriteState, /podcast-detail-sheet__header-favorite/u);
assert.match(favoriteState, /"Fjern fra gemte" : "Gem til senere"/u);
assert.match(favoriteState, /button\.title = detailHeaderActionLabel/u);
assert.match(favoriteState, /button\.dataset\.tooltip = detailHeaderActionLabel/u);
assert.match(favoriteState, /button\.setAttribute\(\s*"aria-label"/u);
assert.match(app, /podcast-detail-sheet__header-link[^`]*aria-label="Link til podcasten" title="Link til podcasten" data-tooltip="Link til podcasten"/u);
assert.match(app, /podcast-detail-sheet__header-favorite[^`]*aria-label="Gem til senere" title="Gem til senere" data-tooltip="Gem til senere"/u);
assert.match(desktopHomeCss, /header-link::after,\s*\n\s*html body #podcastDetailSheet \.podcast-detail-sheet__header-favorite::after/u);
assert.match(desktopHomeCss, /header-favorite:hover::after/u);

assert.match(heroUpdate, /state\.homeHeroNavigationKeys = podcasts\.map\(getPodcastKey\)\.filter\(Boolean\)/u);
assert.match(app, /navigationKeys: state\.homeHeroNavigationKeys/u);
assert.match(app, /const HOME_HERO_COVER_COUNT = 12;/u);
assert.match(app, /const HOME_HERO_POOL_LIMIT = 150;/u);

assert.match(popularRender, /const navigationKeys = popular\.map\(\(candidate\) => getPodcastKey\(candidate\.podcast\)\)\.filter\(Boolean\)/u);
assert.match(popularRender, /candidateLevel: candidate\.candidateLevel,\s*\n\s*navigationKeys/u);
assert.match(popularCard, /navigationKeys: options\.navigationKeys/u);
assert.doesNotMatch(popularCard, /getHomeCommunityPopularSelection/u);

assert.match(rankingContext, /const isRankingRoute = getRouteInfoFromHash\(\)\.route === "ranglister"/u);
assert.match(rankingContext, /getFilteredPodcasts\(\)\.map/u);
assert.match(rankingNavigation, /state\.podcastDetailRankingKeys\[nextIndex\]/u);
assert.match(swipe, /navigatePodcastDetailRanking\(deltaX < 0 \? 1 : -1\)/u);
assert.match(swipe, /event\.target\.closest\("button, a, input, select, textarea, \[data-action\]"\)/u);
assert.match(swipe, /Math\.abs\(deltaX\) < Math\.abs\(deltaY\) \* 1\.35/u);

console.log("Homepage modal source-navigation regressions passed.");
