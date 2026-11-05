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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, hasTouch: true });
  page.on("pageerror", (error) => { throw error; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/u, (route) => route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/#ranglister`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.podcasts?.length > 0 && getRankingCandidates().some((podcast) => getPodcastId(podcast) === "krig"));

  const results = await page.evaluate(() => {
    const bakspejlTitles = ["Kolonien", "Koloni til salg"];
    const bakspejl = getRankingCandidates().filter((podcast) =>
      bakspejlTitles.includes(podcast.title) &&
      podcast.host === "Martin Grønne" &&
      normalizeSearchValue(podcast.mainSeries) === "bakspejl"
    );
    const bakspejlQueries = ["kolonien grønne", "kolonien grønn", "grønn kolonien", "koloni grønn", "bakspejl mart"];
    const bakspejlRanking = Object.fromEntries(bakspejlQueries.map((query) => [query,
      bakspejl.some((podcast) => matchesRankingEnhancedSearch(podcast, query))
    ]));
    const bakspejlHeader = Object.fromEntries(bakspejlQueries.map((query) => [query,
      getHeaderSearchMatches(query).some(({ podcast }) =>
        (query.startsWith("bakspejl ")
          ? normalizeSearchValue(podcast.mainSeries) === "bakspejl" && normalizeSearchValue(podcast.host).includes("martin grønne")
          : bakspejlTitles.includes(podcast.title) && podcast.host === "Martin Grønne")
      )
    ]));
    const getIds = (query) => getFilteredPodcasts().filter((podcast) => matchesRankingEnhancedSearch(podcast, query)).map(getPodcastId);
    const candidate = getRankingCandidates().find((podcast) => getPodcastId(podcast) === "krig");
    const rating = candidate.ratingValue;
    const queries = ["tamm krig", "krig tamm", "Martin Tamm Andersen Krig", "krig", "tamm"];
    const header = Object.fromEntries(queries.map((query) => [query,
      getHeaderSearchMatches(query).some(({ podcast }) => getPodcastId(podcast) === "krig")]));
    const ranking = Object.fromEntries(queries.map((query) => {
      state.searchTerm = query;
      return [query, getIds(query).includes("krig")];
    }));
    const negative = {
      ranking: (state.searchTerm = "tamm mørkeland", getIds(state.searchTerm).includes("krig")),
      header: getHeaderSearchMatches("tamm mørkeland").some(({ podcast }) => getPodcastId(podcast) === "krig"),
      noFuzzyIdentity: matchesRankingEnhancedSearch({ title: "Krig", host: "Martin Tamm Andersen", searchTopics: [] }, "tamm moerkeland"),
      noSubstringAcrossFields: matchesRankingEnhancedSearch({ title: "Ukolonien", host: "Magrønne" }, "kolonien grønn"),
      noShortPrefixCollision: matchesRankingEnhancedSearch({ title: "Kolonien", host: "Martin Grønne" }, "kolonien mar")
    };
    const aliases = {
      radio24: matchesRankingEnhancedSearch({ title: "Radio 24/7" }, "Radio24syv"),
      radio4: matchesRankingEnhancedSearch({ title: "Radio IIII" }, "Radio 4"),
      danish: matchesRankingEnhancedSearch({ title: "Rådet om ÆØÅ" }, "raadet aeoeaa")
    };
    state.searchTerm = "tamm krig";
    setActiveFilter("genre", "Dokumentar");
    const matchingGenreFilter = getFilteredPodcasts().some((podcast) => getPodcastId(podcast) === "krig");
    setActiveFilter("genre", "Finans");
    const nonmatchingGenreFilter = getFilteredPodcasts().some((podcast) => getPodcastId(podcast) === "krig");
    clearActiveFilter();
    state.searchTerm = "";
    const afterFilterRating = getRankingCandidates().find((podcast) => getPodcastId(podcast) === "krig").ratingValue;
    return { bakspejlTitles, bakspejl: bakspejl.map(({ title, host, mainSeries }) => ({ title, host, mainSeries })), bakspejlRanking, bakspejlHeader, queries, header, ranking, negative, aliases, matchingGenreFilter, nonmatchingGenreFilter, rating, afterFilterRating };
  });
  assert.ok(results.bakspejl.length > 0, `catalogue must contain verified Bakspejl titles and Martin Grønne: ${JSON.stringify(results.bakspejl)}`);
  assert.deepEqual(results.bakspejl.map(({ title }) => title).sort(), results.bakspejlTitles.slice().sort(), "both current Bakspejl title rows retain Martin Grønne as the verified host");
  for (const query of Object.keys(results.bakspejlRanking)) {
    assert.equal(results.bakspejlRanking[query], true, `Bakspejl ranking prefix query ${query}`);
    assert.equal(results.bakspejlHeader[query], true, `Bakspejl header prefix query ${query}`);
  }
  for (const query of results.queries) {
    assert.equal(results.header[query], true, `header cross-field query ${query}`);
    assert.equal(results.ranking[query], true, `ranking cross-field query ${query}`);
  }
  assert.deepEqual(results.negative, { ranking: false, header: false, noFuzzyIdentity: false, noSubstringAcrossFields: false, noShortPrefixCollision: false });
  assert.deepEqual(results.aliases, { radio24: true, radio4: true, danish: true });
  assert.equal(results.matchingGenreFilter, true, "active matching genre filters still apply alongside search");
  assert.equal(results.nonmatchingGenreFilter, false, "active nonmatching genre filters still exclude the podcast");
  assert.equal(results.afterFilterRating, results.rating, "search and filters do not alter the rating shown");

  const deepLink = `http://127.0.0.1:${server.address().port}/?s=tamm%20krig#ranglister`;
  await page.goto(deepLink, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.searchTerm === "tamm krig" && getFilteredPodcasts().some((podcast) => getPodcastId(podcast) === "krig"));
  for (const width of [320, 375, 390, 768, 1024, 1101, 1280, 1440]) {
    await page.setViewportSize({ width, height: width <= 430 ? 844 : 900 });
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      searchValue: document.getElementById("searchInput")?.value,
      match: getFilteredPodcasts().some((podcast) => getPodcastId(podcast) === "krig")
    }));
    assert.ok(layout.documentWidth <= width + 1, `horizontal overflow at ${width}px: ${JSON.stringify(layout)}`);
    assert.equal(layout.searchValue, "tamm krig");
    assert.equal(layout.match, true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.podcasts?.length > 0);
  await page.locator("[data-home-podcast-search-input]").tap();
  await page.locator("#mobileHomeSearchOverlayInput").waitFor({ state: "visible" });
  await page.locator("#mobileHomeSearchOverlayInput").fill("tamm krig");
  await page.waitForFunction(() => getHeaderSearchMatches("tamm krig").some(({ podcast }) => getPodcastId(podcast) === "krig"));
  await page.locator("#mobileHomeSearchOverlayClear").click();
  assert.equal(await page.locator("#mobileHomeSearchOverlayInput").inputValue(), "", "mobile overlay clear control empties the query");
  await page.locator("#mobileHomeSearchOverlayInput").fill("tamm krig");
  await page.locator("#mobileHomeSearchOverlayInput").press("ArrowDown");
  assert.ok(await page.locator("#mobileHomeSearchOverlayInput").getAttribute("aria-activedescendant"), "keyboard navigation activates a mobile suggestion");
  await page.locator("#mobileHomeSearchOverlayInput").press("Enter");
  await page.locator("#podcastDetailSheet:not(.is-hidden)").waitFor({ state: "visible" });
  assert.ok((await page.locator("#podcastDetailSheet").innerText()).includes("Krig"), "Enter opens the selected search result");
  await page.keyboard.press("Escape");
  await page.locator("#podcastDetailSheet.is-hidden").waitFor({ state: "attached" });
  await page.locator("[data-home-podcast-search-input]").focus();
  await page.locator("#mobileHomeSearchOverlayInput").waitFor({ state: "visible" });
  await page.locator("#mobileHomeSearchOverlayInput").fill("tamm krig");
  await page.locator("#mobileHomeSearchOverlayInput").press("Escape");
  assert.equal(await page.locator("#mobileHomeSearchOverlay").getAttribute("aria-hidden"), "true");
  console.log("Cross-field podcast search regression: PASS");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
