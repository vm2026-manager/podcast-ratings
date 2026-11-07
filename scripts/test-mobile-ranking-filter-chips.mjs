import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(root, requested);
    if (!filePath.startsWith(root + path.sep) && filePath !== path.join(root, "index.html")) throw new Error("Invalid path");
    await stat(filePath);
    response.writeHead(200, { "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/u, (route) => route.abort());
  await page.goto(`${origin}/#ranglister`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.podcastDataStatus === "ready" && state.podcasts.length > 1000, null, { timeout: 30000 });

  const genre = await page.locator("#genreChips .genre-chip").evaluateAll((chips) => chips.map((chip) => chip.textContent.trim()).find((label) => label && label !== "Alle"));
  assert.ok(genre.trim(), "a real genre is available for interaction");
  const summary = page.locator("#rankingMobileFilterSummary");
  const chip = (name) => summary.getByRole("button", { name });
  const filterCount = () => page.evaluate(() => getFilteredPodcasts().length);
  const setFilters = (values = {}) => page.evaluate((next) => {
    clearRankingFilters();
    setLanguageFilter(next.language || "all");
    setFreeOnly(Boolean(next.free));
    if (next.genre) setActiveFilter("genre", next.genre);
  }, values);
  const clearAll = () => setFilters();

  assert.equal(await summary.isHidden(), true, "no chip area is shown without filters");
  await page.evaluate((value) => setActiveFilter("genre", value), genre.trim());
  assert.equal(await summary.isHidden(), false, "genre activates the chip area");
  assert.equal(await chip(`Fjern genrefilteret ${genre.trim()}`).count(), 1);
  await chip(`Fjern genrefilteret ${genre.trim()}`).click();
  assert.equal(await summary.isHidden(), true, "removing the genre hides the empty chip area");

  for (const [language, label] of [["danish", "Dansk"], ["english", "Engelsk"]]) {
    await page.evaluate((value) => setLanguageFilter(value), language);
    assert.equal(await chip(`Fjern sprogfiltret ${label}`).count(), 1, `${label} has an individual remove button`);
    await chip(`Fjern sprogfiltret ${label}`).click();
    assert.equal(await page.evaluate(() => state.languageFilter), "all", `${label} is cleared on its own`);
    assert.equal(await summary.isHidden(), true);
  }

  await page.evaluate(() => setFreeOnly(true));
  assert.equal(await chip("Fjern filteret Kun gratis").count(), 1, "free-only has an individual remove button");
  await chip("Fjern filteret Kun gratis").click();
  assert.equal(await page.evaluate(() => state.freeOnly), false);
  assert.equal(await summary.isHidden(), true);

  await setFilters({ genre: genre.trim(), language: "danish", free: true });
  assert.equal(await summary.getByRole("button").count(), 3, "genre, language and free chips coexist");
  const combinedCount = await filterCount();
  await chip(`Fjern genrefilteret ${genre.trim()}`).click();
  assert.deepEqual(await page.evaluate(() => ({ language: state.languageFilter, free: state.freeOnly })), { language: "danish", free: true });
  assert.ok(await filterCount() >= combinedCount, "removing genre broadens results while preserving other filters");
  await page.evaluate((value) => setActiveFilter("genre", value), genre.trim());
  await chip("Fjern sprogfiltret Dansk").click();
  assert.deepEqual(await page.evaluate(() => ({ genre: state.activeFilter?.value, free: state.freeOnly, language: state.languageFilter })), { genre: genre.trim(), free: true, language: "all" });
  await page.evaluate((value) => setLanguageFilter(value), "danish");
  await chip("Fjern filteret Kun gratis").click();
  assert.deepEqual(await page.evaluate(() => ({ genre: state.activeFilter?.value, language: state.languageFilter, free: state.freeOnly })), { genre: genre.trim(), language: "danish", free: false });

  await clearAll();
  await page.locator("#rankingMobileFilterToggle").click();
  assert.equal(await page.locator("#rankingMobileFilterToggle").getAttribute("aria-expanded"), "true");
  await page.evaluate((value) => setActiveFilter("genre", value), genre.trim());
  await page.locator('[data-ranking-language="english"]').click();
  await page.locator("#rankingFreeOnly").check();
  const selectedCount = await filterCount();
  await page.locator("#rankingMobileFilterToggle").click();
  assert.equal(await page.locator("#rankingMobileFilterToggle").getAttribute("aria-expanded"), "false");
  assert.equal(await filterCount(), selectedCount, "closing the filter panel preserves the selection");
  assert.equal(await summary.getByRole("button").count(), 3);

  await page.evaluate(() => {
    state.searchTerm = "podcast";
    state.sort = "placement-asc";
    updateMobileRankingFilterUi();
  });
  await page.locator("#mobileSortToggle").click();
  assert.equal(await page.evaluate(() => state.sort), "placement-desc", "the existing sort control still changes sort order");
  assert.equal(await page.evaluate(() => state.searchTerm), "podcast", "filter updates preserve the search term");
  await clearAll();
  await page.evaluate(() => { state.searchTerm = ""; updateMobileRankingFilterUi(); });

  const specialGenre = `${genre.trim()} & ÆØÅ <test>`;
  await page.evaluate((value) => setActiveFilter("genre", value), specialGenre);
  assert.equal((await summary.locator("button").first().innerText()).replace(/\s+/gu, " "), `${specialGenre} ×`, "long and special genre text is escaped and readable");
  assert.equal(await page.locator("#rankingMobileFilterSummary #chip-xss").count(), 0, "chip text is not interpreted as markup");
  await clearAll();

  for (const width of [320, 375, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await setFilters({ genre: specialGenre, language: "danish", free: true });
    const layout = await page.evaluate(() => {
      const toolbar = document.querySelector(".ranking-toolbar");
      const sort = document.querySelector("#mobileSortToggle");
      const summary = document.querySelector("#rankingMobileFilterSummary");
      const chips = [...summary.querySelectorAll("button")];
      const box = (element) => element.getBoundingClientRect();
      return {
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        sortX: box(sort).x,
        summaryX: box(summary).x,
        toolbarBottom: box(toolbar).bottom,
        chipRects: chips.map((item) => ({ x: box(item).x, right: box(item).right, bottom: box(item).bottom, height: box(item).height })),
        summaryHidden: summary.hidden
      };
    });
    assert.equal(layout.scrollWidth, layout.width, `no horizontal overflow at ${width}px`);
    assert.equal(layout.sortX, await page.locator(".ranking-toolbar").evaluate((el) => el.getBoundingClientRect().x), `sort remains left aligned at ${width}px`);
    assert.ok(layout.summaryX >= layout.sortX, `chips follow the sort control at ${width}px`);
    assert.ok(layout.chipRects.every((rect) => rect.height >= 40 && rect.right <= width), `chips remain touch sized and inside viewport at ${width}px`);

    await chip("Fjern sprogfiltret Dansk").tap();
    assert.equal(await page.evaluate(() => state.languageFilter), "all", `touch activation removes a chip at ${width}px`);
    await setFilters({ genre: specialGenre, language: "danish", free: true });

    await page.evaluate(() => window.scrollTo(0, 250));
    const beforeScroll = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => setFreeOnly(false));
    assert.equal(await page.evaluate(() => window.scrollY), beforeScroll, `filter updates do not jump scroll at ${width}px`);
    await page.evaluate(() => setFreeOnly(true));
    await clearAll();
  }

  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await setFilters({ genre: genre.trim(), language: "danish", free: true });
    assert.equal(await summary.isHidden(), true, `mobile summary stays out of desktop layout at ${width}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth), true, `desktop has no horizontal overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.classList.add("force-desktop-view"); document.body.classList.add("force-desktop-view"); });
  assert.equal(await summary.isHidden(), true, "force-desktop-view preserves desktop filtering layout");
  await page.evaluate(() => { document.documentElement.classList.remove("force-desktop-view"); document.body.classList.remove("force-desktop-view"); });

  await clearAll();
  const directUrl = `${origin}/?genre=${encodeURIComponent(genre.trim())}#ranglister`;
  await page.goto(directUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction((value) => state.activeFilter?.type === "genre" && state.activeFilter.value === value, genre.trim());
  await chip(`Fjern genrefilteret ${genre.trim()}`).click();
  assert.equal(new URL(page.url()).searchParams.has("genre"), false, "removing a deep-linked genre removes its URL parameter");
  assert.equal(new URL(page.url()).hash, "#ranglister", "genre removal preserves the ranking route");

  await page.evaluate((value) => setActiveFilter("genre", value), genre.trim());
  await page.locator("#rankingMobileFilterToggle").click();
  await page.locator('[data-ranking-language="danish"]').focus();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.rankingLanguage), "danish", "filter controls can receive keyboard focus");
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => state.languageFilter), "danish", "keyboard activation selects a language");
  const languageChip = chip("Fjern sprogfiltret Dansk");
  await languageChip.focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => state.languageFilter), "all", "keyboard activation removes a chip");
  assert.deepEqual(errors, [], "filter interactions produce no uncaught browser errors");
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log("Mobile ranking filter chips regression passed at 320, 375, 390, 768, 1280, 1440 and force-desktop-view.");
