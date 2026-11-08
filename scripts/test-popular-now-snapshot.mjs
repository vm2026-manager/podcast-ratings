import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!file.startsWith(`${root}${path.sep}`) && file !== path.join(root, "index.html")) throw new Error("outside root");
    if (!(await stat(file)).isFile()) throw new Error("not a file");
    const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
    response.writeHead(200, { "content-type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  page.on("pageerror", (error) => { throw error; });
  await page.addInitScript(() => {
    window.__popularNowTestClock = Date.parse("2026-11-08T00:00:00.000Z");
    const NativeDate = window.Date;
    window.Date = class extends NativeDate {
      static now() { return window.__popularNowTestClock; }
    };
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/u, (route) => route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/#ranglister`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.podcastDataStatus === "ready" && state.podcasts.length > 100 && state.podcastDisplayGroupsReady);
  await page.evaluate(() => localStorage.removeItem("podcastlisten-popular-now-public-snapshot-v2"));
  const legacySnapshotRejection = await page.evaluate(() => {
    const v1Key = "podcastlisten-popular-now-public-snapshot-v1";
    const v2Key = "podcastlisten-popular-now-public-snapshot-v2";
    const previousV1 = localStorage.getItem(v1Key);
    const previousV2 = localStorage.getItem(v2Key);
    const legacy = JSON.stringify({
      version: 1,
      windowId: getPopularNowWindowId(),
      orderedKeys: [],
      activityStatsByKey: {},
      communityStatsByKey: {}
    });
    localStorage.setItem(v1Key, legacy);
    const oldStorageKeyIgnored = readPopularNowSnapshot(getPopularNowWindowId()) === null;
    localStorage.setItem(v2Key, legacy);
    const oldSchemaRejected = readPopularNowSnapshot(getPopularNowWindowId()) === null;
    if (previousV1 === null) localStorage.removeItem(v1Key);
    else localStorage.setItem(v1Key, previousV1);
    if (previousV2 === null) localStorage.removeItem(v2Key);
    else localStorage.setItem(v2Key, previousV2);
    return { oldStorageKeyIgnored, oldSchemaRejected };
  });
  assert.deepEqual(legacySnapshotRejection, { oldStorageKeyIgnored: true, oldSchemaRejected: true },
    "the prior v1 storage key and schema cannot restore a 90-day snapshot");

  const dstWindowIds = await page.evaluate(() => {
    const interval = 6 * 60 * 60 * 1000;
    const springBefore = Date.parse("2026-03-29T00:59:59.999Z");
    const springAfter = Date.parse("2026-03-29T01:00:00.000Z");
    const autumnBefore = Date.parse("2026-10-25T00:59:59.999Z");
    const autumnAfter = Date.parse("2026-10-25T01:00:00.000Z");
    return {
      springBefore: getPopularNowWindowId(springBefore),
      springAfter: getPopularNowWindowId(springAfter),
      springBoundary: getPopularNowWindowId(springBefore + interval),
      autumnBefore: getPopularNowWindowId(autumnBefore),
      autumnAfter: getPopularNowWindowId(autumnAfter),
      autumnBoundary: getPopularNowWindowId(autumnBefore + interval)
    };
  });
  assert.equal(dstWindowIds.springBefore, dstWindowIds.springAfter, "the spring DST jump does not shorten a UTC six-hour window");
  assert.equal(dstWindowIds.springBoundary, dstWindowIds.springBefore + 1, "the spring DST test reaches the next fixed six-hour boundary");
  assert.equal(dstWindowIds.autumnBefore, dstWindowIds.autumnAfter, "the repeated autumn local hour does not split a UTC window");
  assert.equal(dstWindowIds.autumnBoundary, dstWindowIds.autumnBefore + 1, "the autumn DST test reaches the next fixed six-hour boundary");

  await page.evaluate(() => {
    state.communityStatsByKey = Object.create(null);
    state.displayGroupCommunityStatsById = Object.create(null);
    state.communityStatsHasSuccessfulLoad = false;
    state.communityStatsStatus = "loading";
    state.popularNowActive = false;
    state.popularNowSnapshot = null;
    state.popularNowRenderedSignature = "";
    state.podcastDataStatus = "ready";
    state.podcastDisplayGroupsReady = true;

    const activityKeys = new Set();
    state.podcasts.forEach((podcast) => {
      const key = resolveCanonicalPodcastId(normalizeText(getPodcastKey(podcast))) || normalizeText(getPodcastKey(podcast));
      if (key) activityKeys.add(key);
    });
    state.podcastDisplayGroups.filter((group) => group.rankingEnabled)
      .flatMap(getDisplayGroupMemberPodcasts)
      .forEach((podcast) => {
        const key = resolveCanonicalPodcastId(normalizeText(getPodcastKey(podcast))) || normalizeText(getPodcastKey(podcast));
        if (key) activityKeys.add(key);
      });
    const keys = [...activityKeys];
    const makeStats = (reverse) => keys.map((key, index) => ({
      podcast_key: key,
      average_rating: 7 + (index % 30) / 10,
      rating_count: 3 + (index % 20),
      recent_users_7d: reverse ? keys.length - index : index + 1,
      recent_users_30d: reverse ? keys.length - index : index + 1,
      recent_users_90d: keys.length + 1,
      momentum_score: reverse ? keys.length - index : index + 1
    }));
    window.__popularStatsA = makeStats(false);
    window.__popularStatsB = makeStats(true);
    window.__popularStatsKeys = keys;
    window.__pendingPopularStats = [];
    window.__popularStatsRequests = [];
    state.supabase = {
      from() {
        return {
          select() {
            return new Promise((resolve) => window.__pendingPopularStats.push(resolve));
          }
        };
      },
      rpc(_name, args) {
        return Promise.resolve({
          data: (args.p_display_group_ids || []).map((id) => ({ display_group_id: id, average_rating: 8.1, rating_count: 18 })),
          error: null
        });
      },
      auth: { async signOut() { return { error: null }; } }
    };
  });

  const popularNowButton = page.getByRole("button", { name: "Populære lige nu" });
  await popularNowButton.focus();
  assert.equal(await popularNowButton.evaluate((button) => button === document.activeElement), true, "the entry point receives keyboard focus");
  await popularNowButton.press("Enter");
  const initialLoading = await page.evaluate(() => ({
    active: state.popularNowActive,
    busy: elements.podcastGrid.getAttribute("aria-busy"),
    status: elements.podcastGrid.querySelector(".popular-now-data-state--loading")?.textContent,
    cards: elements.podcastGrid.querySelectorAll(".podcast-card").length
  }));
  assert.equal(initialLoading.active, true);
  assert.equal(initialLoading.busy, "true", "the list remains busy until all required data is valid");
  assert.match(initialLoading.status, /katalog, hovedserier og aktivitetsdata/u);
  assert.equal(initialLoading.cards, 0, "no provisional podcast placements are rendered while data is pending");

  await page.evaluate(() => {
    window.__popularStatsRequests = [fetchCommunityStats(), fetchCommunityStats()];
  });
  await page.waitForFunction(() => window.__pendingPopularStats.length === 2);
  await page.evaluate(async () => {
    window.__pendingPopularStats[1]({ data: window.__popularStatsB, error: null });
    await window.__popularStatsRequests[1];
    renderPodcastGrid();
  });
  const firstSnapshot = await page.evaluate(() => ({
    dataState: getPopularNowActivityDataState().status,
    windowId: state.popularNowSnapshot?.windowId,
    keys: state.popularNowSnapshot?.orderedKeys,
    filteredKeys: getFilteredPodcasts().map(getPodcastKey),
    count: elements.podcastGrid.querySelectorAll(".podcast-card").length,
    busy: elements.podcastGrid.getAttribute("aria-busy"),
    intervalMessage: elements.resultsText.textContent,
    cache: localStorage.getItem("podcastlisten-popular-now-public-snapshot-v2")
  }));
  await page.evaluate(() => { window.__popularNowFirstNode = elements.podcastGrid.querySelector(".podcast-card"); });
  assert.equal(firstSnapshot.dataState, "ready");
  assert.ok(firstSnapshot.keys.length > 100, "the validated full candidate cohort is captured once");
  assert.deepEqual(firstSnapshot.filteredKeys, firstSnapshot.keys, "the first visible result uses the completed snapshot order");
  assert.equal(firstSnapshot.busy, "false");
  assert.match(firstSnapshot.intervalMessage, /hver 6\. time/u, "the ranking interval is visible in the results status");
  const persistedSnapshot = JSON.parse(firstSnapshot.cache);
  assert.deepEqual(persistedSnapshot.orderedKeys, firstSnapshot.keys);
  assert.equal(persistedSnapshot.version, 2);
  assert.equal(Object.hasOwn(persistedSnapshot, "userId"), false, "browser storage contains public snapshot data only");
  assert.ok(persistedSnapshot.orderedKeys.every((key) =>
    persistedSnapshot.activityStatsByKey[key]?.recentUsers30d > 0),
  "all persisted snapshot candidates have validated activity in the last 30 days");
  assert.equal(Object.hasOwn(persistedSnapshot, "email"), false, "browser storage contains no account data");

  await page.evaluate(() => {
    window.__pendingPopularStats[0]({ data: window.__popularStatsA, error: null });
  });
  await page.evaluate(async () => {
    await window.__popularStatsRequests[0];
    window.__popularStatsRequests[2] = fetchCommunityStats();
  });
  await page.waitForFunction(() => window.__pendingPopularStats.length === 3);
  await page.evaluate(async () => {
    window.__pendingPopularStats[2]({ data: window.__popularStatsA, error: null });
    await window.__popularStatsRequests[2];
    renderPodcastGrid();
  });
  const repeatedResponse = await page.evaluate(() => ({
    keys: getFilteredPodcasts().map(getPodcastKey),
    snapshotKeys: state.popularNowSnapshot.orderedKeys,
    cards: elements.podcastGrid.querySelectorAll(".podcast-card").length
  }));
  assert.deepEqual(repeatedResponse.keys, firstSnapshot.keys, "stale and repeated responses cannot resort an active snapshot");
  assert.equal(await page.locator("#podcastGrid .podcast-card").first().evaluate((element) => element === window.__popularNowFirstNode), true,
    "a repeated activity response leaves the first mobile card node intact");

  const mobileDesktopViewports = [320, 375, 390, 768, 1280, 1440];
  for (const width of mobileDesktopViewports) {
    await page.setViewportSize({ width, height: 844 });
    const batchSize = width >= 1101 ? 24 : 20;
    await page.evaluate(({ batchSize, width }) => {
      state.mobileRankingTailMode = false;
      state.visibleCount = batchSize;
      if (width === 1280) state.desktopRankingLayout = "cards";
      if (width === 1440) state.desktopRankingLayout = "list";
      invalidateRankingListCache();
      renderPodcastGrid();
    }, { batchSize, width });
    const selector = width >= 1101
      ? width === 1280 ? ".desktop-ranking-top-card" : ".desktop-ranking-row"
      : ".podcast-card";
    const initialKeys = await page.locator(`#podcastGrid ${selector}`).evaluateAll((nodes) =>
      nodes.map((node) => node.dataset.key)
    );
    assert.equal(initialKeys.length, batchSize, `${width}px renders one complete batch`);
    assert.deepEqual(initialKeys, firstSnapshot.keys.slice(0, batchSize), `${width}px starts with the same snapshot ranks`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px has no horizontal overflow`);

    const firstNode = await page.locator(`#podcastGrid ${selector}`).first().evaluateHandle((element) => element);
    const scrollY = await page.evaluate(() => scrollY);
    const loadMore = page.locator(".load-more-button");
    assert.equal(await loadMore.isVisible(), true, `${width}px exposes Vis flere for the remaining snapshot`);
    await loadMore.evaluate((button) => button.click());
    await page.waitForFunction((expected) => state.visibleCount === expected, batchSize * 2);
    const expandedKeys = await page.locator(`#podcastGrid ${selector}`).evaluateAll((nodes) =>
      nodes.map((node) => node.dataset.key)
    );
    assert.equal(expandedKeys.length, batchSize * 2, `${width}px adds one complete batch`);
    assert.deepEqual(expandedKeys.slice(0, batchSize), initialKeys, `${width}px preserves all earlier ranks when expanding`);
    assert.equal(await page.locator(`#podcastGrid ${selector}`).first().evaluate((element, original) => element === original, firstNode), true,
      `${width}px preserves the first DOM node while adding results`);
    assert.equal(await page.evaluate(() => scrollY), scrollY, `${width}px does not jump the scroll position when expanding`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    state.visibleCount = 20;
    state.searchTerm = "";
    state.activeFilter = null;
    invalidateRankingListCache();
    renderPodcastGrid();
  });
  const filteredCases = await page.evaluate(() => {
    const snapshotKeys = state.popularNowSnapshot.orderedKeys;
    const selectedGenre = state.popularNowSnapshot.entries.find((podcast) => podcast.genre)?.genre;
    state.searchTerm = state.popularNowSnapshot.entries[12].title.split(/\s+/u)[0];
    invalidateRankingListCache();
    const searchKeys = getFilteredPodcasts().map(getPodcastKey);
    state.searchTerm = "";
    setActiveFilter("genre", selectedGenre, { render: false });
    invalidateRankingListCache();
    const genreKeys = getFilteredPodcasts().map(getPodcastKey);
    const preservesSnapshotOrder = (keys) => keys.every((key, index) => !index || snapshotKeys.indexOf(keys[index - 1]) < snapshotKeys.indexOf(key));
    state.activeFilter = null;
    invalidateRankingListCache();
    renderPodcastGrid();
    return { searchKeys, genreKeys, allKeys: getFilteredPodcasts().map(getPodcastKey), preservesSearch: preservesSnapshotOrder(searchKeys), preservesGenre: preservesSnapshotOrder(genreKeys) };
  });
  assert.ok(filteredCases.searchKeys.length > 0 && filteredCases.genreKeys.length > 0, "search and genre filters retain matching snapshot entries");
  assert.equal(filteredCases.preservesSearch, true, "search retains the original relative rank order");
  assert.equal(filteredCases.preservesGenre, true, "genre filtering retains the original relative rank order");
  assert.deepEqual(filteredCases.allKeys, firstSnapshot.keys, "clearing filters restores the same complete snapshot");

  const beforeCatalogueRefresh = await page.locator("#podcastGrid .podcast-card").first().evaluateHandle((element) => element);
  const refreshResult = await page.evaluate(async () => {
    const [rows, featured, covers, groups] = await Promise.all([
      loadPodcastObjectsFromJson(),
      loadFeaturedReviewObjectsFromJson(),
      loadCoverManifestFromJson(),
      loadPodcastDisplayGroups()
    ]);
    rows.reverse();
    applyPodcastDataRefresh(rows, featured, covers, groups);
    state.podcastDataStatus = "ready";
    renderPodcastGrid();
    return { keys: getFilteredPodcasts().map(getPodcastKey), snapshotKeys: state.popularNowSnapshot.orderedKeys };
  });
  assert.deepEqual(refreshResult.keys, firstSnapshot.keys, "hourly catalogue refresh cannot rebuild or reorder the active snapshot");
  assert.equal(await page.locator("#podcastGrid .podcast-card").first().evaluate((element, original) => element === original, beforeCatalogueRefresh), true,
    "catalogue refresh preserves visible mobile DOM nodes when the snapshot is unchanged");

  const userLifecycle = await page.evaluate(async () => {
    state.supabase.from = () => ({ select: async () => ({ data: [], error: null }) });
    state.session = { user: { id: "public-snapshot-test-a" } };
    state.authUser = { id: "public-snapshot-test-a", email: "test-a@example.invalid" };
    await handleLogout();
    const afterLogout = state.popularNowSnapshot.orderedKeys.slice();
    state.session = { user: { id: "public-snapshot-test-b" } };
    state.authUser = { id: "public-snapshot-test-b", email: "test-b@example.invalid" };
    await fetchUserState({ preserveCurrentState: true });
    invalidateRankingListCache();
    renderPodcastGrid();
    return { afterLogout, afterLogin: state.popularNowSnapshot.orderedKeys.slice(), active: state.popularNowActive };
  });
  assert.deepEqual(userLifecycle.afterLogout, firstSnapshot.keys, "logout does not clear the public ranking snapshot");
  assert.deepEqual(userLifecycle.afterLogin, firstSnapshot.keys, "a different signed-in user does not get a different public ranking");
  assert.equal(userLifecycle.active, true);

  const savedStatsA = await page.evaluate(() => window.__popularStatsA);

  const samePeriodNavigation = await page.evaluate(async () => {
    const keys = state.popularNowSnapshot.orderedKeys.slice();
    location.hash = "#forside";
    await new Promise((resolve) => window.addEventListener("hashchange", resolve, { once: true }));
    location.hash = "#ranglister";
    await new Promise((resolve) => window.addEventListener("hashchange", resolve, { once: true }));
    return { keys, restored: state.popularNowSnapshot.orderedKeys.slice(), windowId: state.popularNowSnapshot.windowId };
  });
  assert.deepEqual(samePeriodNavigation.restored, firstSnapshot.keys, "navigation away and back within six hours preserves every rank");
  assert.equal(samePeriodNavigation.windowId, firstSnapshot.windowId);

  const storedBeforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem("podcastlisten-popular-now-public-snapshot-v2")));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.podcastDataStatus === "ready" && state.podcastDisplayGroupsReady && state.podcasts.length > 100);
  await page.evaluate((statsRows) => {
    state.communityStatsByKey = canonicalizeCommunityStats(statsRows).statsByKey;
    state.communityStatsHasSuccessfulLoad = true;
    state.communityStatsStatus = "ready";
    state.displayGroupCommunityStatsById = Object.fromEntries(
      state.podcastDisplayGroups.map((group) => [group.id, { averageRating: 8.1, ratingCount: 18 }])
    );
  }, savedStatsA);
  await page.getByRole("button", { name: "Populære lige nu" }).click();
  const reloadSnapshot = await page.evaluate(() => ({
    active: state.popularNowActive,
    windowId: state.popularNowSnapshot.windowId,
    keys: state.popularNowSnapshot.orderedKeys,
    stored: JSON.parse(localStorage.getItem("podcastlisten-popular-now-public-snapshot-v2")).orderedKeys
  }));
  assert.equal(reloadSnapshot.active, true);
  assert.equal(reloadSnapshot.windowId, storedBeforeReload.windowId);
  assert.deepEqual(reloadSnapshot.keys, firstSnapshot.keys, "browser reload reuses the public snapshot from the current six-hour period");
  assert.deepEqual(reloadSnapshot.stored, firstSnapshot.keys);

  const atBoundaryWhileVisible = await page.evaluate((statsRows) => {
    const oldSnapshot = state.popularNowSnapshot;
    window.__popularNowTestClock = (oldSnapshot.windowId + 1) * 6 * 60 * 60 * 1000;
    state.communityStatsByKey = canonicalizeCommunityStats(statsRows).statsByKey;
    invalidateRankingListCache();
    renderPodcastGrid();
    return { windowId: state.popularNowSnapshot.windowId, keys: getFilteredPodcasts().map(getPodcastKey), oldKeys: oldSnapshot.orderedKeys };
  }, savedStatsA);
  assert.equal(atBoundaryWhileVisible.windowId, storedBeforeReload.windowId, "the six-hour boundary does not replace a list already on screen");
  assert.deepEqual(atBoundaryWhileVisible.keys, firstSnapshot.keys, "background updates at the boundary do not move active results");

  const reopenedSnapshot = await page.evaluate(async () => {
    location.hash = "#forside";
    await new Promise((resolve) => window.addEventListener("hashchange", resolve, { once: true }));
    location.hash = "#ranglister";
    await new Promise((resolve) => window.addEventListener("hashchange", resolve, { once: true }));
    return { windowId: state.popularNowSnapshot.windowId, keys: state.popularNowSnapshot.orderedKeys.slice() };
  });
  assert.equal(reopenedSnapshot.windowId, storedBeforeReload.windowId + 1, "the next complete snapshot is applied only at controlled navigation reopen");
  assert.notDeepEqual(reopenedSnapshot.keys, firstSnapshot.keys, "the next window uses the new validated activity response");
} finally {
  await browser.close();
  server.close();
}

console.log("Popular-now six-hour snapshot browser regressions passed: delayed/stale responses, filters, catalogue refresh, pagination, logout/login, reload, navigation, DST, mobile/desktop DOM stability, and controlled window rollover.");
