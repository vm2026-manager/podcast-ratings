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

  const searchPerformance = await page.evaluate(() => {
    const catalogueSize = getRankingCandidates().length;
    const coldStart = performance.now();
    const coldResults = getHeaderSearchMatches("sig d");
    const coldHeaderMs = performance.now() - coldStart;

    const input = elements.desktopHeaderSearchInput;
    input.value = "sig de";
    const visibleStart = performance.now();
    renderHeaderSearchResults();
    const visibleSuggestionMs = performance.now() - visibleStart;
    const visibleTarget = [...(elements.desktopHeaderSearchResults?.querySelectorAll("[data-header-search-index]") || [])]
      .some((option) => option.textContent.includes("Sig det' løgn"));

    let warmTotalMs = 0;
    for (let index = 0; index < 12; index += 1) {
      const start = performance.now();
      getHeaderSearchMatches(index % 2 ? "sig d" : "sig de");
      warmTotalMs += performance.now() - start;
    }
    return {
      catalogueSize,
      coldHeaderMs,
      visibleSuggestionMs,
      warmAverageHeaderMs: warmTotalMs / 12,
      coldResultCount: coldResults.length,
      visibleTarget
    };
  });
  assert.ok(searchPerformance.catalogueSize >= 1000, `performance sample uses the full catalogue: ${searchPerformance.catalogueSize}`);
  assert.ok(searchPerformance.coldHeaderMs < 300, `cold full-catalogue search is under 300ms: ${JSON.stringify(searchPerformance)}`);
  assert.ok(searchPerformance.visibleSuggestionMs < 300, `visible suggestion rendering is under 300ms: ${JSON.stringify(searchPerformance)}`);
  assert.ok(searchPerformance.warmAverageHeaderMs < 300, `warm full-catalogue search is under 300ms: ${JSON.stringify(searchPerformance)}`);
  assert.ok(searchPerformance.coldResultCount > 0 && searchPerformance.visibleTarget, "cold matching and visible suggestions both include the title-sequence result");

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
    const bakspejlQueryTitles = Object.fromEntries(bakspejlQueries.map((query) => [query,
      bakspejl.filter((podcast) => matchesRankingEnhancedSearch(podcast, query)).map((podcast) => podcast.title).sort()
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
    const shortTitleQueries = ["hox", "hoxh", "enver hoxha"];
    const shortTitleSearch = Object.fromEntries(shortTitleQueries.map((query) => {
      state.searchTerm = query;
      const rankingMatches = getFilteredPodcasts().filter((podcast) => matchesRankingEnhancedSearch(podcast, query));
      const headerMatches = getHeaderSearchMatches(query);
      return [query, {
        ranking: rankingMatches.some((podcast) => getPodcastId(podcast) === "enver hoxha"),
        rankingFirst: getPodcastId(rankingMatches[0]) === "enver hoxha",
        header: headerMatches.some(({ podcast }) => getPodcastId(podcast) === "enver hoxha"),
        headerFirst: getPodcastId(headerMatches[0]?.podcast) === "enver hoxha"
      }];
    }));
    state.searchTerm = "ho";
    const shortTwoLetterTitleSearch = {
      ranking: getFilteredPodcasts().some((podcast) => getPodcastId(podcast) === "enver hoxha"),
      header: getHeaderSearchMatches("ho").some(({ podcast }) => getPodcastId(podcast) === "enver hoxha"),
      genericTitleWord: matchesRankingEnhancedSearch({ title: "Hobbitten" }, "ho"),
      noGenericSubstring: matchesRankingEnhancedSearch({ title: "Hobbitten" }, "ob")
    };
    const sigTarget = getRankingCandidates().find((podcast) => getPodcastId(podcast) === "sig det løgn");
    const sigTypeaheadQueries = ["sig", "sig ", "sig d", "sig de", "sig det", "sig det'", "sig det' l", "sig det' løgn"];
    const sigTypeahead = Object.fromEntries(sigTypeaheadQueries.map((query) => {
      state.searchTerm = query;
      const rankingMatches = getFilteredPodcasts().filter((podcast) => matchesRankingEnhancedSearch(podcast, query));
      const headerMatches = getHeaderSearchMatches(query);
      return [query, {
        ranking: rankingMatches.some((podcast) => getPodcastId(podcast) === "sig det løgn"),
        header: headerMatches.some(({ podcast }) => getPodcastId(podcast) === "sig det løgn"),
        headerFirst: getPodcastId(headerMatches[0]?.podcast) === "sig det løgn"
      }];
    }));
    const shortMiddleTitleSequences = [];
    for (const podcast of getRankingCandidates()) {
      const titleTokens = normalizeSearchValue(podcast.title).split(" ").filter(Boolean);
      if (titleTokens.length < 3 || titleTokens[1].length > 3 || titleTokens[2].length < 2) continue;
      const query = `${titleTokens[0]} ${titleTokens[1]} ${titleTokens[2].slice(0, 2)}`;
      if (!matchesRankingEnhancedSearch(podcast, query)) continue;
      shortMiddleTitleSequences.push({ id: getPodcastId(podcast), title: podcast.title, query });
      if (shortMiddleTitleSequences.length >= 8) break;
    }
    const negative = {
      ranking: (state.searchTerm = "tamm mørkeland", getIds(state.searchTerm).includes("krig")),
      header: getHeaderSearchMatches("tamm mørkeland").some(({ podcast }) => getPodcastId(podcast) === "krig"),
      noFuzzyIdentity: matchesRankingEnhancedSearch({ title: "Krig", host: "Martin Tamm Andersen", searchTopics: [] }, "tamm moerkeland"),
      noSubstringAcrossFields: matchesRankingEnhancedSearch({ title: "Ukolonien", host: "Magrønne" }, "kolonien grønn"),
      noShortPrefixCollision: matchesRankingEnhancedSearch({ title: "Kolonien", host: "Martin Grønne" }, "kolonien mar"),
      noMidWordTitleMatch: matchesRankingEnhancedSearch({ title: "Ukolonien" }, "loni"),
      noShortHostOnlyMatch: matchesRankingEnhancedSearch({ title: "Kolonien", host: "Martin Grønne" }, "mar"),
      noTwoLetterHostPrefixCollision: matchesRankingEnhancedSearch({ title: "Kolonien", host: "Martin Grønne" }, "kolonien ma"),
      noTwoLetterSubstring: matchesRankingEnhancedSearch({ title: "Tyran: Enver Hoxha" }, "ox"),
      noShortQuery: matchesRankingEnhancedSearch({ title: "Martin Tamm Andersen" }, "m"),
      noOneLetterPrefix: matchesRankingEnhancedSearch({ title: "Hoxha" }, "h"),
      noTwoLetterMultiwordPrefix: matchesRankingEnhancedSearch({ title: "Hobbitten" }, "ho bi"),
      noStopWordCrossFieldCombination: matchesRankingEnhancedSearch({ title: "Sig noget klogt", host: "De Lange" }, "sig de"),
      noUnrelatedSigTitle: getRankingCandidates()
        .filter((podcast) => /^sig /u.test(normalizeSearchValue(podcast.title)) && getPodcastId(podcast) !== "sig det løgn")
        .some((podcast) => matchesRankingEnhancedSearch(podcast, "sig de")),
      noRomanPrefixInTitleSequence: matchesRankingEnhancedSearch({ title: "Sig Ivan" }, "sig iv"),
      noNumericPrefixInTitleSequence: matchesRankingEnhancedSearch({ title: "Sig 1234" }, "sig 12"),
      noShortStopWord: ["the", "en"].some((query) => matchesRankingEnhancedSearch({ title: "Enver Hoxha" }, query)),
      noShortNumericOrRoman: ["123", "xiv", "12", "iv"].some((query) => matchesRankingEnhancedSearch({ title: "XIV Hoxha" }, query))
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
    return { bakspejlTitles, bakspejl: bakspejl.map(({ title, host, mainSeries }) => ({ title, host, mainSeries })), bakspejlRanking, bakspejlQueryTitles, bakspejlHeader, queries, header, ranking, shortTitleSearch, shortTwoLetterTitleSearch, sigTarget: sigTarget && { id: getPodcastId(sigTarget), title: sigTarget.title }, sigTypeaheadQueries, sigTypeahead, shortMiddleTitleSequences, negative, aliases, matchingGenreFilter, nonmatchingGenreFilter, rating, afterFilterRating };
  });
  assert.ok(results.bakspejl.length > 0, `catalogue must contain verified Bakspejl titles and Martin Grønne: ${JSON.stringify(results.bakspejl)}`);
  assert.deepEqual(results.bakspejl.map(({ title }) => title).sort(), results.bakspejlTitles.slice().sort(), "both current Bakspejl title rows retain Martin Grønne as the verified host");
  for (const query of Object.keys(results.bakspejlRanking)) {
    assert.equal(results.bakspejlRanking[query], true, `Bakspejl ranking prefix query ${query}`);
    assert.equal(results.bakspejlHeader[query], true, `Bakspejl header prefix query ${query}`);
  }
  for (const query of ["kolonien grønne", "kolonien grønn", "grønn kolonien"]) {
    assert.deepEqual(results.bakspejlQueryTitles[query], ["Koloni til salg", "Kolonien"], `complete and unfinished word queries preserve both relevant Bakspejl results: ${query}`);
  }
  for (const query of results.queries) {
    assert.equal(results.header[query], true, `header cross-field query ${query}`);
    assert.equal(results.ranking[query], true, `ranking cross-field query ${query}`);
  }
  for (const [query, matches] of Object.entries(results.shortTitleSearch)) {
    assert.equal(matches.ranking, true, `short title prefix ranking query ${query}`);
    assert.equal(matches.header, true, `short title prefix header query ${query}`);
    assert.equal(matches.rankingFirst, true, `short title prefix ranks the canonical podcast first in ranking results: ${query}`);
    assert.equal(matches.headerFirst, true, `short title prefix ranks the canonical podcast first in header suggestions: ${query}`);
  }
  assert.deepEqual(results.shortTwoLetterTitleSearch, { ranking: true, header: true, genericTitleWord: true, noGenericSubstring: false });
  assert.deepEqual(results.sigTarget, { id: "sig det løgn", title: "Sig det' løgn" }, "the typeahead regression is anchored to the actual catalogue identity");
  for (const query of results.sigTypeaheadQueries) {
    assert.deepEqual(results.sigTypeahead[query], { ranking: true, header: true, headerFirst: true }, `Sig det' løgn remains the visible top suggestion through title typing: ${JSON.stringify(query)}`);
  }
  assert.ok(results.shortMiddleTitleSequences.length >= 3, `several catalog titles with short middle words stay searchable as ordered typeahead prefixes: ${JSON.stringify(results.shortMiddleTitleSequences)}`);
  assert.equal(new Set(results.shortMiddleTitleSequences.map(({ id }) => id)).size, results.shortMiddleTitleSequences.length, "typeahead examples use distinct canonical podcast identities");
  assert.deepEqual(results.negative, { ranking: false, header: false, noFuzzyIdentity: false, noSubstringAcrossFields: false, noShortPrefixCollision: false, noMidWordTitleMatch: false, noShortHostOnlyMatch: false, noTwoLetterHostPrefixCollision: false, noTwoLetterSubstring: false, noShortQuery: false, noOneLetterPrefix: false, noTwoLetterMultiwordPrefix: false, noStopWordCrossFieldCombination: false, noUnrelatedSigTitle: false, noRomanPrefixInTitleSequence: false, noNumericPrefixInTitleSequence: false, noShortStopWord: false, noShortNumericOrRoman: false });
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

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => state.podcasts?.length > 0);
  const desktopSearchInput = page.locator("#desktopHeaderSearchInput");
  await desktopSearchInput.fill("ho");
  const desktopHoxResult = page.locator("[data-header-search-index]").filter({ hasText: "Enver Hoxha" }).first();
  await desktopHoxResult.waitFor({ state: "visible" });
  assert.ok((await desktopHoxResult.innerText()).includes("Enver Hoxha"), "desktop suggestions show the matching two-letter title prefix");
  await desktopHoxResult.click();
  await page.locator("#podcastDetailSheet:not(.is-hidden)").waitFor({ state: "visible" });
  assert.ok((await page.locator("#podcastDetailSheet").innerText()).includes("Enver Hoxha"), "desktop suggestion opens the matching podcast");
  await page.keyboard.press("Escape");
  await page.locator("#podcastDetailSheet.is-hidden").waitFor({ state: "attached" });

  await desktopSearchInput.fill("");
  let desktopTypedQuery = "";
  for (const character of Array.from("sig det' løgn")) {
    await desktopSearchInput.pressSequentially(character);
    desktopTypedQuery += character;
    if (desktopTypedQuery.startsWith("sig")) {
      await page.waitForFunction(() => headerSearchState.matches.some(({ podcast }) => getPodcastId(podcast) === "sig det løgn"));
      const suggestion = page.locator("[data-header-search-index]").filter({ hasText: "Sig det' løgn" }).first();
      await suggestion.waitFor({ state: "visible" });
      const firstSuggestionId = await page.evaluate(() => getPodcastId(headerSearchState.matches[0]?.podcast));
      assert.equal(firstSuggestionId, "sig det løgn", `title suggestion remains first while typing ${JSON.stringify(desktopTypedQuery)}`);
    }
  }
  await desktopSearchInput.press("ArrowDown");
  assert.ok(await desktopSearchInput.getAttribute("aria-activedescendant"), "desktop ArrowDown activates a suggestion");
  await desktopSearchInput.press("Enter");
  await page.locator("#podcastDetailSheet:not(.is-hidden)").waitFor({ state: "visible" });
  assert.ok((await page.locator("#podcastDetailSheet").innerText()).includes("Sig det' løgn"), "desktop Enter opens the selected title-sequence match");
  await page.keyboard.press("Escape");
  await page.locator("#podcastDetailSheet.is-hidden").waitFor({ state: "attached" });
  assert.equal(await desktopSearchInput.inputValue(), "", "opening a desktop result clears the old query");

  const rankingPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  rankingPage.on("pageerror", (error) => { throw error; });
  await rankingPage.route(/^https?:\/\/(?!127\.0\.0\.1)/u, (route) => route.abort());
  await rankingPage.goto(`http://127.0.0.1:${server.address().port}/#ranglister`, { waitUntil: "domcontentloaded" });
  await rankingPage.waitForFunction(() => state.podcasts?.length > 0);
  await rankingPage.evaluate(() => handleRankingSourceChange("mads"));
  await rankingPage.waitForFunction(() => state.rankingSource === "mads");
  const rankingSearch = rankingPage.locator("#searchInput");
  await rankingSearch.click();
  await rankingSearch.fill("ho");
  await rankingPage.waitForFunction(() => state.searchTerm === "ho" && getFilteredPodcasts().some((podcast) => getPodcastId(podcast) === "enver hoxha"));
  const rankingHoxResult = rankingPage.locator('#podcastGrid [data-key="enver hoxha"]').first();
  try {
    await rankingHoxResult.waitFor({ state: "visible" });
  } catch (error) {
    const diagnostic = await rankingPage.evaluate(() => {
      const result = document.querySelector('#podcastGrid [data-key="enver hoxha"]');
      const rect = result?.getBoundingClientRect();
      const filtered = getFilteredPodcasts();
      return {
        route: location.href,
        viewport: innerWidth,
        search: state.searchTerm,
        rankingSource: state.rankingSource,
        filteredCount: filtered.length,
        targetIndex: filtered.findIndex((podcast) => getPodcastId(podcast) === "enver hoxha"),
        renderedCount: document.querySelectorAll("#podcastGrid [data-key]").length,
        resultExists: Boolean(result),
        resultStyle: result && { display: getComputedStyle(result).display, visibility: getComputedStyle(result).visibility, rect: { width: rect.width, height: rect.height, top: rect.top } },
        gridClass: document.querySelector("#podcastGrid")?.className,
        inputValue: document.querySelector("#searchInput")?.value,
        inputReadOnly: document.querySelector("#searchInput")?.readOnly
      };
    });
    throw new Error(`Hoxha ranking result did not render visibly: ${JSON.stringify(diagnostic)}`, { cause: error });
  }
  assert.equal(await rankingHoxResult.isVisible(), true, "ranking search renders the two-letter title prefix result visibly");
  await rankingHoxResult.click();
  await rankingPage.locator("#podcastDetailSheet:not(.is-hidden)").waitFor({ state: "visible" });
  assert.ok((await rankingPage.locator("#podcastDetailSheet").innerText()).includes("Enver Hoxha"), "ranking result opens the matching podcast");
  await rankingPage.keyboard.press("Escape");
  await rankingPage.locator("#podcastDetailSheet.is-hidden").waitFor({ state: "attached" });

  await rankingSearch.fill("");
  let rankingTypedQuery = "";
  for (const character of Array.from("sig det' løgn")) {
    await rankingSearch.pressSequentially(character);
    rankingTypedQuery += character;
    if (rankingTypedQuery.startsWith("sig")) {
      await rankingPage.waitForFunction(() => state.searchTerm.startsWith("sig") && getFilteredPodcasts().some((podcast) => getPodcastId(podcast) === "sig det løgn"));
      const rankingSigResult = rankingPage.locator('#podcastGrid [data-key="sig det løgn"]').first();
      await rankingSigResult.waitFor({ state: "visible" });
    }
  }
  await rankingPage.locator('#podcastGrid [data-key="sig det løgn"]').first().click();
  await rankingPage.locator("#podcastDetailSheet:not(.is-hidden)").waitFor({ state: "visible" });
  assert.ok((await rankingPage.locator("#podcastDetailSheet").innerText()).includes("Sig det' løgn"), "ranking search result opens the matching podcast");
  await rankingPage.keyboard.press("Escape");
  await rankingPage.locator("#podcastDetailSheet.is-hidden").waitFor({ state: "attached" });
  await rankingSearch.fill("");
  assert.equal(await rankingSearch.inputValue(), "", "ranking search can be cleared after opening a result");

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
  await page.locator("[data-home-podcast-search-input]").focus();
  await page.locator("#mobileHomeSearchOverlayInput").waitFor({ state: "visible" });
  await page.locator("#mobileHomeSearchOverlayInput").fill("ho");
  await page.waitForFunction(() => getHeaderSearchMatches("ho").some(({ podcast }) => getPodcastId(podcast) === "enver hoxha"));
  const mobileHoxResult = page.locator('[data-mobile-home-search-index]').filter({ hasText: "Enver Hoxha" }).first();
  await mobileHoxResult.waitFor({ state: "visible" });
  assert.ok((await mobileHoxResult.innerText()).includes("Enver Hoxha"), "mobile overlay shows the matching podcast title");
  await mobileHoxResult.tap();
  await page.locator("#podcastDetailSheet:not(.is-hidden)").waitFor({ state: "visible" });
  assert.ok((await page.locator("#podcastDetailSheet").innerText()).includes("Enver Hoxha"), "mobile touch opens the matching podcast");
  await page.keyboard.press("Escape");
  await page.locator("#podcastDetailSheet.is-hidden").waitFor({ state: "attached" });

  await page.locator("[data-home-podcast-search-input]").focus();
  await page.locator("#mobileHomeSearchOverlayInput").waitFor({ state: "visible" });
  const mobileSearchInput = page.locator("#mobileHomeSearchOverlayInput");
  let mobileTypedQuery = "";
  for (const character of Array.from("sig det' løgn")) {
    await mobileSearchInput.pressSequentially(character);
    mobileTypedQuery += character;
    if (mobileTypedQuery.startsWith("sig")) {
      await page.waitForFunction(() => mobileHomeSearchOverlayState.matches.some(({ podcast }) => getPodcastId(podcast) === "sig det løgn"));
      const suggestion = page.locator("[data-mobile-home-search-index]").filter({ hasText: "Sig det' løgn" }).first();
      await suggestion.waitFor({ state: "visible" });
      const firstSuggestionId = await page.evaluate(() => getPodcastId(mobileHomeSearchOverlayState.matches[0]?.podcast));
      assert.equal(firstSuggestionId, "sig det løgn", `mobile title suggestion remains first while typing ${JSON.stringify(mobileTypedQuery)}`);
    }
  }
  await mobileSearchInput.press("ArrowDown");
  assert.ok(await mobileSearchInput.getAttribute("aria-activedescendant"), "mobile ArrowDown activates a suggestion");
  await mobileSearchInput.press("Enter");
  await page.locator("#podcastDetailSheet:not(.is-hidden)").waitFor({ state: "visible" });
  assert.ok((await page.locator("#podcastDetailSheet").innerText()).includes("Sig det' løgn"), "mobile Enter opens the selected title-sequence match");
  await page.keyboard.press("Escape");
  await page.locator("#podcastDetailSheet.is-hidden").waitFor({ state: "attached" });
  console.log(`Cross-field podcast search regression: PASS (${JSON.stringify({ ...searchPerformance, coldHeaderMs: Number(searchPerformance.coldHeaderMs.toFixed(1)), visibleSuggestionMs: Number(searchPerformance.visibleSuggestionMs.toFixed(1)), warmAverageHeaderMs: Number(searchPerformance.warmAverageHeaderMs.toFixed(1)) })})`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
