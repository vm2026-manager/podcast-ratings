import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const end = app.indexOf("\nfunction ", start + 1);
  return app.slice(start, end === -1 ? undefined : end);
}

const heroSource = extractFunction("getHomeHeroPodcasts");
const topPodcastsSource = extractFunction("getPodcastlistenTopPodcasts");

assert.match(app, /const HOME_HERO_COVER_COUNT = 12;/u);
assert.match(app, /const HOME_HERO_POOL_LIMIT = 150;/u);
assert.match(app, /const HOME_ROTATION_TOP_LIMIT = 50;/u);
assert.match(heroSource, /limit = HOME_HERO_COVER_COUNT/u);
assert.match(heroSource, /getPodcastlistenTopPodcasts\(HOME_HERO_POOL_LIMIT\)/u);
assert.doesNotMatch(heroSource, /HOME_ROTATION_TOP_LIMIT/u);
assert.match(heroSource, /sectionKey: "home-editorial-hero"/u);
assert.match(heroSource, /avoidAdjacentMainSeries: true/u);
assert.match(heroSource, /circular: true/u);

assert.match(topPodcastsSource, /parseNumber\(podcast\.ratingValue\) !== null/u);
assert.match(topPodcastsSource, /Boolean\(podcast\.image\)/u);
assert.match(topPodcastsSource, /const seenKeys = new Set\(\)/u);
assert.match(topPodcastsSource, /localeCompare\(normalizeText\(b\.title\), "da"/u);
assert.doesNotMatch(topPodcastsSource, /HOME_HERO_POOL_LIMIT/u);

assert.match(app, /function getPodcastlistenTopPodcasts\(limit = HOME_ROTATION_TOP_LIMIT\)/u);
assert.match(app, /getHomeCommunityPopularCandidatePools\(HOME_ROTATION_TOP_LIMIT\)/u);
assert.match(app, /\.slice\(0, HOME_ROTATION_TOP_LIMIT\)/u);

const candidates = Array.from({ length: 150 }, (_, index) => ({ key: `podcast-${index}` }));
const calls = [];
const selectRotatingItems = (items, count, options) => {
  calls.push({ items, count, options });
  return items.slice(0, count);
};
const getCandidates = limit => {
  calls.push({ poolLimit: limit });
  return candidates;
};
const getHomeHeroPodcasts = new Function(
  "getExploreHourBucket",
  "HOME_HERO_COVER_COUNT",
  "HOME_HERO_POOL_LIMIT",
  "getPodcastlistenTopPodcasts",
  "selectRotatingItems",
  `${heroSource}\nreturn getHomeHeroPodcasts;`
)(
  () => "fallback-hour",
  12,
  150,
  getCandidates,
  selectRotatingItems
);

const first = getHomeHeroPodcasts("2026-09-21T10");
const second = getHomeHeroPodcasts("2026-09-21T10");

assert.equal(calls[0].poolLimit, 150);
assert.equal(calls[1].count, 12);
assert.equal(first.length, 12);
assert.deepEqual(first, second);
assert.equal(calls[1].options.sectionKey, "home-editorial-hero");
assert.equal(calls[1].options.hourKey, "2026-09-21T10");
assert.equal(calls[1].options.avoidAdjacentMainSeries, true);
assert.equal(calls[1].options.circular, true);

assert.match(app, /Array\.from\(\s*\{ length: HOME_HERO_COVER_COUNT \}/u);

console.log("Homepage hero pool regressions passed.");
