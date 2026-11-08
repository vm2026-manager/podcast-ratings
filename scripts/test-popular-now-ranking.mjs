import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const read = (path) => readFile(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
const [app, index, css, sql] = await Promise.all([
  read("app.js"),
  read("index.html"),
  read("style.css"),
  read("supabase/migrations/20261014113719_renew_positive_episode_popularity_activity.sql")
]);

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const bodyStart = app.indexOf("{", app.indexOf(")", start) + 1);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const state = { communityStatsByKey: {} };
const activityStat = new Function(
  "state", "normalizeText", "resolveCanonicalPodcastId", "getPodcastKey",
  `${extractFunction("getPopularNowActivityStat")}; return getPopularNowActivityStat;`
)(state, (value) => String(value || "").trim().toLowerCase(), (key) => key, (podcast) => podcast.key);
const isValidActivityStat = new Function(
  "Object", `${extractFunction("hasValidPopularNowActivityStat")}; return hasValidPopularNowActivityStat;`
)(Object);
const eligible = new Function(
  "getPopularNowActivityStat", "hasValidPopularNowActivityStat",
  `${extractFunction("hasDocumentedRecentActivity")}; return hasDocumentedRecentActivity;`
)(activityStat, isValidActivityStat);
const compare = new Function(
  "getPopularNowActivityStat", "getPodcastKey",
  `${extractFunction("comparePopularNowCandidates")}; return comparePopularNowCandidates;`
)(activityStat, (podcast) => podcast.key);

const fixtures = [
  { key: "last-7-days", stat: { recentUsers7d: 1, recentUsers30d: 1, recentUsers90d: 1, momentumScore: 1 } },
  { key: "last-30-days", stat: { recentUsers7d: 0, recentUsers30d: 1, recentUsers90d: 1, momentumScore: 0.35 } },
  { key: "last-90-days", stat: { recentUsers7d: 0, recentUsers30d: 0, recentUsers90d: 1, momentumScore: 0.1 } },
  { key: "more-than-90-days", stat: { recentUsers7d: 0, recentUsers30d: 0, recentUsers90d: 0, momentumScore: 0 } },
  { key: "never-rated", stat: null },
  { key: "missing-activity-fields", stat: { averageRating: 9.9, ratingCount: 400 } },
  { key: "zero-activity", stat: { recentUsers7d: 0, recentUsers30d: 0, recentUsers90d: 0, momentumScore: 0 } },
  { key: "invalid-activity", stat: { recentUsers7d: 3, recentUsers30d: 2, recentUsers90d: 1, momentumScore: 4 } }
];
fixtures.forEach(({ key, stat }) => { if (stat) state.communityStatsByKey[key] = stat; });
const podcasts = fixtures.map(({ key }) => ({ key }));
const candidates = podcasts.filter(eligible);
assert.deepEqual(candidates.map(({ key }) => key), ["last-7-days", "last-30-days", "last-90-days"],
  "only complete, internally consistent activity data with recentUsers90d > 0 can qualify");
assert.deepEqual(candidates.sort(compare).map(({ key }) => key), ["last-7-days", "last-30-days", "last-90-days"],
  "momentum sorts 7-day activity above 30-day and 90-day activity without historical rating tie-breaks");
const aliasActivityStat = new Function(
  "state", "normalizeText", "resolveCanonicalPodcastId", "getPodcastKey",
  `${extractFunction("getPopularNowActivityStat")}; return getPopularNowActivityStat;`
)(state, (value) => String(value || "").trim().toLowerCase(), (key) => key === "legacy-7d" ? "last-7-days" : key,
  (podcast) => podcast.key);
const aliasEligible = new Function(
  "getPopularNowActivityStat", "hasValidPopularNowActivityStat",
  `${extractFunction("hasDocumentedRecentActivity")}; return hasDocumentedRecentActivity;`
)(aliasActivityStat, isValidActivityStat);
assert.equal(aliasEligible({ key: "legacy-7d" }), true,
  "legacy podcast identities resolve to the same canonical activity record");

state.communityStatsByKey["many-episodes-one-user"] = {
  recentUsers7d: 1, recentUsers30d: 1, recentUsers90d: 1, momentumScore: 1,
  averageRating: 10, ratingCount: 80
};
assert.equal(eligible({ key: "many-episodes-one-user", episodeRatingRows: 80 }), true,
  "the client consumes the existing unique-user aggregate, not raw episode-rating row counts");

const candidatesFactory = new Function(
  "state", "normalizeMatchKey", "normalizeText", "getLegacyPodcastKey", "getPodcastKey",
  "getDisplayGroupMemberPodcasts", "createRankingDisplayGroup", "getPopularNowActivityStat",
  "hasValidPopularNowActivityStat", "hasDocumentedRecentActivity", "isStandaloneSeasonPodcast",
  "deduplicatePodcastResults", "console",
  `${extractFunction("getPopularNowCandidateUniverse")}; return getPopularNowCandidateUniverse;`
)(
  Object.assign(state, {
    podcastDisplayGroups: [{ id: "series", rankingEnabled: true, memberLegacyKeys: ["season-one"] }],
    podcasts: [{ key: "outside", legacyKey: "outside" }, { key: "season-one", legacyKey: "season-one" }]
  }),
  (value) => String(value || "").toLowerCase(),
  (value) => String(value || "").toLowerCase(),
  (podcast) => podcast.legacyKey,
  (podcast) => podcast.key,
  () => [
    { key: "season-one", legacyKey: "season-one", title: "Series (sæson 1)" },
    { key: "season-two", legacyKey: "season-two", title: "Series (sæson 2)" }
  ],
  () => ({ key: "display-group:series", title: "Series", isDisplayGroup: true }),
  (podcast) => activityStat(podcast),
  new Function(`${extractFunction("hasValidPopularNowActivityStat")}; return hasValidPopularNowActivityStat;`)(),
  eligible,
  new Function(`${extractFunction("isStandaloneSeasonPodcast")}; return isStandaloneSeasonPodcast;`)(),
  (items) => [...new Map(items.map((item) => [item.key, item])).values()],
  { warn() {} }
);
state.communityStatsByKey.outside = { recentUsers7d: 0, recentUsers30d: 0, recentUsers90d: 0, momentumScore: 0 };
state.communityStatsByKey["season-one"] = { recentUsers7d: 0, recentUsers30d: 1, recentUsers90d: 1, momentumScore: 0.35 };
state.communityStatsByKey["season-two"] = { recentUsers7d: 0, recentUsers30d: 0, recentUsers90d: 1, momentumScore: 0.1 };
assert.deepEqual(candidatesFactory().map(({ key }) => key), ["display-group:series"],
  "active seasons produce one display-group result, not individual season rows");
assert.equal(activityStat(candidatesFactory()[0]).momentumScore, 0.35,
  "display group uses its most active season as the conservative momentum sort signal");

const activeCandidates = [
  { key: "alpha-da", title: "Alpha comedy", genre: "comedy", isEnglish: false, accessType: "free", ratingValue: 1 },
  { key: "alpha-en", title: "Alpha comedy English", genre: "comedy", isEnglish: true, accessType: "paid", ratingValue: 10 },
  { key: "beta-da", title: "Beta drama", genre: "drama", isEnglish: false, accessType: "free", ratingValue: 10 }
];
activeCandidates.forEach((podcast, index) => {
  state.communityStatsByKey[podcast.key] = {
    recentUsers7d: index === 0 ? 1 : 0,
    recentUsers30d: 1,
    recentUsers90d: 1,
    momentumScore: index === 0 ? 1 : 0.35,
    averageRating: index === 1 ? 9.9 : 2,
    ratingCount: index === 1 ? 400 : 1
  };
});

function filterPopularNow(overrides = {}) {
  const rankingState = {
    rankingListCache: new Map(), popularNowActive: true, rankingSource: "users", sort: "placement-asc",
    activePublisherFilter: "", activeMainSeriesFilter: "", activeHostFilter: null, activeFilter: null,
    minimumRating: 0, freeOnly: false, languageFilter: "all", searchTerm: "", savedPodcastKeys: new Set(),
    ...overrides
  };
  const getFiltered = new Function(
    "state", "getRankingListCacheKey", "deduplicatePodcastResults", "getPopularNowCandidates", "getRankingCandidates",
    "publisherMatchesExactFilter", "mainSeriesMatchesExactFilter", "rankingPodcastHasHost", "isPodcastSaved",
    "getPodcastKey", "podcastHasGenre", "publisherMatchesFilter", "normalizeComparable", "getPodcastRatingForActiveSource",
    "parseNumber", "getRankingSearchQuery", "matchesRankingEnhancedSearch", "hasDesktopUserRankingSort", "hasDesktopOwnRatingSort",
    "comparePodcastsByEffectiveOwnRating", "getCommunityStat", "getCommunityRatingCount", "comparePodcastsByActiveRankingOrder",
    "compareRandomTieBreaker", "comparePopularNowCandidates",
    `${extractFunction("getFilteredPodcasts")}; return getFilteredPodcasts;`
  )(
    rankingState, () => "filter-test", (items) => [...new Map(items.map((item) => [item.key, item])).values()],
    () => activeCandidates, () => [], () => true, () => true, () => true, () => false,
    (podcast) => podcast.key, (podcast, genre) => podcast.genre === genre, () => true,
    (value) => String(value || "").toLowerCase(), () => 1, (value) => Number.isFinite(Number(value)) ? Number(value) : null,
    (query) => ({ query }), (podcast, query) => !query || podcast.title.toLowerCase().includes(query.toLowerCase()),
    () => false, () => false, () => null, (key) => state.communityStatsByKey[key] || null,
    () => 1, () => 0, () => 0, () => 0, compare
  );
  return getFiltered();
}

assert.deepEqual(filterPopularNow().map(({ key }) => key), ["alpha-da", "alpha-en", "beta-da"],
  "activity order wins over historical average ratings and normal candidates retain the full filtered cohort");
assert.deepEqual(filterPopularNow({ activeFilter: { type: "genre", value: "comedy" } }).map(({ key }) => key),
  ["alpha-da", "alpha-en"], "genre filters continue to combine with activity");
assert.deepEqual(filterPopularNow({ searchTerm: "alpha comedy" }).map(({ key }) => key),
  ["alpha-da", "alpha-en"], "title and topic search continues to combine with activity");
assert.deepEqual(filterPopularNow({ languageFilter: "danish", freeOnly: true }).map(({ key }) => key),
  ["alpha-da", "beta-da"], "language and free-only filters continue to combine with activity");
assert.deepEqual(filterPopularNow({ searchTerm: "not in catalogue" }), [],
  "search never fills an activity result with unrelated podcasts");

const transitionState = {
  rankingSource: "mads", popularNowActive: false, userRankingSort: "count", userRankingDirection: "asc",
  desktopOwnRatingSortActive: true, ownRatingDirection: "asc", sort: "placement-desc", sortTouched: true
};
let invalidations = 0;
const toggle = new Function(
  "state", "elements", "normalizeRankingSource", "resetVisibleCount", "invalidateRankingListCache",
  "updatePopularNowUi", "updateMobileRankingFilterUi", "renderPodcastGrid",
  `${extractFunction("togglePopularNow")}; return togglePopularNow;`
)(transitionState, { podcastGrid: { replaceChildren() {} } }, (value) => value, () => {}, () => { invalidations += 1; }, () => {}, () => {}, () => {});
toggle();
assert.equal(transitionState.popularNowActive, true);
assert.equal(transitionState.rankingSource, "users", "activation selects user rankings");
toggle();
assert.equal(transitionState.popularNowActive, false);
assert.deepEqual(
  [transitionState.rankingSource, transitionState.userRankingSort, transitionState.userRankingDirection,
    transitionState.desktopOwnRatingSortActive, transitionState.ownRatingDirection, transitionState.sort, transitionState.sortTouched],
  ["mads", "count", "asc", true, "asc", "placement-desc", true],
  "deactivation restores the prior ranking source and sort settings"
);
assert.equal(invalidations, 2, "both transitions invalidate cached results");

const sourceChangeState = {
  rankingSource: "users", popularNowActive: true, popularNowPreviousState: { rankingSource: "mads" }
};
new Function(
  "state", "normalizeRankingSource", "updatePopularNowUi", "updateRankingSourceUi", "resetVisibleCount",
  "updateMobileRankingFilterUi", "scheduleRankingSourceGridRender",
  `${extractFunction("handleRankingSourceChange")}; return handleRankingSourceChange;`
)(sourceChangeState, (value) => value, () => {}, () => {}, () => {}, () => {}, () => {})("mads");
assert.equal(sourceChangeState.popularNowActive, false,
  "selecting the editorial data source deactivates activity mode");
assert.equal(sourceChangeState.popularNowPreviousState, null,
  "manual source switching clears the old toggle restoration snapshot");
assert.equal(sourceChangeState.rankingSource, "mads");

const dataState = new Function(
  "state", `${extractFunction("getPopularNowActivityDataState")}; return getPopularNowActivityDataState;`
);
const completeCatalogue = { podcastDataStatus: "ready", podcasts: [{ key: "one" }], podcastDisplayGroupsReady: true };
assert.deepEqual(dataState({ ...completeCatalogue, communityStatsHasSuccessfulLoad: false, communityStatsStatus: "loading" })(), {
  status: "loading", title: "Indlæser Populære lige nu", message: "Henter og validerer podcastkatalog, hovedserier og aktivitetsdata …"
});
assert.equal(dataState({ ...completeCatalogue, communityStatsHasSuccessfulLoad: false, communityStatsStatus: "error" })().status, "error",
  "a failed first load is an honest error instead of an all-podcasts fallback");
assert.equal(dataState({ ...completeCatalogue, communityStatsHasSuccessfulLoad: true, communityStatsStatus: "refreshing" })().status, "ready",
  "a prior complete public activity response remains valid while a background refresh runs");

assert.match(index, /id="popularNowToggle"[\s\S]*aria-pressed="false"[\s\S]*>Populære lige nu<\/button>/,
  "the toggle is an accessible button with the requested label");
assert.match(app, /state\.popularNowActive\s*\?\s*getPopularNowCandidates\(\)\s*:\s*getRankingCandidates\(\)/,
  "popular candidates still run through the normal genre, search, language, free and rating filters");
assert.match(app, /const filtered = state\.popularNowActive\s*\?\s*filteredCandidates\s*:/,
  "popular mode preserves the snapshot order instead of sorting again after each filter-cache miss");
assert.match(app, /state\.popularNowActive \\|\\| state\.activeFilter/,
  "historical ranking movement is disabled for the activity cohort");
assert.match(css, /Issue 74: keep the activity switch beside desktop search and below mobile search/,
  "the responsive placement has an explicit issue-specific override");
assert.match(sql, /max\(er\.created_at\) filter \(where er\.rating >= 7\) as positive_activity_at/);
assert.match(sql, /greatest\(coalesce\(d\.activity_at, e\.activity_at\), e\.positive_activity_at\)/,
  "the existing direct-rating/positive-episode activity boundary remains documented in SQL");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent(`<!doctype html><html lang="da"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body class="page-ranglister"><main style="max-width:1200px;margin:24px auto;padding:0 12px">
      <div class="ranking-search-strip">
        <label class="search-field"><span class="sr-only">Søg i ranglisten</span><input type="search" id="searchInput" readonly>
          <button class="search-field__clear" type="button" hidden>Ryd</button>
        </label>
        <button id="popularNowToggle" class="popular-now-toggle" type="button" aria-pressed="false">Populære lige nu</button>
        <div class="ranking-mobile-filter-bar"><button type="button">Filtre</button></div>
      </div>
    </main></body></html>`);
  await page.addStyleTag({ content: css });
  for (const width of [320, 375, 390, 768, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.evaluate(() => {
      const search = document.querySelector("#searchInput").getBoundingClientRect();
      const button = document.querySelector("#popularNowToggle").getBoundingClientRect();
      return {
        pageWidth: document.documentElement.scrollWidth,
        searchRight: search.right,
        searchBottom: search.bottom,
        buttonLeft: button.left,
        buttonTop: button.top,
        buttonRight: button.right,
        buttonWidth: button.width,
        buttonClientWidth: document.querySelector("#popularNowToggle").clientWidth,
        buttonScrollWidth: document.querySelector("#popularNowToggle").scrollWidth
      };
    });
    assert.ok(geometry.pageWidth <= width, `no horizontal overflow at ${width}px: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.buttonWidth >= 44, `touch target remains at least 44px wide at ${width}px`);
    assert.ok(geometry.buttonScrollWidth <= geometry.buttonClientWidth + 1,
      `button text stays within its target at ${width}px`);
    if (width >= 901) {
      assert.ok(geometry.buttonLeft >= geometry.searchRight - 1,
        `desktop switch sits beside the search field at ${width}px`);
    } else {
      assert.ok(geometry.buttonTop >= geometry.searchBottom - 1,
        `mobile switch sits below the search field at ${width}px`);
    }
  }
  const toggle = page.locator("#popularNowToggle");
  await page.locator("#searchInput").focus();
  await page.keyboard.press("Tab");
  assert.equal(await toggle.evaluate((button) => document.activeElement === button), true,
    "the activity switch is reachable by keyboard after search");
  assert.notEqual(await toggle.evaluate((button) => getComputedStyle(button).outlineStyle), "none",
    "the activity switch has a visible keyboard focus ring");
} finally {
  await browser.close();
}

console.log("Popular-now activity, ordering, filters, display-group identities, cache transitions and failure-state regressions passed.");
