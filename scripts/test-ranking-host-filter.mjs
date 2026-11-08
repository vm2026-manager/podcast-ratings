import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const index = await readFile(path.join(root, "index.html"), "utf8");
const app = await readFile(path.join(root, "app.js"), "utf8");
const style = await readFile(path.join(root, "style.css"), "utf8");
const catalogue = JSON.parse(await readFile(path.join(root, "data/podcasts.json"), "utf8"));
const catalogueHashBefore = await readFile(path.join(root, "data/podcasts.json"));
const approvedHostCredits = new Map([
  ["hjernero", "Mads Hyldig & Martin Riis Kastrup"],
  ["single igen sæson 3", "Frida Bolm & Boris Hiort"],
  ["hvepsereden", "Fie Nygaard & Laura Krebs"],
  ["historiepodcasten", "Katrine Stegmann & Marie Brinch"],
  ["ugens krise", "Anna Thygesen & Lasse Laursen"],
  ["hr og fru fuhlendorff bare mellem os", "Karina Fuhlendorff & Christian Fuhlendorff"],
  ["slottet og sumpen", "Joachim B. Olsen & Anne Kirstine Cramon"],
  ["flyvende tallerken", "Frederik Dirks Gottlieb & Anja C. Andersen"]
]);
catalogue.rows = catalogue.rows.map((row) => approvedHostCredits.has(row["Podcast-ID"])
  ? { ...row, Vært: approvedHostCredits.get(row["Podcast-ID"]) }
  : row);
const bakspejlSeed = catalogue.rows.find((row) => row["Podcast-ID"] === "den jyske vietnamveteran");
const hjerneRo = catalogue.rows.find((row) => row["Podcast-ID"] === "hjernero");

