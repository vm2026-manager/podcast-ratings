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
const evidenceQueries = [
  { query: "svindel", ids: ["kvinden med den tunge kuffert", "den forunderlige dr kavousi"] },
  { query: "den kolde krig", ids: ["konspirativ kærlighed", "operation romeo"] },
  { query: "terrorangreb i København", ids: ["døgnet der rystede danmark", "danmarks første terrorangreb"] },
  { query: "anden verdenskrig", ids: ["krigen pa isen", "agent piccadilly"] },
  { query: "sekter", ids: ["charles manson", "min mor blev ramt af en sekt"] },
  { query: "spionage", ids: ["operation pellegrino", "konspirativ kærlighed"] },
  { query: "forsvindinger", ids: ["historien om lukas", "dødens duo"] },
  { query: "familiehemmeligheder", ids: ["mors afskedsbrev", "et ekstremt hemmeligt liv"] },
  { query: "stalking", ids: ["pa flugt fra min stalker", "broder salsa"] },
  { query: "Christiansborg", ids: ["borgen unplugged 2 0", "slotsholmen"] },
  { query: "krigen i Ukraine", ids: ["darligt nyt fra østfronten", "fri ukraine"] },
  { query: "kunstig intelligens", ids: ["prompt", "sam altman"] },
  { query: "Sovjetunionen", ids: ["monsteret i tjernobyl", "katynskovens hemmelighed"] },
  { query: "klimakrisen", ids: ["information forklarer klimaet", "greta thunberg"] },
  { query: "dating", ids: ["single igen sæson 3", "bag om bachelorette sæson 2"] },
  { query: "bander", ids: ["banderelateret", "velfærdsbanderne"] },
  { query: "magtmisbrug", ids: ["politichefens hemmelighed", "i hænderne pa hr doktor"] },
  { query: "terror", ids: ["døgnet der rystede danmark", "den endeløse krig"] }
];

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

