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
const placeholderSource = extractFunction("getFriMadsArticlePreviewPlaceholder");
const validationSource = extractFunction("isValidFriMadsArticleSidecar");
const renderSource = extractFunction("renderFriMadsArticleMetadataPreview");
const fetchSource = extractFunction("getFriMadsArticleSidecar");
const hydrateSource = extractFunction("hydrateFriMadsArticleMetadataPreview");
const detailSource = extractFunction("renderPodcastDetailSheetContent");
const overviewSource = extractFunction("renderPodcastEpisodeOverview");
const rateabilitySource = extractFunction("isRateablePodcastEpisode");
const podcast = {
  podcastId: "fri mads",
  catalogueId: "catalogue-v1-d94fc39e",
  link: "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/"
};
const render = new Function("podcast", "data", `${escapeHtmlSource}\n${validationSource}\n${renderSource}\nreturn renderFriMadsArticleMetadataPreview(podcast, data);`);
const placeholder = new Function("podcast", placeholderSource + "\nreturn getFriMadsArticlePreviewPlaceholder(podcast);");
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
assert.equal(sidecar.items.some((item) => item.releaseNumber === 173), false, "synthetic #173 never appears in live sidecar data");
assert.ok(sidecar.items.every((item) => item.fixtureOnly !== true && !("articleText" in item)));

assert.equal(FRIHEDSBREVET_SOURCE_REGISTRY.length, 36);
assert.equal(catalog.rows.length, 1376);
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
}], "Fri Mads catalogue identity, link, historical #140 provenance, and paid classification stay unchanged");

const originalRows = catalog.rows.map((row) => ({ id: row["Podcast-ID"], catalogueId: row.catalogue_id }));
const firstRender = render(podcast, sidecar);
assert.equal(firstRender, render(podcast, structuredClone(sidecar)), "the same verified sidecar renders identically on repeat");
assert.match(firstRender, /Fri Mads #172: Alle elsker Mette/u);
assert.match(firstRender, /8\. november 2026/u);
assert.match(firstRender, /Artikel · nyhedsbrev/u);
assert.match(firstRender, /Betalt artikel · læseadgang kan kræve abonnement/u);
assert.match(firstRender, /href="https:\/\/frihedsbrevet\.dk\/fri-mads-172-alle-elsker-mette\/"/u);
assert.doesNotMatch(firstRender, /#173|fri-mads-173-|<audio\b|<video\b|duration|varighed|data-episode-rating|data-episode-overview-rating-id|<button\b/iu,
  "article cards contain no synthetic #173, media player, duration, or rating controls");
assert.equal(placeholder(podcast).includes("data-fri-mads-article-preview"), true);
assert.equal(placeholder({ ...podcast, podcastId: "friis diplomatpost" }), "");
assert.equal(placeholder({ ...podcast, catalogueId: "catalogue-v1-wrong" }), "");
assert.equal(placeholder({ ...podcast, link: "https://example.org/" }), "");
assert.equal(render({ ...podcast, podcastId: "friis diplomatpost" }, sidecar), "");
assert.equal(render({ ...podcast, catalogueId: "catalogue-v1-wrong" }, sidecar), "");
assert.equal(render({ ...podcast, link: "https://example.org/" }, sidecar), "");

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
  assert.equal(render(podcast, candidate), "", `${label} is not rendered`);
}

assert.match(detailSource, /\$\{getFriMadsArticlePreviewPlaceholder\(podcast\)\}/u,
  "the list is mounted on the podcast profile, independently of the episode table");
assert.ok(detailSource.indexOf("getFriMadsArticlePreviewPlaceholder") > detailSource.indexOf('class="podcast-detail-sheet__ratings"'),
  "the list follows the existing profile ratings block");
assert.match(detailSource, /hydrateFriMadsArticleMetadataPreview\(podcast, friMadsArticlePreviewTarget\)/u,
  "the profile hydrates the static sidecar after rendering its own content");
assert.doesNotMatch(overviewSource, /renderFriMadsArticleMetadataPreview|friMadsArticlePreviewItems/u,
  "articles never enter the rateable episode overview");
assert.match(fetchSource, /data\/fri-mads-articles\.json/u);
assert.match(fetchSource, /sidecarUrl\.origin !== window\.location\.origin/u, "sidecar requests are same-origin only");
assert.match(fetchSource, /credentials:\s*"same-origin"/u);
assert.match(fetchSource, /redirect:\s*"error"/u);
assert.match(rateabilitySource, /metadata\.rateable !== false/u, "the existing episode rating eligibility rule remains intact");
assert.equal(JSON.stringify({ sidecar, catalog, fixture }), before, "rendering does not mutate sidecar, fixture, or catalogue data");

