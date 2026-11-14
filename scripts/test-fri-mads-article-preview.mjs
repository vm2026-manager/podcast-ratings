import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { FRIHEDSBREVET_SOURCE_REGISTRY } from "./audit-frihedsbrevet-sources.mjs";
import { isValidFriMadsArticleSidecar } from "./update-fri-mads-article-sidecar.mjs";

const [app, siteCss, mobileCss, desktopCss, sidecarText, catalogText, fixtureText] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../style.css", import.meta.url), "utf8"),
  readFile(new URL("../mobile-episode-expansion.css", import.meta.url), "utf8"),
  readFile(new URL("../desktop-episode-workspace.css", import.meta.url), "utf8"),
  readFile(new URL("../data/fri-mads-articles.json", import.meta.url), "utf8"),
  readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"),
  readFile(new URL("./fixtures/fri-mads-article-preview.json", import.meta.url), "utf8")
]);

const sidecar = JSON.parse(sidecarText);
const catalog = JSON.parse(catalogText);
const fixture = JSON.parse(fixtureText);
const before = JSON.stringify({ sidecar, catalog, fixture });

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is present in app.js`);
  const declarationStart = app.slice(Math.max(0, start - 6), start) === "async " ? start - 6 : start;
  const boundaries = [app.indexOf("\nfunction ", start + 1), app.indexOf("\nasync function ", start + 1)]
    .filter((index) => index >= 0);
  return app.slice(declarationStart, boundaries.length ? Math.min(...boundaries) : app.length);
}

const escapeHtmlSource = extractFunction("escapeHtml");
const identitySource = extractFunction("isFriMadsMetadataPodcast");
const validationSource = extractFunction("isValidFriMadsArticleSidecar");
const episodeIdentityFieldsSource = extractFunction("getFriMadsEpisodeIdentityFields");
const duplicateSource = extractFunction("isFriMadsReleaseAlreadyEpisode");
const renderSource = extractFunction("renderFriMadsEpisodeOverview");
const fetchSource = extractFunction("getFriMadsArticleSidecar");
const detailSource = extractFunction("renderPodcastDetailSheetContent");
const overviewContentSource = extractFunction("renderPodcastEpisodeOverviewContent");
const overviewSource = extractFunction("renderPodcastEpisodeOverview");
const overviewEventsSource = extractFunction("bindPodcastEpisodeOverviewEvents");
const rateabilitySource = extractFunction("isRateablePodcastEpisode");
const podcast = {
  podcastId: "fri mads",
  catalogueId: "catalogue-v1-d94fc39e",
  link: "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/"
};
const render = new Function("podcast", "data", "episodes", `${escapeHtmlSource}\n${identitySource}\n${validationSource}\n${episodeIdentityFieldsSource}\n${duplicateSource}\n${renderSource}\nreturn renderFriMadsEpisodeOverview(podcast, data, episodes);`);
const renderWithStatus = new Function("podcast", "data", "episodes", "loading", `${escapeHtmlSource}\n${identitySource}\n${validationSource}\n${episodeIdentityFieldsSource}\n${duplicateSource}\n${renderSource}\nreturn renderFriMadsEpisodeOverview(podcast, data, episodes, { loading });`);
const bindOverviewEvents = new Function("window", "dialog", "podcast", `${overviewEventsSource}\nreturn bindPodcastEpisodeOverviewEvents(dialog, podcast);`);
const unavailableFor = (mutate) => {
  const changed = structuredClone(sidecar);
  mutate(changed);
  return changed;
};

assert.equal(isValidFriMadsArticleSidecar(sidecar), true, "the checked-in public metadata sidecar validates");
assert.equal(sidecar.podcastId, "fri mads");
assert.equal(sidecar.catalogueId, "catalogue-v1-d94fc39e");
assert.equal(sidecar.sourceOverview, "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/");
assert.equal(sidecar.accessType, "paid");
assert.equal(sidecar.contentKind, "article");
assert.equal(sidecar.metadataOnly, true);
assert.equal(sidecar.playable, false);
assert.equal(sidecar.rateable, false);
assert.equal(sidecar.audioUrl, null);
assert.deepEqual(sidecar.items.map((item) => item.releaseNumber), [172, 171, 170, 169, 168]);
assert.equal(sidecar.items[0].title, "Fri Mads #172: Alle elsker Mette");
assert.equal(sidecar.items[0].publishedDate, "2026-11-08");
assert.equal(sidecar.items[0].canonicalUrl, "https://frihedsbrevet.dk/fri-mads-172-alle-elsker-mette/");
assert.equal(sidecar.items.some((item) => item.releaseNumber === 173), false, "synthetic #173 never appears in public sidecar data");
assert.ok(sidecar.items.every((item) => item.fixtureOnly !== true && !("articleText" in item)));

assert.equal(FRIHEDSBREVET_SOURCE_REGISTRY.length, 36);
assert.ok(catalog.rows.length >= 1376, "the catalogue retains the minimum baseline while allowing verified growth");
assert.equal(FRIHEDSBREVET_SOURCE_REGISTRY.filter((identity) => catalog.rows.some((row) =>
  row["Podcast-ID"] === identity.podcastId && row.catalogue_id === identity.catalogueId)).length, 36,
"all exact Frihedsbrevet Podcast-ID/catalogue_id pairs still exist in latest main");
assert.deepEqual(catalog.rows.filter((row) => row["Podcast-ID"] === "fri mads").map((row) => ({
  podcastId: row["Podcast-ID"], catalogueId: row.catalogue_id, link: row.Link,
  accessEvidenceUrl: row.accessEvidenceUrl, accessType: row.accessType
})), [{
  podcastId: "fri mads", catalogueId: "catalogue-v1-d94fc39e",
  link: "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/",
  accessEvidenceUrl: "https://frihedsbrevet.dk/fri-mads-140-verden-af-i-gaar/", accessType: "paid"
}], "Fri Mads canonical identity, profile link, #140 provenance and paid classification stay unchanged");

const originalRows = catalog.rows.map((row) => ({ id: row["Podcast-ID"], catalogueId: row.catalogue_id }));
const firstRender = render(podcast, sidecar, []);
assert.equal(firstRender, render(podcast, structuredClone(sidecar), []), "the same sidecar renders identically on repeat");
assert.equal((firstRender.match(/data-fri-mads-release-id=/gu) || []).length, 5);
for (const release of sidecar.items) {
  assert.ok(firstRender.includes(release.title), `normal episode list includes ${release.releaseId}`);
  assert.ok(firstRender.includes(release.canonicalUrl), `official per-release link is retained for ${release.releaseId}`);
}
assert.match(firstRender, /class="podcast-detail-sheet__episode-overview/u);
assert.match(firstRender, /podcast-detail-sheet__episode-table--fri-mads-metadata/u);
assert.match(firstRender, /Lyt hos Frihedsbrevet/u);
assert.match(firstRender, /Betalt adgang/u);
assert.match(firstRender, /8\. november 2026/u);
assert.doesNotMatch(firstRender, /Fri Mads-artikler|fri-mads-article-preview|#173|fri-mads-173-|<audio\b|<video\b|duration|varighed|data-episode-rating|data-episode-overview-rating-id|Din vurdering|Brugernes vurdering|<button\b[^>]*data-episode-overview-rating-id/iu,
  "episode cards contain no separate article block, synthetic release, audio controls, duration or rating controls");
assert.equal(render({ ...podcast, podcastId: "friis diplomatpost" }, sidecar, []), "", "the exact Fri Mads identity is required");
assert.equal(render({ ...podcast, catalogueId: "catalogue-v1-wrong" }, sidecar, []), "", "the exact catalogue identity is required");
assert.equal(render({ ...podcast, link: "https://example.org/" }, sidecar, []), "", "the approved canonical profile link is required");
assert.match(render(podcast, null, []), /Udgivelserne kunne ikke hentes/u, "invalid source renders a fail-closed workspace state");
assert.match(renderWithStatus(podcast, null, [], true), /Henter verificerede udgivelser/u);
assert.match(renderWithStatus(podcast, null, [], false), /Udgivelserne kunne ikke hentes/u);

for (const mobile of [true, false]) {
  const detailContent = { dataset: {}, addEventListener() {} };
  const tableWrap = { dataset: {}, addEventListener() {} };
  const overview = {
    querySelector(selector) {
      if (selector === ".podcast-detail-sheet__episode-table-wrap") return tableWrap;
      return null;
    },
    querySelectorAll() { return []; }
  };
  const dialog = {
    querySelector(selector) {
      if (selector === "[data-podcast-episode-overview]") return overview;
      if (selector === "[data-podcast-detail-content]") return detailContent;
      return null;
    }
  };
  assert.doesNotThrow(() => bindOverviewEvents({ matchMedia: () => ({ matches: mobile }) }, dialog, podcast),
    `${mobile ? "mobile" : "desktop"} metadata-only overview binds safely without optional search and back controls`);
}

for (const [label, candidate] of [
  ["wrong podcast identity", unavailableFor((data) => { data.podcastId = "friis diplomatpost"; })],
  ["wrong catalogue identity", unavailableFor((data) => { data.catalogueId = "catalogue-v1-wrong"; })],
  ["wrong source", unavailableFor((data) => { data.sourceOverview = "https://example.org/"; })],
  ["free access", unavailableFor((data) => { data.accessType = "free"; })],
  ["episode content", unavailableFor((data) => { data.contentKind = "episode"; })],
  ["playable content", unavailableFor((data) => { data.playable = true; })],
  ["rateable content", unavailableFor((data) => { data.rateable = true; })],
  ["audio URL", unavailableFor((data) => { data.audioUrl = "https://example.org/audio.mp3"; })],
  ["extra private metadata", unavailableFor((data) => { data.articleText = "protected text"; })],
  ["duplicate number and URL", unavailableFor((data) => { data.items[1] = structuredClone(data.items[0]); })],
  ["number gap", unavailableFor((data) => { data.items[1].releaseNumber = 169; data.items[1].title = "Fri Mads #169: Forkert nummer"; data.items[1].canonicalUrl = "https://frihedsbrevet.dk/fri-mads-169-forkert-nummer/"; data.items[1].releaseId = `fri-mads:169:${data.items[1].canonicalUrl}`; })],
  ["foreign host", unavailableFor((data) => { data.items[0].canonicalUrl = data.items[0].canonicalUrl.replace("frihedsbrevet.dk", "example.org"); data.items[0].releaseId = `fri-mads:172:${data.items[0].canonicalUrl}`; })],
  ["wrong permalink number", unavailableFor((data) => { data.items[0].canonicalUrl = "https://frihedsbrevet.dk/fri-mads-173-wrong-number/"; data.items[0].releaseId = `fri-mads:172:${data.items[0].canonicalUrl}`; })],
  ["invalid date", unavailableFor((data) => { data.items[0].publishedDate = "2026-02-31"; })]
]) {
  assert.equal(isValidFriMadsArticleSidecar(candidate), false, `${label} fails closed`);
  assert.match(renderWithStatus(podcast, candidate, [], false), /Udgivelserne kunne ikke hentes/u, `${label} is not shown`);
}

const matchingExistingEpisode = { external_guid: sidecar.items[0].canonicalUrl };
const titleOnlyCollision = { title: sidecar.items[0].title, external_guid: "different-guid" };
const withoutExactDuplicate = render(podcast, sidecar, [titleOnlyCollision]);
assert.equal((withoutExactDuplicate.match(/data-fri-mads-release-id=/gu) || []).length, 5,
  "title-only matching cannot suppress a distinct future podcast identity");
const withExactDuplicate = render(podcast, sidecar, [matchingExistingEpisode]);
assert.equal((withExactDuplicate.match(/data-fri-mads-release-id=/gu) || []).length, 4,
  "an exact canonical URL already present as an episode is not shown twice");
assert.doesNotMatch(withExactDuplicate, /Fri Mads #172: Alle elsker Mette/u);

assert.match(detailSource, /isFriMadsMetadataPodcast\(podcast\)/u);
assert.match(detailSource, /hasFriMadsPublications \? "Se afsnit"/u, "profile entry exposes a neutral episode-list action");
assert.doesNotMatch(detailSource, /getFriMadsArticlePreviewPlaceholder|fri-mads-article-preview|hydrateFriMadsArticleMetadataPreview/u,
  "there is no separate Fri Mads article section or eager sidecar hydration");
assert.match(overviewContentSource, /renderFriMadsEpisodeOverview\(podcast, null, \[\], \{ loading: true \}\)/u,
  "Fri Mads uses the existing episode workspace route and starts in a loading state");
assert.match(overviewContentSource, /getFriMadsArticleSidecar\(\)/u, "sidecar is loaded on the same-origin profile flow");
assert.match(fetchSource, /data\/fri-mads-articles\.json/u);
assert.match(fetchSource, /sidecarUrl\.origin !== window\.location\.origin/u, "sidecar requests are same-origin only");
assert.match(fetchSource, /credentials:\s*"same-origin"/u);
assert.match(fetchSource, /redirect:\s*"error"/u);
assert.match(rateabilitySource, /metadata\.rateable !== false/u, "the existing episode rating eligibility rule remains intact");
assert.doesNotMatch(overviewSource, /FriMads|Fri Mads/u, "metadata publications never enter the normal rateable episode renderer");
assert.deepEqual(catalog.rows.map((row) => ({ id: row["Podcast-ID"], catalogueId: row.catalogue_id })), originalRows);
assert.equal(JSON.stringify({ sidecar, catalog, fixture }), before, "rendering does not mutate sidecar, fixture or catalogue data");

const helperScript = `let friMadsArticleSidecarPromise = null; let friMadsArticleSidecarData = null;\n${escapeHtmlSource}\n${identitySource}\n${validationSource}\n${episodeIdentityFieldsSource}\n${duplicateSource}\n${renderSource}\n${fetchSource}
window.loadFriMadsEpisodes = async (podcast, target) => {
  target.innerHTML = renderFriMadsEpisodeOverview(podcast, null, [], { loading: true });
  const data = await getFriMadsArticleSidecar();
  if (target.isConnected) target.innerHTML = renderFriMadsEpisodeOverview(podcast, data, []);
};
document.querySelector('[data-podcast-episodes-open]').addEventListener('click', () => window.loadFriMadsEpisodes(${JSON.stringify(podcast)}, document.querySelector('[data-podcast-detail-content]')));`;
let mode = "valid";
let dataRequests = 0;
const html = `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${siteCss}\n${mobileCss}\n${desktopCss}</style></head><body class="page-podcast">
<div id="podcastDetailSheet" class="is-episode-workspace"><main class="podcast-detail-sheet__content" data-podcast-detail-content style="box-sizing:border-box;width:100%;height:600px;max-height:80vh;overflow-y:auto;">
<a class="podcast-detail-sheet__header-link" href="https://frihedsbrevet.dk/nyhedsbrev/fri-mads/" target="_blank" rel="noopener noreferrer">Fri Mads hos Frihedsbrevet</a>
<h2>Fri Mads</h2><div class="podcast-detail-sheet__ratings">Vurderinger</div>
<button type="button" class="podcast-detail-sheet__episode-entry-button" data-podcast-episodes-open>Se afsnit</button></main></div>
<script>${helperScript}</script></body></html>`;

const server = createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname === "/data/fri-mads-articles.json") {
    dataRequests += 1;
    if (mode === "missing") { response.writeHead(404).end(); return; }
    if (mode === "wrong-type") { response.writeHead(200, { "content-type": "text/html" }).end("not json"); return; }
    if (mode === "invalid-json") { response.writeHead(200, { "content-type": "application/json" }).end("{"); return; }
    if (mode === "invalid-sidecar") { response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ...sidecar, items: [] })); return; }
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(sidecarText);
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await context.route("https://frihedsbrevet.dk/**", (route) => route.fulfill({
    status: 200, contentType: "text/html", body: "<!doctype html><title>Official source link intercepted for test</title>"
  }));
  await page.goto(`${origin}/profile`, { waitUntil: "domcontentloaded" });
  assert.equal(await page.locator(".fri-mads-article-preview, [data-fri-mads-article-preview]").count(), 0,
    "profile has no detached article block");
  assert.equal(dataRequests, 0, "the sidecar loads only when the standard episode-list entry is activated");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("href")), "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/",
    "the official series link remains keyboard reachable on the profile");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.podcastEpisodesOpen), "",
    "the episode-list action is keyboard reachable on the profile");
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-podcast-episode-overview] [data-fri-mads-release-id]", { timeout: 5000 });
  assert.equal(dataRequests, 1, "the profile retrieves the same-origin sidecar once");
  assert.equal(await page.locator(".podcast-detail-sheet__episode-overview").count(), 1);
  assert.equal(await page.locator(".podcast-detail-sheet__episode-table--fri-mads-metadata tr[data-fri-mads-release-id]").count(), 5);
  assert.equal(await page.locator("audio, video, [data-episode-rating], [data-episode-overview-rating-id], button[data-episode-overview-rating-id]").count(), 0);
  assert.equal(await page.locator(".podcast-detail-sheet__episode-table th").count(), 2,
    "metadata-only rows omit the episode rating columns");

  for (const width of [320, 375, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 769 ? 700 : 900 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      pane: document.querySelector("[data-podcast-detail-content]").scrollWidth,
      paneClient: document.querySelector("[data-podcast-detail-content]").clientWidth,
      titles: [...document.querySelectorAll(".podcast-detail-sheet__episode-table .episode-title")].every((element) => element.scrollWidth <= element.clientWidth + 1),
      links: [...document.querySelectorAll(".podcast-detail-sheet__episode-table a")].every((element) => element.scrollWidth <= element.clientWidth + 1),
      cardCount: document.querySelectorAll(".podcast-detail-sheet__episode-table tr[data-fri-mads-release-id]").length
    }));
    assert.ok(dimensions.document <= dimensions.viewport, `${width}px document has no horizontal overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.body <= dimensions.viewport, `${width}px body has no horizontal overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.pane <= dimensions.paneClient + 1, `${width}px profile pane has no horizontal overflow: ${JSON.stringify(dimensions)}`);
    assert.equal(dimensions.titles, true, `${width}px episode titles wrap inside the existing cards`);
    assert.equal(dimensions.links, true, `${width}px external links wrap inside the existing cards`);
    assert.equal(dimensions.cardCount, 5, `${width}px renders all five verified releases`);
  }

  await page.setViewportSize({ width: 390, height: 700 });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.waitForSelector(".podcast-detail-sheet__episode-table a", { timeout: 5000 });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const linkFocus = await page.evaluate(() => ({
    href: document.activeElement?.getAttribute("href"), outline: getComputedStyle(document.activeElement).outlineStyle
  }));
  assert.match(linkFocus.href || "", /^https:\/\/frihedsbrevet\.dk\/fri-mads-/u);
  assert.notEqual(linkFocus.outline, "none", "the official release link retains visible keyboard focus");
  const firstLink = page.locator(".podcast-detail-sheet__episode-table a").first();
  assert.equal(await firstLink.getAttribute("target"), "_blank");
  assert.match(await firstLink.getAttribute("rel"), /noopener/u);
  const expectedUrl = await firstLink.getAttribute("href");
  const popupPromise = page.waitForEvent("popup");
  await firstLink.tap();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  assert.equal(popup.url(), expectedUrl, "touch activation opens the exact verified release permalink");
  const pane = page.locator("[data-podcast-detail-content]");
  await pane.evaluate((element) => element.scrollTo(0, element.scrollHeight));
  assert.ok(await pane.evaluate((element) => element.scrollTop > 0), "the standard episode workspace scrolls on mobile");
  await context.close();

  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const desktopPage = await desktopContext.newPage();
  await desktopContext.route("https://frihedsbrevet.dk/**", (route) => route.fulfill({
    status: 200, contentType: "text/html", body: "<!doctype html><title>Official source link intercepted for test</title>"
  }));
  await desktopPage.goto(`${origin}/desktop`, { waitUntil: "domcontentloaded" });
  await desktopPage.locator("[data-podcast-episodes-open]").click();
  await desktopPage.waitForSelector(".podcast-detail-sheet__episode-table a", { timeout: 5000 });
  for (const width of [1280, 1440]) {
    await desktopPage.setViewportSize({ width, height: 900 });
    const desktopDimensions = await desktopPage.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    assert.ok(desktopDimensions.document <= width && desktopDimensions.body <= width,
      `${width}px desktop has no horizontal overflow: ${JSON.stringify(desktopDimensions)}`);
  }
  await desktopPage.keyboard.press("Tab");
  await desktopPage.keyboard.press("Tab");
  const desktopFocus = await desktopPage.evaluate(() => ({
    href: document.activeElement?.getAttribute("href"),
    outline: getComputedStyle(document.activeElement).outlineStyle
  }));
  assert.match(desktopFocus.href || "", /^https:\/\/frihedsbrevet\.dk\/fri-mads-/u);
  assert.notEqual(desktopFocus.outline, "none", "desktop keyboard focus is visible on the source link");
  const desktopLink = desktopPage.locator(".podcast-detail-sheet__episode-table a").first();
  const desktopUrl = await desktopLink.getAttribute("href");
  const desktopPopupPromise = desktopPage.waitForEvent("popup");
  await desktopLink.click();
  const desktopPopup = await desktopPopupPromise;
  await desktopPopup.waitForLoadState("domcontentloaded");
  assert.equal(desktopPopup.url(), desktopUrl, "desktop click opens the exact verified source permalink");
  await desktopContext.close();

  for (const invalidMode of ["missing", "wrong-type", "invalid-json", "invalid-sidecar"]) {
    mode = invalidMode;
    const failClosedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const failClosedPage = await failClosedContext.newPage();
    await failClosedPage.goto(`${origin}/profile?mode=${invalidMode}`, { waitUntil: "domcontentloaded" });
    await failClosedPage.locator("[data-podcast-episodes-open]").click();
    await failClosedPage.waitForSelector("text=Udgivelserne kunne ikke hentes", { timeout: 5000 });
    assert.equal(await failClosedPage.locator("[data-fri-mads-release-id]").count(), 0, `${invalidMode} source hides unverified releases`);
    const fallbackLink = failClosedPage.locator('a[href="https://frihedsbrevet.dk/nyhedsbrev/fri-mads/"]');
    assert.equal(await fallbackLink.count(), 1, `${invalidMode} source preserves the official series link`);
    assert.equal(await fallbackLink.textContent(), "Fri Mads hos Frihedsbrevet");
    await failClosedContext.close();
  }
  assert.deepEqual(pageErrors, [], `browser harness has no page errors: ${pageErrors.join(" | ")}`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

assert.equal(JSON.stringify({ sidecar, catalog, fixture }), before, "the UI view performs no source, catalogue, episode or rating mutation");
console.log("Fri Mads episode-list rendering, paid access, identity, duplicate suppression, no-rating behavior, same-origin loading and 320–1440px interaction checks passed.");
