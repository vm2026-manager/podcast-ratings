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
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/u, (route) => route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/#ranglister`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.podcasts?.length > 100 && elements.podcastGrid);

  await page.evaluate(() => {
    state.communityStatsByKey = Object.create(null);
    const groups = state.podcastDisplayGroups.filter((group) => group.rankingEnabled);
    const eligible = [...getRankingCandidates(), ...groups.flatMap(getDisplayGroupMemberPodcasts)];
    const unique = new Map();
    eligible.filter((podcast) => !podcast.isDisplayGroup).forEach((podcast) => {
      const rawKey = getPodcastKey(podcast);
      const key = resolveCanonicalPodcastId(normalizeText(rawKey)) || normalizeText(rawKey);
      if (key && !unique.has(key)) unique.set(key, podcast);
    });
    [...unique.keys()].forEach((key, index) => {
      const cohort = index % 3;
      state.communityStatsByKey[key] = {
        recentUsers7d: cohort === 0 ? 3 : 0,
        recentUsers30d: cohort < 2 ? 3 : 0,
        recentUsers90d: 3,
        momentumScore: (3 - cohort) * 10000 - index,
        averageRating: index % 2 ? 1 : 10,
        ratingCount: index * 10
      };
    });
    for (const group of groups) {
      if (group.id === "narkobetjenten") {
        const season23 = group.seasonIdentities.find((season) => season.season === 23).podcast_key;
        state.communityStatsByKey[season23] = {
          recentUsers7d: 99, recentUsers30d: 99, recentUsers90d: 99, momentumScore: 50000
        };
      }
      if (group.id === "kirsten-ringer-til-rasmus") {
        const member = state.podcasts.find((podcast) => getLegacyPodcastKey(podcast) ===
          normalizeMatchKey(group.memberLegacyKeys[0]));
        const rawKey = getPodcastKey(member);
        const key = resolveCanonicalPodcastId(normalizeText(rawKey)) || normalizeText(rawKey);
        state.communityStatsByKey[key] = {
          recentUsers7d: 5, recentUsers30d: 5, recentUsers90d: 5, momentumScore: 40000
        };
      }
    }
    const excludedKey = [...unique.keys()][0];
    state.communityStatsByKey[excludedKey] = {
      recentUsers7d: 0, recentUsers30d: 0, recentUsers90d: 0,
      momentumScore: 0, averageRating: 10, ratingCount: 9999
    };
    window.__excludedPopularKey = excludedKey;
    state.communityStatsHasSuccessfulLoad = true;
    state.communityStatsStatus = "ready";
    state.rankingSource = "mads";
    state.popularNowActive = false;
    state.popularNowPreviousState = null;
    invalidateRankingListCache();
    resetVisibleCount();
    renderPodcastGrid();

    window.__rankingObserverStats = { created: 0, observed: 0, callbackHits: 0, disconnected: 0 };
    window.__activeRankingObservers = new Set();
    const NativeObserver = window.IntersectionObserver;
    window.IntersectionObserver = class extends NativeObserver {
      constructor(callback, options) {
        super((entries, observer) => {
          if (entries.some((entry) => entry.target?.classList?.contains("mobile-ranking-autoload-sentinel") && entry.isIntersecting)) {
            window.__rankingObserverStats.callbackHits += 1;
          }
          callback(entries, observer);
        }, options);
        this.__rankingObserverTracked = false;
        window.__rankingObserverStats.created += 1;
      }
      observe(target) {
        if (target?.classList?.contains("mobile-ranking-autoload-sentinel")) {
          window.__rankingObserverStats.observed += 1;
          this.__rankingObserverTracked = true;
          window.__activeRankingObservers.add(this);
        }
        return super.observe(target);
      }
      disconnect() {
        if (this.__rankingObserverTracked) {
          window.__rankingObserverStats.disconnected += 1;
          window.__activeRankingObservers.delete(this);
          this.__rankingObserverTracked = false;
        }
        return super.disconnect();
      }
    };
  });

  const viewports = [320, 375, 390, 768, 1280, 1440];
  for (const width of viewports) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const desktop = width >= 1101;
    const expectedBatch = desktop ? 24 : 20;
    const available = await page.evaluate(() => getFilteredPodcasts().length);
    assert.ok(available > expectedBatch * 2, `fixture has enough eligible podcasts at ${width}px`);

    if (desktop) {
      const layoutToggle = page.locator(".desktop-ranking-layout-toggle");
      if (await layoutToggle.count()) {
        const desired = width === 1280 ? "cards" : "list";
        const current = await page.evaluate(() => state.desktopRankingLayout);
        if (current !== desired) await layoutToggle.click();
      }
    }

    await page.evaluate(() => { window.__rankingObserverStats = { created: 0, observed: 0, callbackHits: 0, disconnected: 0 }; });

    const toggle = page.getByRole("button", { name: "Populære lige nu" });
    if (width === 390) {
      await toggle.focus();
      await page.keyboard.press("Enter");
    } else if (width === 320) {
      await toggle.tap();
    } else {
      await toggle.click();
    }

    await page.waitForFunction((count) => state.popularNowActive && state.rankingSource === "users" && state.visibleCount === count,
      expectedBatch);
    const initial = await page.evaluate(() => {
      const grid = elements.podcastGrid;
      const desktop = innerWidth >= 1101;
      const cardsLayout = desktop && state.desktopRankingLayout === "cards";
      const selector = desktop ? (cardsLayout ? ".desktop-ranking-top-card" : ".desktop-ranking-row") : ".podcast-card";
      const cards = grid.querySelectorAll(selector);
      const records = getFilteredPodcasts();
      const shown = [...cards].map((node) => node.dataset.key || node.dataset.podcastKey || "");
      return {
        visibleCount: state.visibleCount,
        rendered: cards.length,
        layout: desktop ? state.desktopRankingLayout : "mobile-cards",
        first: cards[0] || null,
        shown,
        ranks: [...cards].slice(0, 5).map((node) =>
          node.querySelector(".desktop-ranking-row__number, .desktop-ranking-rank, .placement-value")?.textContent.trim().split(/\s+/u)[0] || ""),
        expected: records.slice(0, state.visibleCount).map((item) => getPodcastKey(item)),
        eligible: records.every((item) => hasDocumentedRecentActivity(item)),
        ordered: records.every((item, index) => !index || comparePopularNowCandidates(records[index - 1], item) <= 0),
        groupCounts: Object.fromEntries(["narkobetjenten", "kirsten-ringer-til-rasmus"].map((id) => [id,
          records.filter((item) => item.displayGroupId === id).length])),
        hasIndividualSeason: records.some((item) => item.isDisplayGroupSeason || /\bsæson\s+\d+\s*\)?$/iu.test(item.title)),
        excludesInactive: !records.some((item) => {
          const key = resolveCanonicalPodcastId(normalizeText(getPodcastKey(item))) || normalizeText(getPodcastKey(item));
          return key === window.__excludedPopularKey;
        }),
        sentinelHidden: !document.querySelector(".mobile-ranking-autoload-sentinel") ||
          document.querySelector(".mobile-ranking-autoload-sentinel").classList.contains("is-hidden"),
        observers: { ...window.__rankingObserverStats, active: window.__activeRankingObservers.size },
        overflow: document.documentElement.scrollWidth > innerWidth
      };
    });
    assert.equal(initial.visibleCount, expectedBatch, `initial ${width}px cohort is one batch`);
    assert.equal(initial.rendered, expectedBatch, `only the first ${expectedBatch} results render at ${width}px`);
    assert.deepEqual(initial.shown, initial.expected.slice(0, expectedBatch), `first batch matches sorted momentum results at ${width}px`);
    assert.equal(new Set(initial.shown).size, expectedBatch, `first batch has no duplicate podcast or season identities at ${width}px`);
    assert.deepEqual(initial.ranks, ["#1", "#2", "#3", "#4", "#5"], `placements are sequential at ${width}px`);
    if (width === 1280) assert.equal(initial.layout, "cards", "1280px desktop exercises card batching");
    if (width === 1440) assert.equal(initial.layout, "list", "1440px desktop exercises table batching");
    assert.ok(initial.eligible && initial.ordered, `30-day cohort and 7/30-day momentum order remain correct at ${width}px`);
    assert.ok(Object.values(initial.groupCounts).every((count) => count <= 1),
      `each configured main series appears at most once at ${width}px`);
    assert.equal(initial.hasIndividualSeason, false, `individual season rows are suppressed at ${width}px`);
    assert.ok(initial.excludesInactive, `podcasts without 30-day activity stay out at ${width}px`);
    assert.ok(initial.sentinelHidden, `popular mode hides the autoload sentinel at ${width}px`);
    assert.equal(initial.observers.active, 0, `popular mode leaves no ranking observer active at ${width}px`);
    assert.equal(initial.overflow, false, `no horizontal overflow at ${width}px`);

    if (width === 390) {
      const mainSeriesCard = page.locator('.podcast-card[data-key="display-group:narkobetjenten"]');
      assert.equal(await mainSeriesCard.count(), 1, "Narkobetjenten main series is rendered once on mobile");
      await mainSeriesCard.locator(".podcast-card__title").click();
      await page.waitForFunction(() => document.querySelector("#podcastDetailSheet")?.getAttribute("aria-hidden") === "false");
      assert.match(await page.locator("#podcastDetailSheet").innerText(), /Narkobetjenten/u,
        "clicking the grouped ranking result opens the main series details");
      await page.locator("#podcastDetailSheet button[data-podcast-detail-close]").click();
      await page.waitForFunction(() => document.querySelector("#podcastDetailSheet")?.getAttribute("aria-hidden") !== "false");
    }

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(750);
    const afterScroll = await page.evaluate(() => {
      const selector = innerWidth >= 1101 ? (state.desktopRankingLayout === "cards" ? ".desktop-ranking-top-card" : ".desktop-ranking-row") : ".podcast-card";
      return { count: state.visibleCount, rendered: elements.podcastGrid.querySelectorAll(selector).length, stats: { ...window.__rankingObserverStats } };
    });
    assert.equal(afterScroll.count, expectedBatch, `scroll does not auto-expand popular mode at ${width}px`);
    assert.equal(afterScroll.rendered, expectedBatch, `scroll does not add DOM in popular mode at ${width}px`);
    assert.equal(afterScroll.stats.callbackHits, 0, `no ranking observer callback runs in popular mode at ${width}px`);

    await page.evaluate(() => { window.__firstRankingNode = elements.podcastGrid.querySelector(".desktop-ranking-row, .podcast-card"); });
    const beforeScrollY = await page.evaluate(() => window.scrollY);
    const loadMore = page.getByRole("button", { name: /Vis \d+ flere/ });
    await loadMore.click();
    await page.waitForFunction((count) => state.visibleCount === count, Math.min(expectedBatch * 2, available));
    const batchResult = await page.evaluate(() => ({
      count: state.visibleCount,
      rendered: (() => {
        const selector = innerWidth >= 1101 ? (state.desktopRankingLayout === "cards" ? ".desktop-ranking-top-card" : ".desktop-ranking-row") : ".podcast-card";
        return elements.podcastGrid.querySelectorAll(selector).length;
      })(),
      firstNodePreserved: elements.podcastGrid.querySelector(".desktop-ranking-row, .podcast-card") === window.__firstRankingNode,
      y: window.scrollY,
      keys: [...elements.podcastGrid.querySelectorAll(innerWidth >= 1101
        ? (state.desktopRankingLayout === "cards" ? ".desktop-ranking-top-card" : ".desktop-ranking-row")
        : ".podcast-card")]
        .map((node) => node.dataset.key || node.dataset.podcastKey || "")
    }));
    assert.equal(batchResult.count, Math.min(expectedBatch * 2, available), `button adds exactly one batch at ${width}px`);
    assert.equal(batchResult.rendered, batchResult.count, `DOM count tracks one added batch at ${width}px`);
    assert.equal(batchResult.firstNodePreserved, true, `first card or row is reused at ${width}px`);
    assert.equal(batchResult.y, beforeScrollY, `button loading does not scroll-jump at ${width}px`);
    assert.deepEqual(batchResult.keys.slice(0, expectedBatch), initial.expected, `existing ordered items stay in place at ${width}px`);

    if (width === 390) {
      const search = page.locator("#searchInput");
      await search.evaluate((input) => {
        input.removeAttribute("readonly");
        input.value = "podcast";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForTimeout(80);
      assert.ok(await page.evaluate(() => getFilteredPodcasts().length > 0), "search composes with popular mode");
      await search.evaluate((input) => {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.evaluate(() => {
        const genre = getFilteredPodcasts()[0]?.genre;
        if (!genre) throw new Error("the activity fixture needs a genre for filter coverage");
        setActiveFilter("genre", genre);
        if (!getFilteredPodcasts().every((podcast) => podcastHasGenre(podcast, genre))) {
          throw new Error("genre filtering escaped the popular cohort");
        }
        setActiveFilter(null, null);
      });
      const genreButton = page.locator(".ranking-mobile-filter-bar button, [data-ranking-filter-trigger]").first();
      if (await genreButton.count() && await genreButton.isVisible()) await genreButton.tap();
      await page.keyboard.press("Escape");
    }

    if (width === 390) {
      await toggle.focus();
      await page.keyboard.press("Enter");
    } else if (width === 320) {
      await toggle.tap();
    } else {
      await toggle.click();
    }
    await page.waitForFunction(() => !state.popularNowActive && state.rankingSource === "mads");
    if (width === 390) {
      const normalVisibleCount = await page.evaluate(() => state.visibleCount);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForFunction((count) => state.visibleCount > count, normalVisibleCount, { timeout: 3000 });
      assert.ok(await page.evaluate(() => window.__rankingObserverStats.observed > 0),
        "normal ranking restores automatic observer loading after deactivation");
    }
  }
  console.log("Popular-now live DOM batching, scroll, no-rerender, ordering and responsive browser regressions passed.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
