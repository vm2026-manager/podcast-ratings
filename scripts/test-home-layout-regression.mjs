import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedGenres = ["True Crime", "Historie", "Krig", "Politik", "Finans", "Samfund", "Sport", "Dokumentar", "Viden", "Underholdning"];
const indexSource = await readFile(path.join(root, "index.html"), "utf8");
assert.match(indexSource, /desktop-home-mockup\.css\?v=20261105-ranking-column-header-v1/u, "The homepage stylesheet cache version matches the desktop ranking header alignment fix");
assert.match(indexSource, /app\.js\?v=20261111-issue87-leopold-cover-fallback/u, "The homepage uses the cache-busted JavaScript that includes the verified Leopold cover fallback");
assert.match(indexSource, /mobile-home-profile\.css\?v=20261108-home-popular-now-v1/u, "The mobile shortcut stylesheet cache version is current");
const server = createServer(async (request, response) => {
  try {
    const urlPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const filePath = path.resolve(root, `.${urlPath === "/" ? "/index.html" : urlPath}`);
    if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, "index.html")) {
      response.writeHead(403).end();
      return;
    }
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    const extension = path.extname(filePath).toLowerCase();
    const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
    response.writeHead(200, { "content-type": types[extension] || "application/octet-stream", "cache-control": "no-store" });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
try {
  for (const width of [320, 375, 390, 430, 768, 1024, 1101, 1280, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`http://127.0.0.1:${server.address().port}/#forside`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => state.podcasts.length > 0 && document.querySelectorAll("#pageIntroPanel .home-genres__grid .home-genres-card").length === 5);
    const layout = await page.evaluate(() => {
      const root = document.querySelector("#pageIntroPanel");
      const genres = root.querySelector(".home-genres");
      const grid = genres.querySelector(".home-genres__grid");
      const rect = (element) => {
        const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
        return { left, right, top, bottom, width, height };
      };
      const cards = [...grid.querySelectorAll(".home-genres-card")];
      const shortcut = grid.querySelector(".home-popular-now-card");
      const popularityScores = new Map(CANONICAL_GENRES.map((genre) => [genre, 0]));
      const ratedPodcastIds = new Set();
      state.podcasts.forEach((podcast) => {
        const podcastId = getPodcastId(podcast);
        if (!podcastId || ratedPodcastIds.has(podcastId) || parseNumber(podcast.ratingValue) === null) return;
        ratedPodcastIds.add(podcastId);
        CANONICAL_GENRES.forEach((genre) => {
          if (podcastHasGenre(podcast, genre)) popularityScores.set(genre, popularityScores.get(genre) + 1);
        });
      });
      const rankedHomeGenres = CANONICAL_GENRES
        .map((genre, canonicalOrder) => ({ genre, score: popularityScores.get(genre), canonicalOrder }))
        .sort((left, right) => right.score - left.score || left.canonicalOrder - right.canonicalOrder)
        .slice(0, 5);
      const clipping = (element) => {
        const child = rect(element);
        const clippedBy = [];
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          const overflow = getComputedStyle(parent).overflowY;
          if (!["hidden", "clip"].includes(overflow)) continue;
          const bounds = rect(parent);
          if (child.top < bounds.top - 1 || child.bottom > bounds.bottom + 1) clippedBy.push(parent.className || parent.id || parent.tagName);
        }
        return clippedBy;
      };
      const quick = [...root.querySelectorAll(".home-quick-card")];
      return {
        pageWidth: document.documentElement.scrollWidth,
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        canonicalGenres: [...CANONICAL_GENRES],
        rankedHomeGenres,
        panel: rect(root),
        genres: rect(genres),
        genreOverflowY: getComputedStyle(genres).overflowY,
        grid: rect(grid),
        gridScrollHeight: grid.scrollHeight,
        shortcut: shortcut ? {
          visible: getComputedStyle(shortcut).display !== "none",
          isGenre: shortcut.matches(".home-genres-card") || shortcut.hasAttribute("data-genre"),
          label: shortcut.querySelector(".home-popular-now-card__label")?.textContent.trim(),
          labelWidth: shortcut.querySelector(".home-popular-now-card__label")?.clientWidth || 0,
          labelScrollWidth: shortcut.querySelector(".home-popular-now-card__label")?.scrollWidth || 0,
          clippedBy: clipping(shortcut),
          ...rect(shortcut)
        } : null,
        quick: quick.map((element) => ({ label: element.innerText.trim(), ...rect(element), clippedBy: clipping(element) })),
        cards: cards.map((element) => ({ label: element.querySelector(".home-genres-card__genre")?.textContent.trim(), labelWidth: element.querySelector(".home-genres-card__genre")?.clientWidth, labelScrollWidth: element.querySelector(".home-genres-card__genre")?.scrollWidth, labelHeight: element.querySelector(".home-genres-card__genre")?.clientHeight, labelScrollHeight: element.querySelector(".home-genres-card__genre")?.scrollHeight, genre: element.dataset.genre, ...rect(element), clippedBy: clipping(element) }))
      };
    });
    assert.ok(layout.pageWidth <= width, `Home page has horizontal overflow at ${width}px: ${JSON.stringify(layout)}`);
    assert.equal(layout.cards.length, 5, `The home shows exactly five genres at ${width}px`);
    assert.equal(layout.shortcut?.visible, width <= 430, `The popular-now shortcut is visible only in the approved mobile grid at ${width}px`);
    assert.equal(layout.shortcut?.isGenre, false, `The popular-now shortcut is not registered as a genre at ${width}px`);
    assert.equal(layout.shortcut?.label, "Populære lige nu", `The shortcut has the approved label at ${width}px`);
    if (width <= 430) {
      const lastGenre = layout.cards.at(-1);
      assert.ok(Math.abs(layout.shortcut.left - lastGenre.right - 10) <= 1, `The shortcut is not in the bottom-right sixth grid cell at ${width}px`);
      assert.ok(Math.abs(layout.shortcut.width - lastGenre.width) <= 1 && Math.abs(layout.shortcut.height - lastGenre.height) <= 1, `The shortcut does not match the genre card dimensions at ${width}px`);
      assert.ok(layout.shortcut.right <= width + 1 && layout.shortcut.clippedBy.length === 0, `The shortcut is clipped at ${width}px`);
      assert.ok(layout.shortcut.labelWidth > 0 && layout.shortcut.labelScrollWidth <= layout.shortcut.labelWidth + 1, `The shortcut label overflows at ${width}px`);
    }
    assert.deepEqual(layout.canonicalGenres, expectedGenres, "The full canonical set remains available in rankings");
    assert.deepEqual(layout.cards.map((card) => card.label), layout.rankedHomeGenres.map(({ genre }) => genre), `Home genres are selected by catalogue popularity at ${width}px`);
    assert.notDeepEqual(layout.cards.map((card) => card.label), expectedGenres.slice(0, 5), "Home selection is not simply the first five canonical genres");
    assert.ok(layout.cards.every((card) => card.width > 0 && card.height > 0 && card.clippedBy.length === 0), `A genre card is clipped at ${width}px: ${JSON.stringify({ genres: layout.genres, grid: layout.grid, quick: layout.quick, cards: layout.cards })}`);
    assert.ok(layout.cards.every((card) => card.right <= width + 1), `A genre card extends outside the viewport at ${width}px`);
    assert.ok(layout.cards.every((card) => card.labelWidth > 0 && card.labelScrollWidth <= card.labelWidth + 1), `A genre label is clipped at ${width}px: ${JSON.stringify(layout.cards.filter((card) => card.labelScrollWidth > card.labelWidth + 1))}`);
    assert.ok(layout.cards.every((card) => card.labelHeight > 0 && card.labelScrollHeight <= card.labelHeight + 2), `A genre label is clipped vertically at ${width}px: ${JSON.stringify(layout.cards.filter((card) => card.labelScrollHeight > card.labelHeight + 2))}`);
    assert.ok(layout.quick.length === 2 && layout.quick.every((card) => card.width > 0 && card.height > 0 && card.clippedBy.length === 0), `Quick cards are clipped or missing at ${width}px`);
    assert.ok(Math.abs(layout.quick[0].top - layout.quick[1].top) <= 1 && Math.abs(layout.quick[0].bottom - layout.quick[1].bottom) <= 1, `Top podcasts and Mine gemte are misaligned at ${width}px`);
    if (width >= 1101) {
      assert.ok(Math.abs(layout.genres.top - layout.quick[0].top) <= 1, `Top i genrer is not aligned with the quick cards at ${width}px`);
      assert.ok(Math.abs(layout.genres.left - layout.quick[1].right - 14) <= 1, `The cards do not have a consistent gap at ${width}px`);
      assert.ok(Math.abs(layout.genres.height - layout.quick[0].height) <= 1, `The three desktop panels do not share aligned bounds at ${width}px`);
      assert.equal(layout.genreOverflowY, "visible", `The desktop genre panel clips vertically at ${width}px`);
      assert.ok(layout.gridScrollHeight <= layout.grid.height + 1, `The desktop genre grid has clipped rows at ${width}px`);
      assert.ok(layout.cards.every((card) => Math.abs(card.top - layout.cards[0].top) <= 1), `The desktop genre cards do not form one row at ${width}px`);
    }
    for (let index = 0; index < layout.cards.length; index += 1) {
      for (let other = index + 1; other < layout.cards.length; other += 1) {
        const left = layout.cards[index];
        const right = layout.cards[other];
        assert.ok(left.bottom <= right.top || right.bottom <= left.top || left.right <= right.left || right.right <= left.left, `Home genre cards overlap at ${width}px`);
      }
    }
    console.log(`${width}px: ${layout.cards.length} selected genres in ${layout.columns} columns`);
  }

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`http://127.0.0.1:${server.address().port}/#forside`, { waitUntil: "domcontentloaded" });
  const firstHomeGenre = page.locator("#pageIntroPanel .home-genres-card").first();
  const clickedGenre = await firstHomeGenre.getAttribute("data-genre");
  await firstHomeGenre.waitFor({ state: "visible" });
  assert.equal(await firstHomeGenre.getAttribute("role"), "link");
  assert.equal(await firstHomeGenre.getAttribute("tabindex"), "0", "Genre card is keyboard focusable");
  await firstHomeGenre.click();
  await page.waitForFunction((genre) => state.activeFilter?.type === "genre" && state.activeFilter.value === genre, clickedGenre);
  await page.goto(`http://127.0.0.1:${server.address().port}/#forside`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.podcasts.length > 0 && document.querySelectorAll("#pageIntroPanel .home-genres-card").length === 5);
  const keyboardGenre = page.locator("#pageIntroPanel .home-genres-card").nth(1);
  const keyboardGenreValue = await keyboardGenre.getAttribute("data-genre");
  assert.equal(await keyboardGenre.getAttribute("role"), "link");
  assert.equal(await keyboardGenre.getAttribute("tabindex"), "0", "Genre card is keyboard focusable");
  await keyboardGenre.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction((genre) => state.activeFilter?.type === "genre" && state.activeFilter.value === genre, keyboardGenreValue);

  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto(`http://127.0.0.1:${server.address().port}/#forside`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.podcasts.length > 0 && document.querySelector("#pageIntroPanel .home-popular-now-card"));
  const popularShortcut = page.locator("#pageIntroPanel .home-popular-now-card");
  const preservedHomeFilter = await page.evaluate(() => ({ activeFilter: state.activeFilter, minimumRating: state.minimumRating }));
  assert.equal(await popularShortcut.getAttribute("type"), "button", "The shortcut uses native button keyboard behavior");
  assert.equal(await popularShortcut.getAttribute("data-genre"), null, "The shortcut has no genre filter value");
  assert.equal(await popularShortcut.evaluate((element) => element.matches(".home-genres-card")), false, "The shortcut is not a genre card");
  await popularShortcut.click();
  await page.waitForFunction(() => location.hash === "#ranglister" && state.popularNowActive && state.rankingSource === "users");
  assert.deepEqual(await page.evaluate(() => ({ activeFilter: state.activeFilter, minimumRating: state.minimumRating })), preservedHomeFilter,
    "Activating the shortcut preserves active ranking filters");
  await page.goBack();
  await page.waitForFunction(() => location.hash === "#forside" && state.popularNowActive);
  await popularShortcut.evaluate((element) => element.focus({ focusVisible: true }));
  const shortcutFocus = await popularShortcut.evaluate((element) => ({
    visible: element.matches(":focus-visible"),
    outlineStyle: getComputedStyle(element).outlineStyle,
    outlineWidth: getComputedStyle(element).outlineWidth
  }));
  assert.equal(shortcutFocus.visible, true, "Keyboard focus is visible on the shortcut");
  assert.equal(shortcutFocus.outlineStyle, "solid", "Keyboard focus has a visible outline");
  assert.equal(shortcutFocus.outlineWidth, "2px", "Keyboard focus outline has the approved thickness");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.hash === "#ranglister" && state.popularNowActive,
    undefined, { timeout: 10000 });
  assert.equal(await page.evaluate(() => state.popularNowActive), true, "Keyboard activation does not toggle an already active mode off");
  await page.goBack();
  await page.waitForFunction(() => location.hash === "#forside");

  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto(`http://127.0.0.1:${server.address().port}/#forside`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.podcasts.length > 0 && document.querySelectorAll("#pageIntroPanel .home-genres-card").length === 5);
  const allGenresLink = page.locator("#pageIntroPanel [data-home-genres-all]");
  await allGenresLink.scrollIntoViewIfNeeded();
  assert.ok(await allGenresLink.evaluate((element) => element.getBoundingClientRect().top >= 0 && element.getBoundingClientRect().bottom <= innerHeight), "Se alle remains scroll-accessible on mobile");
  await page.setViewportSize({ width: 1280, height: 1000 });
  await allGenresLink.click();
  await page.waitForFunction(() => location.hash === "#ranglister" && document.querySelectorAll(".ranking-sidebar-column .genre-chip").length === 11);
  const rankingGenres = await page.locator(".ranking-sidebar-column .genre-chip").allTextContents();
  assert.deepEqual(rankingGenres.map((genre) => genre.trim()), ["Alle", ...expectedGenres], "Se alle retains all ten canonical ranking genres");
  const firstRankingGenre = page.locator(".ranking-sidebar-column .genre-chip").first();
  await firstRankingGenre.scrollIntoViewIfNeeded();
  assert.ok(await firstRankingGenre.evaluate((element) => element.getBoundingClientRect().top < innerHeight), "The all-genres destination remains scroll-accessible");
  await page.setViewportSize({ width: 390, height: 640 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "The all-genres mobile destination has no horizontal overflow");
  const mobileFilterToggle = page.locator("#rankingMobileFilterToggle");
  if (await mobileFilterToggle.isVisible() && (await mobileFilterToggle.getAttribute("aria-expanded")) !== "true") await mobileFilterToggle.click();
  await page.waitForFunction(() => document.getElementById("rankingFilterPanel")?.hidden === false);
  const mobileRankingGenres = await page.locator("#rankingFilterPanel .genre-chip").allTextContents();
  assert.deepEqual(mobileRankingGenres.map((genre) => genre.trim()), ["Alle", ...expectedGenres], "All ten canonical genres remain accessible from the mobile rankings panel");
  console.log("Home layout, popularity selection, click/keyboard, scroll, and all-genres navigation checks passed.");
} finally {
  await browser.close();
  server.close();
}
