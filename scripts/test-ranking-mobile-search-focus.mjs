import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp"
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(root, requested);
    if (!filePath.startsWith(root + path.sep) && filePath !== path.join(root, "index.html")) {
      throw new Error("Invalid path");
    }
    await stat(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const errors = [];

async function openRankingPage(width, height, mobile) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: mobile,
    hasTouch: mobile
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/u, (route) => route.abort());
  await page.goto(`${origin}/#ranglister`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => state.podcastDataStatus === "ready" && state.podcasts.length > 1000,
    null,
    { timeout: 30000 }
  );
  return { context, page };
}

try {
  for (const width of [320, 375, 390, 768]) {
    const { context, page } = await openRankingPage(width, 844, true);
    if (width === 390) {
      await page.locator("#rankingMobileFilterToggle").tap();
      await page.waitForFunction(
        () => document.querySelector("#rankingMobileFilterToggle")?.getAttribute("aria-expanded") === "true"
      );
      await page.locator('#genreChips [data-genre="True Crime"]').first().tap();
      await page.waitForFunction(() => document.querySelector(".genre-chip.active"));
    }
    const search = page.locator("#searchInput");
    await search.tap();
    await page.waitForFunction(
      () => document.body.classList.contains("ranking-search-focused"),
      null,
      { timeout: 3000 }
    );
    await page.waitForTimeout(100);

    const focusedLayout = await page.evaluate(() => {
      const visible = (selector) => getComputedStyle(document.querySelector(selector)).display !== "none";
      const rect = document.querySelector(".ranking-search-strip").getBoundingClientRect();
      return {
        searchTop: rect.top,
        focused: document.body.classList.contains("ranking-search-focused"),
        titleVisible: visible("#rankingMobilePageHeader"),
        recentVisible: visible(".recent-section"),
        filtersVisible: visible("#rankingFilterPanel"),
        inspirationVisible: visible(".ranking-search-actions"),
        sortVisible: visible("#mobileSortToggle"),
        navigationVisible: visible(".site-nav"),
        inputHeight: document.querySelector("#searchInput").getBoundingClientRect().height,
        filterSummaryVisible: visible("#rankingMobileFilterSummary"),
        filterSummary: document.querySelector("#rankingMobileFilterSummary").textContent.trim()
      };
    });

    assert.ok(focusedLayout.focused, `${width}px: focusing search opens compact mode`);
    assert.ok(focusedLayout.searchTop <= 8, `${width}px: search field moves to the top`);
    assert.equal(focusedLayout.titleVisible, false, `${width}px: mobile ranking header is hidden`);
    assert.equal(focusedLayout.recentVisible, false, `${width}px: recent reviews are hidden`);
    assert.equal(focusedLayout.filtersVisible, false, `${width}px: filter panel is hidden while typing`);
    assert.equal(focusedLayout.inspirationVisible, false, `${width}px: suggestion controls are hidden`);
    assert.equal(focusedLayout.sortVisible, false, `${width}px: mobile sort button is hidden`);
    assert.equal(focusedLayout.navigationVisible, true, `${width}px: navigation remains until the keyboard opens`);
    assert.ok(focusedLayout.inputHeight >= 44, `${width}px: search remains easy to tap`);
    if (width === 390) {
      assert.equal(focusedLayout.filterSummaryVisible, true, "active filter summary stays visible during search");
      assert.match(focusedLayout.filterSummary, /True Crime/u, "search focus preserves the selected genre filter");
    }

    const searchStartedAt = await page.evaluate(() => performance.now());
    await search.fill("mand");
    await page.waitForFunction(() => state.searchTerm === "mand");
    const searchElapsedMs = await page.evaluate((startedAt) => performance.now() - startedAt, searchStartedAt);
    assert.ok(searchElapsedMs < 300, `${width}px: matching results update under 300 ms (${searchElapsedMs.toFixed(1)} ms)`);
    const beforeViewportShrink = await page.evaluate(() => ({
      resultCount: document.querySelectorAll("#podcastGrid > *").length,
      firstResult: document.querySelector("#podcastGrid > *")?.dataset.podcastId || null,
      searchValue: document.querySelector("#searchInput").value
    }));
    assert.ok(beforeViewportShrink.resultCount > 0, `${width}px: typing renders matching podcasts`);
    assert.equal(beforeViewportShrink.searchValue, "mand", `${width}px: typed query stays in the field`);

    await page.setViewportSize({ width, height: 480 });
    await page.waitForFunction(
      () => document.body.classList.contains("ranking-keyboard-open"),
      null,
      { timeout: 3000 }
    );
    const keyboardLayout = await page.evaluate(() => ({
      navigationDisplay: getComputedStyle(document.querySelector(".site-nav")).display,
      searchValue: document.querySelector("#searchInput").value,
      resultCount: document.querySelectorAll("#podcastGrid > *").length,
      firstResult: document.querySelector("#podcastGrid > *")?.dataset.podcastId || null,
      stripBottom: document.querySelector(".ranking-search-strip").getBoundingClientRect().bottom,
      viewportHeight: innerHeight,
      fullyVisibleRows: [...document.querySelectorAll("#podcastGrid > *")].filter((card) => {
        const rect = card.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= innerHeight;
      }).length,
      filterSummary: document.querySelector("#rankingMobileFilterSummary").textContent.trim()
    }));
    assert.equal(keyboardLayout.navigationDisplay, "none", `${width}px: bottom navigation yields space to the keyboard`);
    assert.equal(keyboardLayout.searchValue, beforeViewportShrink.searchValue, `${width}px: keyboard resize preserves the query`);
    assert.equal(keyboardLayout.resultCount, beforeViewportShrink.resultCount, `${width}px: keyboard resize preserves the result count`);
    assert.equal(keyboardLayout.firstResult, beforeViewportShrink.firstResult, `${width}px: keyboard resize preserves result order`);
    assert.ok(keyboardLayout.stripBottom < keyboardLayout.viewportHeight, `${width}px: search remains above the keyboard area`);
    assert.ok(keyboardLayout.fullyVisibleRows >= 2, `${width}px: at least two complete results fit above the keyboard`);
    if (width === 390) {
      assert.match(keyboardLayout.filterSummary, /True Crime/u, "keyboard resize preserves the selected genre filter");
      await page.locator("#rankingMobileActiveFilterRemove").tap();
      await page.waitForFunction(() => !hasActiveRankingFilters());
      const afterClearingFilter = await page.evaluate(() => ({
        query: document.querySelector("#searchInput").value,
        focused: document.body.classList.contains("ranking-search-focused"),
        keyboardOpen: document.body.classList.contains("ranking-keyboard-open")
      }));
      assert.equal(afterClearingFilter.query, "mand", "clearing an active filter preserves the search query");
      assert.equal(afterClearingFilter.focused, true, "clearing an active filter keeps the compact search view in place");
      assert.equal(afterClearingFilter.keyboardOpen, true, "clearing a filter does not collapse the view beneath the open keyboard");
    }

    await page.setViewportSize({ width, height: 844 });
    await page.waitForFunction(() => !document.body.classList.contains("ranking-keyboard-open"));
    assert.notEqual(
      await page.locator(".site-nav").evaluate((nav) => getComputedStyle(nav).display),
      "none",
      `${width}px: bottom navigation returns when the keyboard closes`
    );

    await search.evaluate((input) => input.blur());
    await page.waitForFunction(() => !document.body.classList.contains("ranking-search-focused"));
    const restoredLayout = await page.evaluate(() => ({
      navigationDisplay: getComputedStyle(document.querySelector(".site-nav")).display,
      titleDisplay: getComputedStyle(document.querySelector("#rankingMobilePageHeader")).display,
      sortDisplay: getComputedStyle(document.querySelector("#mobileSortToggle")).display,
      searchValue: document.querySelector("#searchInput").value
    }));
    assert.notEqual(restoredLayout.navigationDisplay, "none", `${width}px: navigation returns after leaving search`);
    assert.notEqual(restoredLayout.titleDisplay, "none", `${width}px: ranking header returns after leaving search`);
    assert.notEqual(restoredLayout.sortDisplay, "none", `${width}px: sort button returns after leaving search`);
    assert.equal(restoredLayout.searchValue, "mand", `${width}px: leaving search preserves the entered query`);
    await context.close();
  }

  for (const width of [1024, 1280, 1440]) {
    const { context, page } = await openRankingPage(width, 900, false);
    const search = page.locator("#searchInput");
    const initial = await page.evaluate(() => ({
      headingDisplay: getComputedStyle(document.querySelector("#rankingListHeading")).display,
      searchTop: document.querySelector(".ranking-search-strip").getBoundingClientRect().top
    }));
    await search.click();
    const desktop = await page.evaluate(() => ({
      focused: document.body.classList.contains("ranking-search-focused"),
      headingDisplay: getComputedStyle(document.querySelector("#rankingListHeading")).display,
      searchTop: document.querySelector(".ranking-search-strip").getBoundingClientRect().top
    }));
    assert.equal(desktop.focused, false, `${width}px: desktop does not enter mobile search mode`);
    assert.equal(desktop.headingDisplay, initial.headingDisplay, `${width}px: desktop heading is unchanged`);
    assert.equal(desktop.searchTop, initial.searchTop, `${width}px: desktop search position is unchanged`);
    await context.close();
  }

  assert.deepEqual(errors, [], "mobile search focus has no uncaught browser errors");
  console.log("Ranking mobile search focus regression checks passed at 320, 375, 390, 768, 1024, 1280 and 1440 px.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