async function openRankingPage(context) {
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/u, (route) => route.abort());
  await page.goto(`${origin}/#ranglister`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => state.podcastDataStatus === "ready" && state.podcasts.length > 1000,
    null,
    { timeout: 30000 }
  );
  await page.waitForFunction(() => !document.querySelector("#rankingSearchInspiration")?.hidden);
  return page;
}

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const desktop = await openRankingPage(desktopContext);

  const verifiedSearches = await desktop.evaluate((queries) => {
    const catalogueIds = getRankingCandidates().map((podcast) => podcast.podcastId);
    return {
      catalogueIds,
      suggestions: [...document.querySelectorAll("#rankingSearchInspirationItems button")].map((button) => button.textContent.trim()),
      source: state.rankingSource,
      anonymous: !state.authUser,
      queries: queries.map(({ query, ids }) => {
        const matches = getRankingCandidates().filter((podcast) => matchesRankingEnhancedSearch(podcast, query));
        return {
          query,
          ids: matches.map((podcast) => podcast.podcastId),
          expectedIds: ids
        };
      }),
      genreLabels: GENRES.filter((genre) => genre !== "Alle")
    };
  }, evidenceQueries);

  assert.equal(verifiedSearches.suggestions.length, 3, "three suggestions are shown at a time");
  assert.deepEqual(verifiedSearches.suggestions, ["Svindel", "Den kolde krig", "Terrorangreb i København"]);
  assert.ok(verifiedSearches.anonymous, "search suggestions are available without a signed-in user");
  assert.ok(["mads", "users"].includes(verifiedSearches.source), "the existing ranking source remains selected");
  assert.ok(verifiedSearches.suggestions.every((label) => !verifiedSearches.genreLabels.includes(label)), "suggestions are topics, not genres");

  for (const result of verifiedSearches.queries) {
    const uniqueIds = new Set(result.ids);
    assert.ok(result.ids.length >= 2, `“${result.query}” returns at least two catalogue IDs`);
    assert.equal(uniqueIds.size, result.ids.length, `“${result.query}” has no duplicate Podcast-IDs`);
    for (const expectedId of result.expectedIds) {
      assert.ok(uniqueIds.has(expectedId), `“${result.query}” includes verified Podcast-ID ${expectedId}`);
    }
  }

  const next = desktop.locator("#rankingSearchInspirationNext");
  await next.focus();
  assert.equal(await desktop.evaluate(() => document.activeElement?.id), "rankingSearchInspirationNext", "rotation control is keyboard focusable");
  await desktop.keyboard.press("Enter");
  assert.deepEqual(
    await desktop.locator("#rankingSearchInspirationItems button").allTextContents(),
    ["Anden verdenskrig", "Sekter", "Spionage"],
    "keyboard activation rotates to the next three suggestions"
  );
  await next.focus();
  await desktop.keyboard.press("Space");
  assert.deepEqual(
    await desktop.locator("#rankingSearchInspirationItems button").allTextContents(),
    ["Forsvindinger", "Familiehemmeligheder", "Stalking"],
    "Space also rotates suggestions"
  );

  await desktop.locator("#rankingSearchInspirationItems button").first().click();
  assert.equal(await desktop.evaluate(() => state.rankingSource), verifiedSearches.source, "using a suggestion preserves the selected ranking source");
  assert.equal(await desktop.locator("#searchInput").inputValue(), "forsvindinger", "a suggestion fills the ranking search");
  assert.equal(await desktop.evaluate(() => state.searchTerm), "forsvindinger", "a suggestion uses the ranking search state");
  assert.equal(await desktop.evaluate(() => new URL(location.href).searchParams.get("s")), "forsvindinger", "a suggestion creates the canonical ranking search URL");
  assert.equal(await desktop.locator("#rankingSearchInspiration").isVisible(), false, "suggestions hide while a query is active");
  assert.ok(await desktop.evaluate(() => getFilteredPodcasts().some((podcast) => podcast.podcastId === "historien om lukas")), "selected suggestion filters the ranking to matching podcasts");
  await desktop.locator("#searchClearButton").click();
  assert.equal(await desktop.evaluate(() => new URL(location.href).searchParams.has("s")), false, "clearing search removes the query parameter");
  assert.equal(await desktop.locator("#rankingSearchInspiration").isVisible(), true, "suggestions return after clearing the query");

  await desktop.evaluate(() => setMinimumRating(8));
  assert.equal(await desktop.locator("#rankingSearchInspiration").isVisible(), true, "suggestions remain when a non-genre rating filter is active");
  assert.equal(await desktop.locator(".desktop-ranking-search-filter-summary").isVisible(), true, "active non-genre filters remain visible beside suggestions");
  const desktopFilterLayout = await desktop.evaluate(() => {
    const strip = document.querySelector(".ranking-search-strip");
    const boxes = [
      strip.querySelector(".search-field"),
      strip.querySelector(".ranking-search-actions"),
      strip.querySelector(".desktop-ranking-search-filter-summary")
    ].map((element) => element.getBoundingClientRect().toJSON());
    return { strip: strip.getBoundingClientRect().toJSON(), boxes };
  });
  const [searchBox, actionsBox, filtersBox] = desktopFilterLayout.boxes;
  const boxesDoNotOverlap = (first, second) =>
    first.right <= second.left + 1 || second.right <= first.left + 1 ||
    first.bottom <= second.top + 1 || second.bottom <= first.top + 1;
  assert.ok(boxesDoNotOverlap(searchBox, actionsBox), "active filters do not crowd the search field");
  assert.ok(boxesDoNotOverlap(actionsBox, filtersBox), "suggestions leave room for visible active filter chips");
  const filteredDesktopLayouts = [];
  for (const width of [1024, 1101, 1280, 1440]) {
    await desktop.setViewportSize({ width, height: 900 });
    filteredDesktopLayouts.push(await desktop.evaluate(() => {
      const strip = document.querySelector(".ranking-search-strip");
      const rect = (selector) => strip.querySelector(selector).getBoundingClientRect().toJSON();
      return {
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        search: rect(".search-field"),
        actions: rect(".ranking-search-actions"),
        filters: strip.querySelector(".desktop-ranking-search-filter-summary")?.getBoundingClientRect().toJSON() || null
      };
    }));
  }
  for (const layout of filteredDesktopLayouts) {
    assert.equal(layout.scrollWidth, layout.width, `active filters fit without horizontal overflow at ${layout.width}px`);
    assert.ok(boxesDoNotOverlap(layout.search, layout.actions), `search and suggestions remain distinct with active filters at ${layout.width}px`);
    if (layout.filters) {
      assert.ok(boxesDoNotOverlap(layout.actions, layout.filters), `active filter chips remain distinct from suggestions at ${layout.width}px`);
    }
  }
  await desktop.evaluate(() => setMinimumRating(0));

  await desktop.evaluate(() => setActiveFilter("genre", "True Crime"));
  assert.equal(await desktop.locator("#rankingSearchInspiration").isVisible(), false, "suggestions hide when a genre is selected");
  await desktop.evaluate(() => setActiveFilter(null, ""));
  assert.equal(await desktop.locator("#rankingSearchInspiration").isVisible(), true, "suggestions return when the genre filter is cleared");

  await desktop.evaluate(() => handleRankingSourceChange("users"));
  assert.equal(await desktop.locator("#rankingSearchInspiration").isVisible(), true, "suggestions also work with the user ranking source");
  await desktop.evaluate(() => handleRankingSourceChange("mads"));

  const desktopLayouts = [];
  for (const width of [1024, 1101, 1280, 1440]) {
    await desktop.setViewportSize({ width, height: 900 });
    desktopLayouts.push(await desktop.evaluate(() => {
      const strip = document.querySelector(".ranking-search-strip");
      const search = strip.querySelector(".search-field").getBoundingClientRect();
      const actions = strip.querySelector(".ranking-search-actions").getBoundingClientRect();
      const suggestion = strip.querySelector("#rankingSearchInspiration").getBoundingClientRect();
      return {
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        strip: strip.getBoundingClientRect().toJSON(),
        search: search.toJSON(),
        actions: actions.toJSON(),
        suggestion: suggestion.toJSON()
      };
    }));
  }
  for (const layout of desktopLayouts) {
    assert.equal(layout.scrollWidth, layout.width, `desktop has no horizontal overflow at ${layout.width}px`);
    assert.ok(layout.search.right <= layout.actions.left + 1 || layout.search.bottom <= layout.actions.top + 1, `search and suggestion controls do not overlap at ${layout.width}px: ${JSON.stringify(layout)}`);
    assert.ok(layout.suggestion.right <= layout.width, `suggestions fit at ${layout.width}px`);
  }

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const mobile = await openRankingPage(mobileContext);
  const mobileLayouts = [];
  for (const width of [320, 375, 390, 768]) {
    await mobile.setViewportSize({ width, height: 844 });
    mobileLayouts.push(await mobile.evaluate(() => {
      const strip = document.querySelector(".ranking-search-strip");
      const suggestion = strip.querySelector("#rankingSearchInspiration");
      const buttons = [...suggestion.querySelectorAll("button")].map((button) => button.getBoundingClientRect().toJSON());
      return {
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        strip: strip.getBoundingClientRect().toJSON(),
        suggestion: suggestion.getBoundingClientRect().toJSON(),
        buttons
      };
    }));
  }
  for (const layout of mobileLayouts) {
    assert.equal(layout.scrollWidth, layout.width, `mobile has no horizontal overflow at ${layout.width}px`);
    assert.ok(layout.suggestion.left >= 0 && layout.suggestion.right <= layout.width, `suggestions stay inside the mobile viewport at ${layout.width}px`);
    assert.ok(layout.buttons.every((rect) => rect.left >= 0 && rect.right <= layout.width), `all suggestion buttons fit at ${layout.width}px`);
  }

  await mobile.setViewportSize({ width: 320, height: 844 });
  const beforeTouchRotation = await mobile.locator("#rankingSearchInspirationItems button").allTextContents();
  await mobile.locator("#rankingSearchInspirationNext").tap();
  assert.notDeepEqual(await mobile.locator("#rankingSearchInspirationItems button").allTextContents(), beforeTouchRotation, "touch rotates suggestions");
  await mobile.locator("#rankingSearchInspirationItems button").first().tap();
  assert.ok(await mobile.locator("#searchInput").inputValue(), "touching a topic begins a search");
  assert.equal(await mobile.locator("#rankingSearchInspiration").isVisible(), false, "mobile suggestions hide after a topic is selected");
  await mobile.locator("#searchClearButton").tap();
  await mobile.evaluate(() => setMinimumRating(8));
  assert.equal(await mobile.locator("#rankingSearchInspiration").isVisible(), true, "mobile suggestions remain with non-genre filters");
  await mobile.evaluate(() => setActiveFilter("genre", "True Crime"));
  assert.equal(await mobile.locator("#rankingSearchInspiration").isVisible(), false, "mobile suggestions hide for an active genre");

  assert.deepEqual(errors, [], "no browser runtime errors occur");
  console.log(`[ranking-search-inspiration] PASS (${evidenceQueries.length} evidence-backed searches, desktop and mobile)`);
} finally {
  await browser.close();
  server.close();
}