assert.ok(bakspejlSeed && hjerneRo, "the exact Bakspejl and approved HjerneRO catalogue fixtures exist");
assert.equal(bakspejlSeed.Vært, "Martin Grønne & Henning Kristensen");
assert.equal(hjerneRo.Vært, "Mads Hyldig & Martin Riis Kastrup");
for (const [podcastId, hostCredit] of approvedHostCredits) {
  assert.equal(catalogue.rows.find((row) => row["Podcast-ID"] === podcastId)?.Vært, hostCredit,
    `${podcastId} uses the verified master host credit in this synthetic test fixture`);
}
assert.match(index, /app\.js\?[^"']*issue66-clickable-hosts-v1=1[^"']*issue68-host-identities-v1=1/u,
  "the ranking host behavior has a new app.js cache version");
assert.match(index, /style\.css\?v=20261108-issue79-fast-popular-list-v1/u,
  "the host-link affordance and ranking activity switch have a new stylesheet cache version");
assert.match(app, /function createRankingHostCreditElement\(/u);
assert.match(app, /button\.dataset\.action = "filter-ranking-host"/u);
assert.match(app, /activeHostFilter\?\.key \|\| ""/u,
  "host identity is represented in the ranking list cache key");
assert.match(style, /\.ranking-host-person:focus-visible/u,
  "clickable host names retain a visible keyboard focus state");
assert.match(style, /\.ranking-host-person\s*\{[^}]*text-decoration:\s*none/su,
  "clickable host names have no visible underline or dotted decoration");
assert.match(app, /function navigatePodcastDetailToHostRanking\(/u,
  "detail host activation uses the safe ranking-navigation flow");

const server = createServer(async (request, response) => {
  try {
    const urlPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (urlPath === "/data/podcasts.json") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify(catalogue));
      return;
    }
    const filePath = path.resolve(root, "." + (urlPath === "/" ? "/index.html" : urlPath));
    if (!filePath.startsWith(root + path.sep) && filePath !== path.join(root, "index.html")) {
      response.writeHead(403).end();
      return;
    }
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    const extension = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp"
    };
    response.writeHead(200, { "content-type": types[extension] || "application/octet-stream", "cache-control": "no-store" });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const origin = "http://127.0.0.1:" + address.port;
const browser = await chromium.launch({ headless: true });
const pageErrors = [];

try {
  for (const width of [320, 375, 390, 768, 1440, 2560]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      isMobile: width <= 390,
      hasTouch: width <= 390
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(width + ": " + error.message));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/u, (route) => route.abort());
    await page.goto(origin + "/?host=Gr%C3%B8nne%20Martin#ranglister", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => state.podcastDataStatus === "ready" && state.podcasts.length > 1000, null, { timeout: 30000 });

    const direct = await page.evaluate(() => ({
      name: state.activeHostFilter?.name,
      key: state.activeHostFilter?.key,
      search: state.searchTerm,
      count: getFilteredPodcasts().length,
      keys: getFilteredPodcasts().map(getPodcastKey),
      allMatch: getFilteredPodcasts().every((podcast) => rankingPodcastHasHost(podcast, state.activeHostFilter?.key)),
      includesBakspejl: getFilteredPodcasts().some((podcast) => getPodcastKey(podcast) === "den jyske vietnamveteran"),
      includesAmbiguous: getFilteredPodcasts().some((podcast) => getPodcastKey(podcast) === "hjernero"),
      source: state.rankingSource,
      sort: state.sort,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth
    }));
    assert.equal(direct.name, "Martin Grønne", "the reversed full name resolves to the canonical catalogue display name at " + width + "px");
    assert.equal(direct.key, "grønne martin", "the URL resolves through the existing normalized full-name key");
    assert.equal(direct.search, "", "a host URL never falls back to fuzzy search");
    assert.ok(direct.count > 1, "host filter returns multiple podcasts at " + width + "px");
    assert.equal(direct.allMatch, true, "every normal row and display group matches Martin's exact host identity");
    assert.equal(direct.includesBakspejl, true, "the shared-host Bakspejl podcast remains included");
    assert.equal(direct.includesAmbiguous, false,
      "HjerneRO's verified first names do not accidentally match Bakspejl's Martin Grønne");
    assert.equal(new Set(direct.keys).size, direct.keys.length, "display groups do not duplicate ranking identities");
    assert.equal(direct.pageWidth, direct.viewportWidth, "host filtering does not create horizontal overflow at " + width + "px");
    assert.equal(new URL(page.url()).searchParams.get("host"), "Martin Grønne", "direct URL is canonicalized to the catalogue name");
    assert.equal(new URL(page.url()).hash, "#ranglister");

    if (width === 320) await verifyDetailInitialFocusDoesNotStealHostFocus(page);
    if (width === 320 || width === 1440) {
      await exerciseHostHistoryAndActivation(page, width);
      await exerciseDetailHostNavigation(page, width);
    }
    if (width === 320) await exerciseAllApprovedHosts(page, approvedHostCredits);
    if (width === 1440) await verifyAllApprovedHostButtons(page, approvedHostCredits);
    if (width === 320) {
      await exerciseReviewCard(page);
    }
    if (width === 1440) {
      await exerciseDesktopCardAndTable(page);
    }
    await context.close();
  }

  const negativeContext = await browser.newContext({ viewport: { width: 320, height: 900 }, isMobile: true, hasTouch: true });
  const negativePage = await negativeContext.newPage();
  negativePage.on("pageerror", (error) => pageErrors.push("invalid host URL: " + error.message));
  await negativePage.route(/^https?:\/\/(?!127\.0\.0\.1)/u, (route) => route.abort());
  for (const invalidHost of ["Martin", "Henning", "Mads & Martin", "Martin <img id=host-xss src=x onerror=alert(1)>"]) {
    await negativePage.goto(origin + "/?host=" + encodeURIComponent(invalidHost) + "#ranglister", { waitUntil: "domcontentloaded" });
    await negativePage.waitForFunction(() => state.podcastDataStatus === "ready" && state.podcasts.length > 1000, null, { timeout: 30000 });
    await negativePage.waitForFunction(() => !new URLSearchParams(location.search).has("host"));
    const rejected = await negativePage.evaluate(() => ({
      activeHost: state.activeHostFilter,
      search: state.searchTerm,
      host: new URLSearchParams(location.search).get("host"),
      injected: Boolean(document.getElementById("host-xss")),
      width: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    assert.equal(rejected.activeHost, null, "unverified host input never creates a person identity");
    assert.equal(rejected.search, "", "invalid host input never falls back to fuzzy search");
    assert.equal(rejected.host, null, "invalid host query is removed from the URL");
    assert.equal(rejected.injected, false, "host query is not interpreted as HTML");
    assert.equal(rejected.width, 0, "rejected host URL does not cause horizontal overflow");
  }
  const preservedUrl = origin + "/?s=" + encodeURIComponent("Den jyske Vietnamveteran") +
    "&genre=" + encodeURIComponent("Krig") + "&host=" + encodeURIComponent("Grønne Martin") + "#ranglister";
  await negativePage.goto(preservedUrl, { waitUntil: "domcontentloaded" });
  await negativePage.waitForFunction(() => state.activeHostFilter?.name === "Martin Grønne" && state.searchTerm === "Den jyske Vietnamveteran");
  const preserved = await negativePage.evaluate(() => ({
    host: new URLSearchParams(location.search).get("host"),
    search: new URLSearchParams(location.search).get("s"),
    genre: new URLSearchParams(location.search).get("genre"),
    resultKeys: getFilteredPodcasts().map(getPodcastKey)
  }));
  assert.equal(preserved.host, "Martin Grønne", "reversed full name is canonicalized in a compound URL");
  assert.equal(preserved.search, "Den jyske Vietnamveteran", "host canonicalization preserves the search parameter");
  assert.equal(preserved.genre, "Krig", "host canonicalization preserves the selected genre");
  assert.ok(preserved.resultKeys.includes("den jyske vietnamveteran"), "compound search/genre/host URL keeps its exact matching podcast");
  await negativePage.reload({ waitUntil: "domcontentloaded" });
  await negativePage.waitForFunction(() => state.activeHostFilter?.name === "Martin Grønne" && state.searchTerm === "Den jyske Vietnamveteran");
  await negativeContext.close();

  const hashAfter = await readFile(path.join(root, "data/podcasts.json"));
  assert.deepEqual(hashAfter, catalogueHashBefore, "the host filter test does not alter the catalogue source bytes");
  assert.deepEqual(pageErrors, [], "browser interactions produce no uncaught errors");
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log("Clickable ranking host identity, URL history, desktop/mobile interaction, and catalogue preservation passed.");

async function verifyDetailInitialFocusDoesNotStealHostFocus(page) {
  const normalFocus = await page.evaluate(() => {
    const nativeSetTimeout = window.setTimeout;
    let pendingFocus = null;
    window.setTimeout = function (callback, delay, ...args) {
      if (delay === 40 && String(callback).includes("podcast-detail-sheet__close")) {
        pendingFocus = { callback, args };
        return 987654321;
      }
      return nativeSetTimeout(callback, delay, ...args);
    };
    try {
      openPodcastDetailSheet(state.podcastByKey.hvepsereden, null, { allowDesktop: true });
    } finally {
      window.setTimeout = nativeSetTimeout;
    }
    if (!pendingFocus) throw new Error("detail opening did not schedule its accessible initial focus");
    pendingFocus.callback(...pendingFocus.args);
    const closeButton = document.querySelector("#podcastDetailSheet:not(.is-hidden) .podcast-detail-sheet__close");
    const focusedClose = document.activeElement === closeButton;
    closePodcastDetailSheet({ returnFocus: false });
    if (document.activeElement && document.querySelector("#podcastDetailSheet").contains(document.activeElement)) {
      document.activeElement.blur?.();
    }
    return focusedClose;
  });
  assert.equal(normalFocus, true, "normal dialog opening keeps accessible initial focus on the close button");

  for (const name of ["Fie Nygaard", "Laura Krebs"]) {
    const result = await page.evaluate((hostName) => {
      const nativeSetTimeout = window.setTimeout;
      let pendingFocus = null;
      window.setTimeout = function (callback, delay, ...args) {
        if (delay === 40 && String(callback).includes("podcast-detail-sheet__close")) {
          pendingFocus = { callback, args };
          return 987654321;
        }
        return nativeSetTimeout(callback, delay, ...args);
      };
      try {
        openPodcastDetailSheet(state.podcastByKey.hvepsereden, null, { allowDesktop: true });
      } finally {
        window.setTimeout = nativeSetTimeout;
      }
      const button = [...document.querySelectorAll("#podcastDetailSheet:not(.is-hidden) .podcast-detail-sheet__meta .ranking-host-person")]
        .find((item) => item.textContent.trim() === hostName);
      if (!pendingFocus || !button) throw new Error(`missing initial focus or host control: ${hostName}`);
      button.focus();
      const focusedBeforeCallback = document.activeElement === button;
      pendingFocus.callback(...pendingFocus.args);
      const focusPreserved = document.activeElement === button;
      closePodcastDetailSheet({ returnFocus: false });
      if (document.activeElement && document.querySelector("#podcastDetailSheet").contains(document.activeElement)) {
        document.activeElement.blur?.();
      }
      return { focusedBeforeCallback, focusPreserved };
    }, name);
    assert.deepEqual(result, { focusedBeforeCallback: true, focusPreserved: true },
      `delayed initial focus preserves the user's focus on ${name}`);
  }
}

async function clearHostFilter(page) {
  const chip = page.locator('[data-clear-category-filter="host"]').filter({ visible: true }).first();
  if (await chip.count()) await chip.click();
  await page.waitForFunction(() => !state.activeHostFilter && !new URLSearchParams(location.search).has("host"));
}

async function searchPodcast(page, title) {
  const search = page.locator("#searchInput");
  if (await search.getAttribute("readonly") !== null) {
    await search.click();
    await page.waitForFunction(() => {
      const input = document.querySelector("#searchInput");
      return input && !input.readOnly;
    });
  }
  await search.fill(title);
  await page.waitForFunction((expectedTitle) => state.searchTerm === expectedTitle, title);
  return search;
}

async function searchForBakspejlHost(page) {
  const search = page.locator("#searchInput");
  await search.click();
  await search.fill("Den jyske Vietnamveteran");
  await page.waitForFunction(() => state.searchTerm.toLocaleLowerCase("da-DK").includes("den jyske vietnamveteran"));
  const credit = page.locator('[data-key="den jyske vietnamveteran"] [data-ranking-host-credit]').filter({ visible: true }).first();
  await credit.waitFor({ state: "visible", timeout: 10000 });
  assert.equal(await credit.innerText(), "Martin Grønne & Henning Kristensen", "raw credit spacing and separator stay unchanged");
  const buttons = credit.locator(".ranking-host-person");
  assert.deepEqual(await buttons.allTextContents(), ["Martin Grønne", "Henning Kristensen"],
    "the shared credit renders two independent full-person targets");
  return credit;
}

async function exerciseHostHistoryAndActivation(page, width) {
  await clearHostFilter(page);
  if (width > 768 && await page.evaluate(() => state.rankingSource !== "mads")) {
    await page.locator('[data-ranking-source="mads"]').click();
    await page.waitForFunction(() => state.rankingSource === "mads");
  }
  const before = await page.evaluate(() => ({
    source: state.rankingSource, sort: state.sort, userSort: state.userRankingSort,
    userDirection: state.userRankingDirection, count: getFilteredPodcasts().length
  }));
  const credit = await searchForBakspejlHost(page);
  const martin = credit.getByRole("button", { name: "Filtrér ranglisten efter vært Martin Grønne" });
  if (width === 320) await martin.tap(); else await martin.click();
  await page.waitForFunction(() => state.activeHostFilter?.name === "Martin Grønne");
  assert.equal(await page.evaluate(() => state.activePodcastDetailKey), null,
    "activating a host target never opens the podcast detail sheet");
  assert.equal(new URL(page.url()).searchParams.get("s"), "Den jyske Vietnamveteran",
    "clicking a host retains the existing search query");
  assert.equal(new URL(page.url()).searchParams.get("host"), "Martin Grønne");
  assert.equal(await page.evaluate((previous) => JSON.stringify({
    source: state.rankingSource, sort: state.sort, userSort: state.userRankingSort,
    userDirection: state.userRankingDirection
  }) === JSON.stringify(previous), {
    source: before.source, sort: before.sort, userSort: before.userSort, userDirection: before.userDirection
  }), true, "host selection preserves ranking source and sorting");

  await page.goBack();
  await page.waitForFunction(() => !state.activeHostFilter && !new URLSearchParams(location.search).has("host"));
  assert.equal(new URL(page.url()).searchParams.get("s"), "Den jyske Vietnamveteran",
    "browser back restores the previous search state");
  await page.goForward();
  await page.waitForFunction(() => state.activeHostFilter?.name === "Martin Grønne");

  await page.locator("#searchClearButton").click();
  await page.waitForFunction(() => !state.searchTerm && !new URLSearchParams(location.search).has("s"));
  const results = await page.evaluate(() => ({
    ids: getFilteredPodcasts().map(getPodcastKey),
    allMatch: getFilteredPodcasts().every((podcast) => rankingPodcastHasHost(podcast, state.activeHostFilter?.key)),
    unique: new Set(getFilteredPodcasts().map(getPodcastKey)).size === getFilteredPodcasts().length,
    hasMartinOnly: getFilteredPodcasts().some((podcast) => getPodcastKey(podcast) === "mordet pa makrel"),
    hasAmbiguous: getFilteredPodcasts().some((podcast) => getPodcastKey(podcast) === "hjernero"),
    chips: [...document.querySelectorAll('[data-clear-category-filter="host"]')].map((button) => button.innerText.trim())
  }));
  assert.equal(results.allMatch, true, "the active host filter applies exact person identity across the catalogue");
  assert.equal(results.unique, true, "the host filter does not duplicate grouped ranking rows");
  assert.equal(results.hasMartinOnly, true, "Martin-only podcasts are included across the catalogue");
  assert.equal(results.hasAmbiguous, false, "the ambiguous HjerneRO credit remains excluded");
  assert.ok(results.chips.some((text) => text.includes("Vært: Martin Grønne")),
    "the existing active filter UI shows the individual host chip");

  const shareUrl = page.url();
  const copiedLinkTab = await page.context().newPage();
  await copiedLinkTab.goto(shareUrl, { waitUntil: "domcontentloaded" });
  await copiedLinkTab.waitForFunction(() => state.activeHostFilter?.name === "Martin Grønne", null, { timeout: 30000 });
  await copiedLinkTab.close();

  await clearHostFilter(page);
  await page.goBack();
  await page.waitForFunction(() => state.activeHostFilter?.name === "Martin Grønne");
  await page.goForward();
  await page.waitForFunction(() => !state.activeHostFilter && !new URLSearchParams(location.search).has("host"));
  assert.equal(before.count > 0, true);
}

async function exerciseDesktopCardAndTable(page) {
  const sourceButton = page.locator('[data-ranking-source="users"]');
  if (await sourceButton.isVisible()) {
    await sourceButton.click();
    await page.waitForFunction(() => state.rankingSource === "users");
  }
  const countSort = page.locator('[data-ranking-user-sort="count"]');
  if (await countSort.isVisible()) {
    await countSort.click();
    await page.waitForFunction(() => state.userRankingSort === "count");
  }

  const layoutToggle = page.locator(".desktop-ranking-layout-toggle");
  const initialLayout = await page.evaluate(() => state.desktopRankingLayout);
  if (initialLayout !== "cards") {
    await layoutToggle.click();
    await page.waitForFunction(() => state.desktopRankingLayout === "cards");
  }
  await page.locator('[data-ranking-source="mads"]').click();
  await page.waitForFunction(() => state.rankingSource === "mads");
  await searchForBakspejlHost(page);
  const martin = page.locator('[data-key="den jyske vietnamveteran"] .ranking-host-person').filter({ hasText: "Martin Grønne" });
  await martin.click();
  await page.waitForFunction(() => state.activeHostFilter?.name === "Martin Grønne");
  assert.equal(await page.evaluate(() => state.rankingSource), "mads", "desktop card host filter preserves source");
  assert.equal(await page.evaluate(() => state.userRankingSort), "count", "desktop card host filter preserves source sorting");
  await clearHostFilter(page);

  const currentLayout = await page.evaluate(() => state.desktopRankingLayout);
  if (currentLayout !== "list") {
    await page.locator(".desktop-ranking-layout-toggle").click();
    await page.waitForFunction(() => state.desktopRankingLayout === "list");
  }
  await searchForBakspejlHost(page);
  const henning = page.locator('[data-key="den jyske vietnamveteran"] .ranking-host-person').filter({ hasText: "Henning Kristensen" });
  await henning.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await henning.evaluate((button) => button.matches(":focus-visible")), true,
    "host buttons show keyboard focus in the desktop table");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => state.activeHostFilter?.name === "Henning Kristensen");
  assert.equal(await page.evaluate(() => state.activePodcastDetailKey), null,
    "Space activates the host filter without opening details");
  assert.equal(await page.evaluate(() => getFilteredPodcasts().some((podcast) => getPodcastKey(podcast) === "den jyske vietnamveteran")), true,
    "Henning has an independent result through the same shared-host Bakspejl credit");
  assert.equal(await page.evaluate(() => getFilteredPodcasts().every((podcast) => rankingPodcastHasHost(podcast, state.activeHostFilter.key))), true,
    "the Henning filter matches only exact identified host credits");
  await clearHostFilter(page);
}

async function exerciseReviewCard(page) {
  const target = await page.evaluate(() => {
    const podcast = state.podcasts.find((candidate) => !candidate.isDisplayGroup && getHostPeople(candidate).some((person) => person.name === "Martin Grønne") && getReviewForPodcast(candidate)?.review);
    if (!podcast) return null;
    const key = getPodcastKey(podcast);
    const reviewCard = createPodcastReviewCardElement(podcast, getReviewForPodcast(podcast), key);
    elements.podcastGrid.appendChild(reviewCard);
    return { key, title: podcast.title };
  });
  assert.ok(target, "a Martin Grønne podcast has an existing review-card fixture");
  const card = page.locator('[data-key="' + target.key + '"]');
  const reviewCredit = card.locator(".review-card__host .ranking-host-person");
  await reviewCredit.first().waitFor({ state: "visible" });
  assert.ok((await reviewCredit.count()) > 0, "the expanded review card exposes verified individual host buttons");
  const button = reviewCredit.first();
  await button.press("Enter");
  await page.waitForFunction(() => Boolean(state.activeHostFilter?.key));
  assert.equal(await page.evaluate(() => state.activePodcastDetailKey), null);
  await clearHostFilter(page);
}

async function exerciseDetailHostNavigation(page, width) {
  await clearHostFilter(page);
  await page.locator("#searchClearButton").click().catch(() => {});
  await page.waitForFunction(() => !state.searchTerm);
  await page.evaluate(() => {
    const podcast = state.podcastByKey["den jyske vietnamveteran"];
    openPodcastDetailSheet(podcast, null, { allowDesktop: true });
  });
  const detail = page.locator("#podcastDetailSheet:not(.is-hidden)");
  await detail.waitFor({ state: "visible" });
  const hostButtons = detail.locator(".podcast-detail-sheet__meta .ranking-host-person");
  assert.deepEqual(await hostButtons.allTextContents(), ["Martin Grønne", "Henning Kristensen"],
    "the Bakspejl detail shows independently clickable verified hosts");
  const henning = hostButtons.filter({ hasText: "Henning Kristensen" });
  const styles = await henning.evaluate((button) => ({
    decoration: getComputedStyle(button).textDecorationLine,
    focusable: button.tabIndex === 0
  }));
  assert.equal(styles.decoration, "none", "detail host controls have no underline");
  assert.equal(styles.focusable, true, "detail host control remains keyboard accessible");
  if (width === 320) await henning.tap(); else await henning.click();
  await page.waitForFunction(() => state.activeHostFilter?.name === "Henning Kristensen");
  assert.equal(await detail.count(), 0, "host navigation closes the detail sheet");
  assert.equal(new URL(page.url()).searchParams.get("host"), "Henning Kristensen",
    "detail navigation activates the selected individual host filter");
  assert.equal(new URL(page.url()).hash, "#ranglister");
  assert.equal(await page.evaluate(() => state.activePodcastDetailKey), null,
    "host activation does not reopen the podcast detail");
  assert.equal(await page.evaluate(() => getFilteredPodcasts().every((podcast) => rankingPodcastHasHost(podcast, state.activeHostFilter?.key))), true,
    "detail navigation returns only exact matches for Henning");
  await page.goBack();
  await page.waitForFunction(() => Boolean(state.activePodcastDetailKey) &&
    document.querySelector("#podcastDetailSheet:not(.is-hidden)"));
  assert.equal(await page.evaluate(() => state.activeHostFilter), null,
    "Back restores the previous host-filter state with the detail sheet");
  await page.evaluate(() => closePodcastDetailSheet({ returnFocus: false }));

  await page.evaluate(() => {
    openPodcastDetailSheet(state.podcastByKey.hjernero, null, { allowDesktop: true });
  });
  const hjerneRoDetail = page.locator("#podcastDetailSheet:not(.is-hidden)");
  await hjerneRoDetail.waitFor({ state: "visible" });
  const hjerneRoMeta = hjerneRoDetail.locator(".podcast-detail-sheet__meta");
  assert.equal(await hjerneRoMeta.innerText(), "Mads Hyldig & Martin Riis Kastrup",
    "the approved full host credit stays visible in the detail sheet");
  assert.deepEqual(await hjerneRoMeta.locator(".ranking-host-person").allTextContents(),
    ["Mads Hyldig", "Martin Riis Kastrup"], "the approved full names create separate clickable host identities");
  await page.evaluate(() => closePodcastDetailSheet({ returnFocus: false }));
}

async function verifyAllApprovedHostButtons(page, hostCredits) {
  for (const [podcastId, credit] of hostCredits) {
    const podcast = await page.evaluate((id) => state.podcastByKey[id], podcastId);
    assert.ok(podcast, `${podcastId} is available in the ranking state`);
    const expected = credit.split(/\s*&\s*/u);
    await page.evaluate((id) => openPodcastDetailSheet(state.podcastByKey[id], null, { allowDesktop: true }), podcastId);
    const detail = page.locator("#podcastDetailSheet:not(.is-hidden)");
    await detail.waitFor({ state: "visible" });
    assert.deepEqual(await detail.locator(".podcast-detail-sheet__meta .ranking-host-person").allTextContents(), expected,
      `${podcastId} detail exposes each verified full host as an individual button`);
    await page.evaluate(() => closePodcastDetailSheet({ returnFocus: false }));

    const search = await searchPodcast(page, podcast.title);
    const rankingCredit = page.locator("[data-ranking-host-credit]").filter({ hasText: expected[0] }).first();
    await rankingCredit.waitFor({ state: "visible" });
    assert.deepEqual(await rankingCredit.locator(".ranking-host-person").allTextContents(), expected,
      `${podcastId} ranking credit exposes every verified full host as a separate button`);
    await search.fill("");
    await page.waitForFunction(() => !state.searchTerm);
  }
}

async function exerciseAllApprovedHosts(page, hostCredits) {
  for (const [podcastId, credit] of hostCredits) {
    const podcast = await page.evaluate((id) => state.podcastByKey[id], podcastId);
    assert.ok(podcast, `${podcastId} is available in the touch ranking state`);
    const expected = credit.split(/\s*&\s*/u);
    const search = await searchPodcast(page, podcast.title);
    const rankingCredit = page.locator("[data-ranking-host-credit]").filter({ hasText: expected[0] }).first();
    await rankingCredit.waitFor({ state: "visible" });
    assert.deepEqual(await rankingCredit.locator(".ranking-host-person").allTextContents(), expected,
      `${podcastId} ranking row displays the individual approved names`);

    for (const [hostIndex, name] of expected.entries()) {
      const hostButton = rankingCredit.getByRole("button", { name: `Filtrér ranglisten efter vært ${name}` });
      if (hostIndex === 0) {
        await hostButton.tap();
      } else {
        await hostButton.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        assert.equal(await hostButton.evaluate((button) => button.matches(":focus-visible")), true,
          `${podcastId} second host control has visible keyboard focus`);
        await hostButton.press("Enter");
      }
      await page.waitForFunction((host) => state.activeHostFilter?.name === host, name);
      assert.equal(new URL(page.url()).searchParams.get("host"), name, `${podcastId} touch sets the exact host URL`);
      assert.equal(await page.evaluate((id) => getFilteredPodcasts().some((item) => getPodcastKey(item) === id), podcastId), true,
        `${podcastId} remains in its host's exact ranking results`);
      assert.equal(await page.evaluate(() => getFilteredPodcasts().every((item) => rankingPodcastHasHost(item, state.activeHostFilter.key))), true,
        `${name} results use exact host identity`);

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction((host) => state.activeHostFilter?.name === host, name);
      await page.goBack();
      await page.waitForFunction(() => !state.activeHostFilter && !new URLSearchParams(location.search).has("host"));
      await page.goForward();
      await page.waitForFunction((host) => state.activeHostFilter?.name === host, name);
      await clearHostFilter(page);
      await searchPodcast(page, podcast.title);
    }

    await page.evaluate((id) => openPodcastDetailSheet(state.podcastByKey[id], null, { allowDesktop: true }), podcastId);
    const detail = page.locator("#podcastDetailSheet:not(.is-hidden)");
    await detail.waitFor({ state: "visible" });
    for (const [hostIndex, name] of expected.entries()) {
      await page.evaluate((id) => {
        if (state.activePodcastDetailKey !== id) openPodcastDetailSheet(state.podcastByKey[id], null, { allowDesktop: true });
      }, podcastId);
      const hostButton = page.locator("#podcastDetailSheet:not(.is-hidden) .podcast-detail-sheet__meta")
        .getByRole("button", { name: `Filtrér ranglisten efter vært ${name}` });
      if (hostIndex === 0) await hostButton.tap();
      else await hostButton.press("Enter");
      await page.waitForFunction((host) => state.activeHostFilter?.name === host, name);
      assert.equal(new URL(page.url()).searchParams.get("host"), name, `${podcastId} detail touch sets the exact host URL`);
      assert.equal(await page.evaluate(() => state.activePodcastDetailKey), null,
        `${podcastId} detail host activation closes the sheet`);
      await clearHostFilter(page);
    }
    await page.locator("#searchClearButton").click().catch(() => {});
    await page.waitForFunction(() => !state.searchTerm);
  }
}