const helperScript = `let friMadsArticleSidecarPromise = null;\n${escapeHtmlSource}\n${validationSource}\n${renderSource}\n${fetchSource}\n${hydrateSource}\nwindow.hydrateFriMadsPreviewForTest = hydrateFriMadsArticleMetadataPreview;`;
let mode = "valid";
let dataRequests = 0;
const html = `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${siteCss}\n${mobileCss}\n${desktopCss}</style></head><body class="page-podcast">
<main class="podcast-detail-sheet__content" data-podcast-detail-content style="box-sizing:border-box;width:100%;height:600px;max-height:80vh;overflow-y:auto;">
<a class="podcast-detail-sheet__header-link" href="https://frihedsbrevet.dk/nyhedsbrev/fri-mads/" target="_blank" rel="noopener noreferrer">Fri Mads hos Frihedsbrevet</a>
<h2>Fri Mads</h2><div class="podcast-detail-sheet__ratings">Vurderinger</div>
<section class="fri-mads-article-preview" data-fri-mads-article-preview hidden aria-label="Fri Mads-artikler"></section></main>
<script>${helperScript}\nwindow.hydrateFriMadsPreviewForTest(${JSON.stringify(podcast)},document.querySelector('[data-fri-mads-article-preview]'));</script></body></html>`;

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
  const context = await browser.newContext({ viewport: { width: 390, height: 600 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await context.route("https://frihedsbrevet.dk/**", (route) => route.fulfill({
    status: 200, contentType: "text/html", body: "<!doctype html><title>Official source link intercepted for test</title>"
  }));
  await page.goto(`${origin}/profile`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForSelector("[data-fri-mads-article-preview]:not([hidden])", { timeout: 5000 });
  } catch {
    assert.fail(`valid sidecar did not render; requests=${dataRequests}; pageErrors=${pageErrors.join(" | ") || "none"}; panel=${await page.locator("[data-fri-mads-article-preview]").evaluate((element) => element.outerHTML)}`);
  }
  assert.equal(dataRequests, 1, "the profile retrieves the same-origin static sidecar exactly once");
  assert.equal(await page.locator(".fri-mads-article-preview__card").count(), 5);
  assert.equal(await page.locator("audio, video, [data-episode-rating], [data-episode-overview-rating-id]").count(), 0);

  for (const width of [320, 375, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 769 ? 600 : 900 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      pane: document.querySelector("[data-podcast-detail-content]").scrollWidth,
      paneClient: document.querySelector("[data-podcast-detail-content]").clientWidth,
      headings: [...document.querySelectorAll(".fri-mads-article-preview__card h3")].every((element) => element.scrollWidth <= element.clientWidth + 1),
      links: [...document.querySelectorAll(".fri-mads-article-preview__card a")].every((element) => element.scrollWidth <= element.clientWidth + 1)
    }));
    assert.ok(dimensions.document <= dimensions.viewport, `${width}px has no horizontal document overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.body <= dimensions.viewport, `${width}px has no horizontal body overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.pane <= dimensions.paneClient + 1, `${width}px profile pane has no horizontal overflow: ${JSON.stringify(dimensions)}`);
    assert.equal(dimensions.headings, true, `${width}px article titles wrap within their cards`);
    assert.equal(dimensions.links, true, `${width}px article links wrap within their cards`);
  }

  await page.setViewportSize({ width: 390, height: 600 });
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("href")), "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/",
    "the official series link remains keyboard reachable before article links");
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => ({
    href: document.activeElement?.getAttribute("href"), outline: getComputedStyle(document.activeElement).outlineStyle
  }));
  assert.match(focus.href || "", /^https:\/\/frihedsbrevet\.dk\/fri-mads-/u);
  assert.notEqual(focus.outline, "none", "article link keyboard focus remains visible");
  const pane = page.locator("[data-podcast-detail-content]");
  await pane.evaluate((element) => element.scrollTo(0, element.scrollHeight));
  assert.ok(await pane.evaluate((element) => element.scrollTop > 0), "the article list scrolls within the existing profile pane");
  const firstLink = page.locator(".fri-mads-article-preview__card a").first();
  assert.equal(await firstLink.getAttribute("target"), "_blank");
  const expectedUrl = await firstLink.getAttribute("href");
  const popupPromise = page.waitForEvent("popup");
  await firstLink.tap();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  assert.equal(popup.url(), expectedUrl, "touch activation opens the verified canonical article link");
  await context.close();

  for (const invalidMode of ["missing", "wrong-type", "invalid-json", "invalid-sidecar"]) {
    mode = invalidMode;
    const failClosedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const failClosedPage = await failClosedContext.newPage();
    await failClosedPage.goto(`${origin}/profile?mode=${invalidMode}`, { waitUntil: "domcontentloaded" });
    await failClosedPage.waitForTimeout(50);
    assert.equal(await failClosedPage.locator("[data-fri-mads-article-preview]:not([hidden])").count(), 0,
      `${invalidMode} source hides the article list`);
    assert.equal(await failClosedPage.locator('a[href="https://frihedsbrevet.dk/nyhedsbrev/fri-mads/"]').count(), 1,
      `${invalidMode} source preserves the official series link`);
    await failClosedContext.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

assert.equal(JSON.stringify({ sidecar, catalog, fixture }), before, "the UI preview performs no source, catalogue, or fixture mutation");
console.log("Fri Mads sidecar profile view, access lock, same-origin loading, fail-closed, identity and responsive browser checks passed.");
