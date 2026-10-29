import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogue = JSON.parse(await readFile(path.join(root, "data/podcasts.json"), "utf8"));
const expectedGenres = [
  "Alle", "True Crime", "Historie", "Krig", "Politik", "Finans", "Samfund", "Sport", "Dokumentar", "Viden", "Underholdning"
];
const appSource = await readFile(path.join(root, "app.js"), "utf8");
const indexSource = await readFile(path.join(root, "index.html"), "utf8");
const styleSource = await readFile(path.join(root, "style.css"), "utf8");
assert.equal(catalogue.rows.length, catalogue.count, "The catalogue wrapper count matches its source rows");
assert.match(indexSource, /app\.js\?v=20261029-issue-382-v2/u);
assert.match(appSource, /const CANONICAL_GENRES = Object\.freeze\(\[/u);
assert.match(appSource, /const GENRES = Object\.freeze\(\["Alle", ...CANONICAL_GENRES\]\);/u);
assert.doesNotMatch(appSource, /const HOME_GENRES/u);
assert.doesNotMatch(appSource.match(/const GENRES = [^;]+;/u)?.[0] || "", /Sladder/u);
assert.match(appSource, /function getPodcastDetailGenres\(/u);
assert.match(appSource, /function getSharedDisplayGroupGenres\(/u);
assert.match(appSource, /function renderPodcastGenreTags\(/u);

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
const address = server.address();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (error) => { throw error; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/u, (route) => route.abort());
  await page.goto(`http://127.0.0.1:${address.port}/#ranglister`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll(".ranking-sidebar-column .genre-chip").length === 11, null, { timeout: 30000 });

  const desktop = await page.evaluate(() => {
    const container = document.querySelector(".ranking-sidebar-column .genre-chips");
    const buttons = [...container.querySelectorAll(".genre-chip")];
    const rects = buttons.map((button) => ({
      label: button.textContent.trim(),
      left: button.getBoundingClientRect().left,
      right: button.getBoundingClientRect().right,
      top: button.getBoundingClientRect().top,
      bottom: button.getBoundingClientRect().bottom,
      scrollWidth: button.scrollWidth,
      clientWidth: button.clientWidth,
      gridColumn: getComputedStyle(button).gridColumn
    }));
    return { labels: buttons.map((button) => button.textContent.trim()), display: getComputedStyle(container).display, columns: getComputedStyle(container).gridTemplateColumns.split(" ").length, rects };
  });
  assert.deepEqual(desktop.labels, expectedGenres);
  assert.equal(desktop.display, "grid");
  assert.equal(desktop.columns, 2);
  assert.match(desktop.rects.at(-1).gridColumn, /1\s*\/\s*-1/u);
  assert.ok(desktop.rects.every((button) => button.scrollWidth <= button.clientWidth + 2), "Long desktop labels fit their buttons");
  for (let index = 0; index < desktop.rects.length; index += 1) {
    for (let other = index + 1; other < desktop.rects.length; other += 1) {
      const left = desktop.rects[index];
      const right = desktop.rects[other];
      assert.ok(left.bottom <= right.top || right.bottom <= left.top || left.right <= right.left || right.right <= left.left, `Genre buttons overlap: ${left.label}, ${right.label}`);
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  const wideDesktop = await page.evaluate(() => {
    const container = document.querySelector(".ranking-sidebar-column .genre-chips");
    const buttons = [...container.querySelectorAll(".genre-chip")];
    return {
      labels: buttons.map((button) => button.textContent.trim()),
      columns: getComputedStyle(container).gridTemplateColumns.split(" ").length,
      rects: buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      })
    };
  });
  assert.deepEqual(wideDesktop.labels, expectedGenres);
  assert.equal(wideDesktop.columns, 2, "desktop ranking filters retain two columns at 1440px");
  for (let index = 0; index < wideDesktop.rects.length; index += 1) {
    for (let other = index + 1; other < wideDesktop.rects.length; other += 1) {
      const left = wideDesktop.rects[index], right = wideDesktop.rects[other];
      assert.ok(left.bottom <= right.top || right.bottom <= left.top || left.right <= right.left || right.right <= left.left, "Wide desktop genre buttons overlap");
    }
  }

  const helperResults = await page.evaluate(() => ({
    genres: GENRES,
    detail: getPodcastDetailGenres({ genre: "True Crime", secondaryGenre: "Dokumentar", tertiaryGenre: "True Crime" }),
    empty: getPodcastDetailGenres({ genre: "", secondaryGenre: "Sladder", tertiaryGenre: "Ugyldig" }),
    group: getSharedDisplayGroupGenres([
      { genre: "Historie", secondaryGenre: "Krig" },
      { genre: "Historie", secondaryGenre: "Politik" }
    ]),
    groupSeasonFallback: getSharedDisplayGroupGenres([
      { isDisplayGroupSeason: true, genre: "Finans" },
      { isDisplayGroupSeason: true, genre: "Finans", secondaryGenre: "Krig" }
    ]),
    topic: matchesPodcastTopicSearch({ searchTopics: ["Den Kolde Krig"] }, "Den Kolde Krig"),
    topicPartial: matchesPodcastTopicSearch({ searchTopics: ["Den Kolde Krig"] }, "Kolde Krig"),
    irrelevantTopic: matchesPodcastTopicSearch({ searchTopics: ["Dansk politik", "Europæisk historie"] }, "dansk historie"),
    tertiaryMatch: podcastHasGenre({ genre: "Historie", secondaryGenre: "Krig", tertiaryGenre: "Finans" }, "Finans"),
    canonical: getRankingCandidates().some((podcast) => podcast.title === "Kvinden med den tunge kuffert" && podcast.genre === "True Crime" && podcast.secondaryGenre === "Dokumentar"),
    genreIconsUseFallback: CANONICAL_GENRES.map((genre) => getGenreIconMarkup(genre) === getProfileStatIconMarkup("genre")),
    displayedPodcastCount: state.podcasts.length
  }));
  assert.deepEqual(helperResults.genres, expectedGenres);
  assert.deepEqual(helperResults.detail, ["True Crime", "Dokumentar"]);
  assert.deepEqual(helperResults.empty, []);
  assert.deepEqual(helperResults.group, ["Historie"]);
  assert.deepEqual(helperResults.groupSeasonFallback, ["Finans"]);
  assert.equal(helperResults.topic, true);
  assert.equal(helperResults.topicPartial, true);
  assert.equal(helperResults.irrelevantTopic, false);
  assert.equal(helperResults.tertiaryMatch, true);
  assert.equal(helperResults.canonical, true);
  assert.ok(helperResults.genreIconsUseFallback.every((fallback) => !fallback), "all canonical genres have dedicated icons");
  assert.ok(helperResults.displayedPodcastCount > 0);

  const hasDisplayGroup = await page.evaluate(() => {
    const group = getRankingCandidates().find((candidate) => candidate.title === "Narkobetjenten" && candidate.isDisplayGroup);
    if (!group) return false;
    openPodcastDetailSheet(group, null, { allowDesktop: true });
    return true;
  });
  assert.equal(hasDisplayGroup, true);
  const groupDetail = page.locator("#podcastDetailSheet:not(.is-hidden)");
  await groupDetail.waitFor({ state: "visible" });
  assert.deepEqual(
    (await groupDetail.locator("[data-podcast-detail-filter='genre']").allTextContents()).map((tag) => tag.trim()),
    ["True Crime", "Samfund"]
  );
  assert.ok(await groupDetail.locator("[data-podcast-seasons-open]").count(), "Season rating entry remains available");
  const groupChipOrder = await groupDetail.locator(".podcast-detail-sheet__chips > *").evaluateAll((nodes) => nodes.map((node) => node.matches(".podcast-detail-sheet__episode-entry") ? "episodes" : node.matches(".podcast-detail-sheet__genre") ? "genre" : node.matches(".podcast-detail-sheet__publisher") ? "publisher" : "other"));
  assert.equal(groupChipOrder[0], "episodes", "Season rating entry remains ahead of group genre tags");

  await page.evaluate(() => {
    const podcast = getRankingCandidates().find((candidate) => candidate.title === "Kvinden med den tunge kuffert");
    openPodcastDetailSheet(podcast, null, { allowDesktop: true });
  });
  const detail = page.locator("#podcastDetailSheet:not(.is-hidden)");
  await detail.waitFor({ state: "visible" });
  const detailTags = await detail.locator("[data-podcast-detail-filter='genre']").allTextContents();
  assert.deepEqual(detailTags.map((tag) => tag.trim()), ["True Crime", "Dokumentar"]);
  const detailOrder = await detail.locator(".podcast-detail-sheet__chips > *").evaluateAll((nodes) => nodes.map((node) => ({
    text: node.textContent.trim(),
    kind: node.matches(".podcast-detail-sheet__episode-entry") ? "episodes" : node.matches(".podcast-detail-sheet__genre") ? "genre" : node.matches(".podcast-detail-sheet__publisher") ? "publisher" : node.matches("[data-podcast-detail-filter='mainSeries']") ? "series" : "other"
  })));
  assert.equal(detailOrder[0].kind, "episodes");
  assert.match(detailOrder[0].text, /Vurd[eé]r episoder/u);
  assert.deepEqual(detailOrder.filter((item) => ["genre", "publisher", "series"].includes(item.kind)).map((item) => item.kind), ["genre", "genre", "publisher"]);
  assert.ok(await detail.locator(".podcast-detail-sheet__recommendation-row").count(), "Mere som dette row remains available");
  assert.ok(await detail.locator(".podcast-detail-sheet__ratings").count(), "Rating controls remain available");

  await detail.locator("[data-podcast-detail-filter='genre'][data-value='Dokumentar']").click();
  await page.waitForFunction(() => state.activeFilter?.type === "genre" && state.activeFilter.value === "Dokumentar");
  const secondaryFilter = await page.evaluate(() => {
    const results = getFilteredPodcasts();
    const keys = results.map(getPodcastKey);
    return { active: state.activeFilter.value, count: results.length, unique: new Set(keys).size === keys.length, allMatch: results.every((podcast) => podcastHasGenre(podcast, "Dokumentar")) };
  });
  assert.equal(secondaryFilter.active, "Dokumentar");
  assert.ok(secondaryFilter.count > 0);
  assert.equal(secondaryFilter.unique, true);
  assert.equal(secondaryFilter.allMatch, true);

  await page.goto(`http://127.0.0.1:${address.port}/?genre=Finans#ranglister`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.activeFilter?.type === "genre" && state.activeFilter.value === "Finans" && getFilteredPodcasts().length > 0);
  await page.evaluate(() => {
    const podcast = getFilteredPodcasts().find((candidate) => getPodcastId(candidate) === "børsen brænder");
    if (!podcast) throw new Error("The approved Finance catalogue entry is missing from its shared filter URL");
    openPodcastDetailSheet(podcast, null, { allowDesktop: true });
  });
  const sharedFinanceDetail = page.locator("#podcastDetailSheet:not(.is-hidden)");
  await sharedFinanceDetail.waitFor({ state: "visible" });
  await sharedFinanceDetail.locator("[data-podcast-detail-filter='genre'][data-value='Viden']").click();
  await page.waitForFunction(() => state.activeFilter?.type === "genre" && state.activeFilter.value === "Viden");
  const secondaryFilterFromSharedUrl = await page.evaluate(() => {
    const results = getFilteredPodcasts();
    const ids = results.map(getPodcastId);
    return {
      genreUrl: new URLSearchParams(window.location.search).get("genre"),
      count: results.length,
      includesTaggedPodcast: ids.includes("børsen brænder"),
      unique: new Set(results.map(getPodcastKey)).size === results.length,
      allMatch: results.every((podcast) => podcastHasGenre(podcast, "Viden"))
    };
  });
  assert.equal(secondaryFilterFromSharedUrl.genreUrl, "Viden", "The shareable genre parameter follows a secondary-tag selection");
  assert.ok(secondaryFilterFromSharedUrl.count > 0);
  assert.equal(secondaryFilterFromSharedUrl.includesTaggedPodcast, true);
  assert.equal(secondaryFilterFromSharedUrl.unique, true);
  assert.equal(secondaryFilterFromSharedUrl.allMatch, true);

  const primaryFilter = await page.evaluate(() => {
    setActiveFilter("genre", "True Crime");
    const results = getFilteredPodcasts();
    const keys = results.map(getPodcastKey);
    return { count: results.length, unique: new Set(keys).size === keys.length, allMatch: results.every((podcast) => podcastHasGenre(podcast, "True Crime")) };
  });
  assert.ok(primaryFilter.count > 0);
  assert.equal(primaryFilter.unique, true);
  assert.equal(primaryFilter.allMatch, true);

  const thirdGenreClick = await page.evaluate(() => {
    clearActiveFilter();
    const sample = { genre: "Historie", secondaryGenre: "Krig", tertiaryGenre: "Finans" };
    const holder = document.createElement("div");
    holder.innerHTML = renderPodcastGenreTags(getPodcastDetailGenres(sample));
    document.body.append(holder);
    const values = [...holder.querySelectorAll("[data-podcast-detail-filter='genre']")].map((button) => button.dataset.value);
    bindPodcastDetailFilterButtons(holder, sample);
    holder.querySelector("[data-value='Finans']").click();
    holder.remove();
    return { values, active: state.activeFilter?.value || "" };
  });
  assert.deepEqual(thirdGenreClick.values, ["Historie", "Krig", "Finans"]);
  assert.equal(thirdGenreClick.active, "Finans");

  const financeFilter = await page.evaluate(() => {
    document.querySelector('[data-ranking-source="mads"]')?.click();
    setActiveFilter("genre", "Finans");
    const results = getFilteredPodcasts();
    return {
      ids: results.map(getPodcastId).sort(),
      emptyState: document.querySelector("#podcastGrid .empty-state")?.textContent?.trim() || ""
    };
  });
  const approvedFinanceIds = [
    "aktieuniverset", "big picture", "bliv rigere", "boraghi og pengedoktoren",
    "børsen brænder", "børsen investor", "børsen morgenbriefing", "børssnak",
    "den lyse side", "det der tæller", "finansministeriet forklarer", "lyn analyse",
    "makropuls howden", "millionærklubben", "morgennyheder", "shop21 dk bitcoin samfund frihed",
    "sorte tal", "store penge"
  ].sort();
  assert.deepEqual(financeFilter.ids, approvedFinanceIds, "Finans primary results match the 17 approved changes plus SHOP21.DK exactly");
  assert.equal(new Set(financeFilter.ids).size, 18, "Finans primary results contain no duplicate podcasts");
  assert.equal(financeFilter.emptyState, "");
  assert.equal(catalogue.rows.filter((row) => row.Genre === "Finans").length, 18, "catalogue has exactly 18 primary Finans podcasts");

  const topicUrl = `http://127.0.0.1:${address.port}/?s=Den%20Kolde%20Krig#ranglister`;
  await page.goto(topicUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.searchTerm === "Den Kolde Krig" && state.podcasts?.length > 0);
  const topicResults = await page.evaluate(() => ({
    input: document.getElementById("searchInput")?.value,
    resultCount: getFilteredPodcasts().length,
    candidateCount: getRankingCandidates().filter((podcast) => matchesPodcastTopicSearch(podcast, "Den Kolde Krig")).length,
    activeFilter: state.activeFilter,
    topicMatch: getFilteredPodcasts().some((podcast) => matchesPodcastTopicSearch(podcast, "Den Kolde Krig")),
    url: `${window.location.search}${window.location.hash}`
  }));
  assert.equal(topicResults.input, "Den Kolde Krig");
  assert.ok(topicResults.resultCount > 0, JSON.stringify(topicResults));
  assert.equal(topicResults.topicMatch, true);
  assert.equal(topicResults.url, "?s=Den%20Kolde%20Krig#ranglister");

  await page.goto("http://127.0.0.1:" + address.port + "/?genre=Finans#ranglister", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.activeFilter?.type === "genre" && state.activeFilter.value === "Finans");
  const sharedFinanceResults = await page.evaluate(() => {
    const results = getFilteredPodcasts();
    const keys = results.map(getPodcastKey);
    return { url: location.search + location.hash, ids: results.map(getPodcastId).sort(), unique: new Set(keys).size === keys.length, allMatch: results.every((podcast) => podcast.genre === "Finans") };
  });
  assert.equal(sharedFinanceResults.url, "?genre=Finans#ranglister");
  assert.deepEqual(sharedFinanceResults.ids, approvedFinanceIds);
  assert.equal(sharedFinanceResults.unique, true);
  assert.equal(sharedFinanceResults.allMatch, true);

  await page.goto("http://127.0.0.1:" + address.port + "/?genre=Krig#ranglister", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.activeFilter?.type === "genre" && state.activeFilter.value === "Krig");
  const sharedGenreResults = await page.evaluate(() => {
    const results = getFilteredPodcasts();
    const keys = results.map(getPodcastKey);
    return { url: location.search + location.hash, count: results.length, unique: new Set(keys).size === keys.length, allMatch: results.every((podcast) => podcastHasGenre(podcast, "Krig")) };
  });
  assert.equal(sharedGenreResults.url, "?genre=Krig#ranglister");
  assert.ok(sharedGenreResults.count > 0);
  assert.equal(sharedGenreResults.unique, true);
  assert.equal(sharedGenreResults.allMatch, true);

  await page.goto(`http://127.0.0.1:${address.port}/?s=Sladder#ranglister`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.searchTerm === "Sladder" && state.podcasts?.length > 0);
  const legacySearch = await page.evaluate(() => ({
    count: getFilteredPodcasts().length,
    hasLegacyPrimary: getFilteredPodcasts().some((podcast) => podcast.genre === "Sladder"),
    genreButtons: [...document.querySelectorAll(".ranking-sidebar-column .genre-chip")].map((button) => button.textContent.trim())
  }));
  assert.ok(legacySearch.count > 0);
  assert.equal(legacySearch.hasLegacyPrimary, true);
  assert.equal(legacySearch.genreButtons.includes("Sladder"), false);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://127.0.0.1:${address.port}/#udforsk`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll(".explore-genre-chip").length === 11, null, { timeout: 30000 });
  const exploreGenres = await page.locator(".explore-genre-chip").allTextContents();
  assert.deepEqual(exploreGenres.map((genre) => genre.trim()), expectedGenres);
  await page.evaluate(() => document.querySelector('[data-explore-genre="Politik"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await page.waitForFunction(() => document.querySelector('[data-explore-genre="Politik"]')?.getAttribute("aria-pressed") === "true");

  await page.goto(`http://127.0.0.1:${address.port}/#ranglister`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll(".genre-chip").length === 11);

  for (const width of [320, 375, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const mobileFilterToggle = page.locator("#rankingMobileFilterToggle");
    if (await mobileFilterToggle.isVisible()) {
      if ((await mobileFilterToggle.getAttribute("aria-expanded")) !== "true") await mobileFilterToggle.click();
      await page.waitForFunction(() => document.getElementById("rankingFilterPanel")?.hidden === false);
    }
    const mobile = await page.evaluate(() => {
      const container = document.querySelector("#rankingFilterPanel .genre-chips") || document.querySelector(".ranking-sidebar-column .genre-chips");
      const buttons = [...(container?.querySelectorAll(".genre-chip") || [])];
      const rects = buttons.map((button) => button.getBoundingClientRect());
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        containerWidth: container?.getBoundingClientRect().width || 0,
        buttonRects: rects.map((rect, index) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, scrollWidth: buttons[index].scrollWidth, clientWidth: buttons[index].clientWidth })),
        pageClass: document.body.className,
        labels: buttons.map((button) => button.textContent.trim()),
        genreElements: [...document.querySelectorAll("[class*=genre]")].slice(0, 15).map((element) => ({ tag: element.tagName, className: element.className, text: element.textContent.trim().slice(0, 60) }))
      };
    });
    assert.ok(mobile.documentWidth <= mobile.viewportWidth, `Horizontal page overflow at ${width}px`);
    assert.ok(mobile.containerWidth > 0, `Genre filter is not visible at ${width}px: ${JSON.stringify(mobile)}`);
    assert.match(mobile.pageClass, /page-ranglister/u);
    assert.deepEqual(mobile.labels, expectedGenres);
    assert.ok(mobile.buttonRects.every((button) => button.scrollWidth <= button.clientWidth + 2), `Long mobile labels fit at ${width}px`);
    for (let index = 0; index < mobile.buttonRects.length; index += 1) {
      for (let other = index + 1; other < mobile.buttonRects.length; other += 1) {
        const left = mobile.buttonRects[index];
        const right = mobile.buttonRects[other];
        assert.ok(left.bottom <= right.top || right.bottom <= left.top || left.right <= right.left || right.right <= left.left, `Mobile genre buttons overlap at ${width}px`);
      }
    }
  }

  for (const width of [320, 375, 390, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width: width, height: 900 });
    await page.goto("http://127.0.0.1:" + address.port + "/#forside", { waitUntil: "domcontentloaded" });
    const home = page.locator("#pageIntroPanel .home-genres__grid");
    await home.waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelectorAll("#pageIntroPanel .home-genres__grid .home-genres-card").length === 10);
    const layout = await page.evaluate(() => {
      const grid = document.querySelector("#pageIntroPanel .home-genres__grid");
      const cards = [...grid.querySelectorAll(".home-genres-card")];
      return {
        viewport: innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        labels: cards.map((card) => card.querySelector(".home-genres-card__genre")?.textContent.trim()),
        rects: cards.map((card) => {
          const rect = card.getBoundingClientRect();
          const label = card.querySelector(".home-genres-card__genre");
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, labelWidth: label?.clientWidth || 0, labelScrollWidth: label?.scrollWidth || 0, genre: card.dataset.genre };
        }),
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length
      };
    });
    assert.ok(layout.pageWidth <= width, "Homepage overflows at " + width + "px: " + JSON.stringify(layout));
    assert.deepEqual(layout.labels, expectedGenres.slice(1), "homepage uses the canonical 10 genres at " + width + "px");
    assert.equal(layout.columns, width <= 430 ? 3 : width < 769 ? 4 : 5, "home genre grid adapts to 10 genres at " + width + "px");
    assert.ok(layout.rects.every((card) => card.right <= width + 1 && card.labelWidth > 0), "genre card or label is clipped at " + width + "px");
    assert.ok(layout.rects.every((card) => card.labelScrollWidth <= card.labelWidth + 2), "genre label overflows at " + width + ": " + JSON.stringify(layout.rects.filter((card) => card.labelScrollWidth > card.labelWidth + 2)) + "px");
    assert.ok(layout.rects.every((card) => card.genre), "genre cards have semantic data attributes");
    await page.goto("http://127.0.0.1:" + address.port + "/podcast-anbefalinger/index.html", { waitUntil: "domcontentloaded" });
    const staticNav = await page.evaluate(() => {
      const nav = document.querySelector(".genre-nav");
      const links = [...nav.querySelectorAll("a")];
      const bounds = nav.getBoundingClientRect();
      const overflowers = [...document.body.querySelectorAll("*")].map((element) => ({ tag: element.tagName, className: typeof element.className === "string" ? element.className : "", text: element.textContent.trim().slice(0, 80), right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) })).filter((element) => element.right > innerWidth + 1).sort((left, right) => right.right - left.right).slice(0, 8);
      return { labels: links.map((link) => link.textContent.trim()), pageWidth: document.documentElement.scrollWidth, navRight: bounds.right, viewport: innerWidth, overflowers };
    });
    assert.deepEqual(staticNav.labels, expectedGenres.slice(1), "static recommendation nav uses all canonical genres");
    assert.ok(staticNav.pageWidth <= width, "static recommendation page overflows at " + width + "px: " + JSON.stringify(staticNav));
    assert.ok(staticNav.navRight <= width + 1, "static genre navigation is clipped at " + width + "px");
    for (let index = 0; index < layout.rects.length; index += 1) {
      for (let other = index + 1; other < layout.rects.length; other += 1) {
        const left = layout.rects[index], right = layout.rects[other];
        assert.ok(left.bottom <= right.top || right.bottom <= left.top || left.right <= right.left || right.right <= left.left, "Homepage genre cards overlap at " + width + "px");
      }
    }
  }

  await page.goto("http://127.0.0.1:" + address.port + "/#forside", { waitUntil: "domcontentloaded" });
  const financeCard = page.locator('#pageIntroPanel .home-genres-card[data-genre="Finans"]');
  await financeCard.waitFor({ state: "visible" });
  assert.equal(await financeCard.getAttribute("role"), "link");
  assert.equal(await financeCard.getAttribute("tabindex"), "0", "homepage genre card is keyboard focusable");
  assert.match(styleSource, /home-genres-card\.is-clickable:focus-visible/u, "homepage genre cards retain a visible focus style");
  await page.evaluate(() => clearActiveFilter());
  await financeCard.evaluate((card) => card.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));

  await page.waitForFunction(() => state.activeFilter?.type === "genre" && state.activeFilter.value === "Finans");
  const financeResults = await page.evaluate(() => {
    const results = getFilteredPodcasts();
    const keys = results.map(getPodcastKey);
    return { count: results.length, unique: new Set(keys).size === keys.length, allMatch: results.every((podcast) => podcastHasGenre(podcast, "Finans")) };
  });
  assert.ok(financeResults.count > 0);
  assert.equal(financeResults.unique, true);
  assert.equal(financeResults.allMatch, true);
  console.log("Genre phase 2 regression tests passed.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
