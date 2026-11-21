import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const artifactDir = resolve(process.env.FRI_MADS_ARTIFACT_DIR || `${tmpdir()}/fri-mads-workspace-e2e`);
await mkdir(artifactDir, { recursive: true });

const mimeTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json"
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filename = resolve(root, relative);
    if (filename !== root && !filename.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    const body = await readFile(filename);
    response.writeHead(200, { "content-type": mimeTypes[extname(filename).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolveListen, reject) => server.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolveListen()));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const externalLinks = [];
const blockedWrites = [];
const errors = [];
const failedRequests = [];
const geometryResults = [];
const trackPageErrors = (targetPage) => {
  targetPage.on("pageerror", (error) => errors.push(error.message));
  targetPage.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      let source = "";
      try { const url = new URL(location.url); source = `${url.hostname}${url.pathname}`; } catch { source = "unknown source"; }
      errors.push(`${message.text()} (${source})`);
    }
  });
  targetPage.on("requestfailed", (request) => {
    try {
      const url = new URL(request.url());
      failedRequests.push(`${url.hostname}${url.pathname}: ${request.failure()?.errorText || "request failed"}`);
    } catch { failedRequests.push("request failed for an invalid URL"); }
  });
};

const supabaseStub = `window.supabase={createClient(){const result={data:[],error:null,count:0};let query;query=new Proxy({then(resolve,reject){return Promise.resolve(result).then(resolve,reject)},single(){return Promise.resolve({data:null,error:null})},maybeSingle(){return Promise.resolve({data:null,error:null})}},{get(target,key){if(key in target)return target[key];if(key==='then')return target.then;return()=>query}});const subscription={unsubscribe(){}};return{auth:{onAuthStateChange(){return{data:{subscription}}},getSession:async()=>({data:{session:null},error:null}),getUser:async()=>({data:{user:null},error:null}),signOut:async()=>({error:null})},from(){return query},rpc:async()=>({data:[],error:null}),channel(){return{on(){return this},subscribe(){return this}}},removeChannel(){}}}};`;
const transparentPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pzsAAAAASUVORK5CYII=", "base64");
async function installReadOnlyNetwork(context) {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (route.request().method() !== "GET" && route.request().method() !== "HEAD") {
      blockedWrites.push(`${route.request().method()} ${url.host}${url.pathname}`);
      return route.abort();
    }
    if (route.request().resourceType() === "image") {
      return route.fulfill({ status: 200, contentType: "image/png", body: transparentPng });
    }
    if (url.hostname === "cdn.jsdelivr.net" && url.pathname.includes("supabase-js")) {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: supabaseStub });
    }
    if (url.hostname.endsWith("supabase.co")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    if (url.hostname === "fonts.googleapis.com" && url.pathname === "/css2") {
      return route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: "" });
    }
    if (/\.(png|jpe?g|webp|ico)$/iu.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: "image/png", body: transparentPng });
    }
    if (url.hostname === "frihedsbrevet.dk" && /\/fri-mads-\d+-/u.test(url.pathname)) {
      externalLinks.push(url.href);
      return route.abort();
    }
    if (/\.(css|js|woff2?|ttf|svg)$/iu.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: /\.css$/iu.test(url.pathname) ? "text/css" : "text/javascript", body: "" });
    }
    return route.abort();
  });
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await installReadOnlyNetwork(context);
  const page = await context.newPage();
  trackPageErrors(page);
  context.on("page", trackPageErrors);
  await page.goto(`${origin}/?podcast=${encodeURIComponent("fri mads")}#forside`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#podcastDetailSheet:not(.is-hidden) [data-podcast-detail-content]"), { timeout: 30000 });

  const profileButton = page.locator("[data-podcast-episodes-open]");
  await profileButton.waitFor({ state: "visible" });
  assert.equal((await profileButton.innerText()).trim(), "Se episoder", "Fri Mads profile action matches the shared episode workspace");
  await context.route("**/data/fri-mads-articles.json", async (route) => {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
    await route.continue();
  });
  await profileButton.click();
  await page.locator("[data-podcast-episode-overview]").waitFor({ state: "visible" });
  const initialScroll = await page.evaluate(() => ({ windowY: window.scrollY, contentTop: document.querySelector("[data-podcast-detail-content]")?.scrollTop, tableTop: document.querySelector(".podcast-detail-sheet__episode-table-wrap")?.scrollTop }));
  assert.deepEqual(initialScroll, { windowY: 0, contentTop: 0, tableTop: 0 }, "workspace opens at the top before sidecar hydration");
  await page.locator("tr[data-fri-mads-release-id]").first().waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await page.locator("tr[data-fri-mads-release-id]").count(), 5);
  assert.deepEqual(await page.locator("tr[data-fri-mads-release-id] .podcast-detail-sheet__episode-source").evaluateAll((nodes) => nodes.map((node) => node.href)), [
    "https://frihedsbrevet.dk/fri-mads-172-alle-elsker-mette/",
    "https://frihedsbrevet.dk/fri-mads-171-et-humrkort-til-formanden-for-esbjerg-havn/",
    "https://frihedsbrevet.dk/fri-mads-170-ordet-p-gaden/",
    "https://frihedsbrevet.dk/fri-mads-169-byrdssekretr-godtfred-lunds-genkomst/",
    "https://frihedsbrevet.dk/fri-mads-168-dette-er-en-attribueringsvelse/"
  ], "all five exact official links remain attached to their release rows");
  assert.equal(await page.getByText("Betalt adgang · abonnement kan kræves").count(), 0);
  assert.equal(await page.locator("tr[data-fri-mads-release-id] [data-episode-overview-rating-id], tr[data-fri-mads-release-id] button, audio, video").count(), 0,
    "metadata-only releases expose no rating action or player");
  assert.equal(await page.locator("tr[data-fri-mads-release-id] [role=status]").count(), 10,
    "both rating columns explain that the missing episode identity prevents ratings");

  const assertFirstReleaseGeometry = async (targetPage, width) => {
    const geometry = await targetPage.locator("tr[data-fri-mads-release-id]").first().evaluate((row) => {
      const content = document.querySelector("[data-podcast-detail-content]");
      const wrap = row.closest(".podcast-detail-sheet__episode-table-wrap");
      const title = row.querySelector(".episode-title");
      const titleCell = row.querySelector('td[data-label="Episode"]');
      const dateCell = row.querySelector(".episode-publication-date-cell");
      const mobileDate = getComputedStyle(titleCell, "::before");
      const scroll = window.matchMedia("(max-width:768px)").matches ? content : wrap;
      const clip = scroll.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const dateRect = window.matchMedia("(max-width:768px)").matches ? titleCell.getBoundingClientRect() : dateCell.getBoundingClientRect();
      const stickyHeader = [...row.closest("table").querySelectorAll("thead th")].find((node) => getComputedStyle(node).position === "sticky");
      const headerBottom = stickyHeader?.getBoundingClientRect().bottom ?? 0;
      const titleHit = document.elementFromPoint(titleRect.left + Math.min(8, titleRect.width / 2), titleRect.top + Math.min(8, titleRect.height / 2));
      const visibleDateText = window.matchMedia("(max-width:768px)").matches ? mobileDate.content : dateCell.textContent.trim();
      const workspaceToolbar = row.closest("[data-podcast-episode-overview]").querySelector(".podcast-detail-sheet__episode-overview-toolbar");
      return {
        scrollTop: scroll.scrollTop,
        contentTop: content.scrollTop,
        tableWrapTop: wrap.scrollTop,
        windowScrollY: window.scrollY,
        rowTop: rowRect.top,
        rowBottom: rowRect.bottom,
        titleTop: titleRect.top,
        titleBottom: titleRect.bottom,
        dateTop: dateRect.top,
        dateBottom: dateRect.bottom,
        clipTop: clip.top + scroll.clientTop,
        clipBottom: clip.top + scroll.clientTop + scroll.clientHeight,
        headerBottom,
        toolbarBottom: workspaceToolbar.getBoundingClientRect().bottom,
        expectedTitle: title.textContent.trim(),
        visibleDateText,
        titleCovered: Boolean(titleHit?.closest("thead"))
      };
    });
    assert.equal(geometry.expectedTitle, "Fri Mads #172: Alle elsker Mette");
    const visibleDateText = width <= 768 ? JSON.parse(geometry.visibleDateText) : geometry.visibleDateText;
    assert.equal(visibleDateText, "8. november 2026");
    assert.equal(geometry.scrollTop, 0, `${width}px opens at the top of its actual scroll container`);
    assert.equal(geometry.contentTop, 0, `${width}px has no stale detail-pane scroll offset`);
    assert.equal(geometry.tableWrapTop, 0, `${width}px has no stale table scroll offset`);
    assert.equal(geometry.windowScrollY, 0, `${width}px does not start with an unintended page scroll`);
    assert.ok(geometry.titleTop >= geometry.clipTop - 1 && geometry.titleBottom <= geometry.clipBottom + 1,
      `${width}px full #172 title fits in the visible scrollport: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.dateTop >= geometry.clipTop - 1 && geometry.dateBottom <= geometry.clipBottom + 1,
      `${width}px #172 date fits in the visible scrollport: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.rowTop >= geometry.headerBottom - 1,
      `${width}px first row starts below the sticky table header: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.rowTop >= geometry.toolbarBottom - 1,
      `${width}px first row starts below the sticky workspace toolbar: ${JSON.stringify(geometry)}`);
    assert.equal(geometry.titleCovered, false, `${width}px title hit-testing does not land on the sticky header`);
    const overflow = await targetPage.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.ok(overflow.document <= overflow.viewport && overflow.body <= overflow.viewport, `${width}px has no horizontal overflow: ${JSON.stringify(overflow)}`);
    geometryResults.push({ podcast: "fri mads", width, ...geometry, overflow });
    await writeFile(`${artifactDir}/geometry-results.json`, `${JSON.stringify(geometryResults, null, 2)}\n`, "utf8");
  };

  for (const width of [320, 375, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await assertFirstReleaseGeometry(page, width);
    if (width === 390) await page.screenshot({ path: `${artifactDir}/fri-mads-mobile-390.png`, fullPage: false });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const search = page.locator("[data-episode-workspace-search]");
  await search.focus();
  await search.fill("172");
  await page.waitForFunction(() => document.querySelectorAll("tr[data-fri-mads-release-id]").length === 1);
  assert.match(await page.locator("tr[data-fri-mads-release-id]").innerText(), /Alle elsker Mette/u);
  assert.equal(await page.evaluate(() => document.activeElement?.matches("[data-episode-workspace-search]")), true, "focus remains on search after rerender");
  await search.fill("ingen udgivelse med dette navn");
  await page.getByText("Ingen udgivelser matcher din søgning.").waitFor({ state: "visible" });
  assert.equal(await page.locator("tr[data-fri-mads-release-id]").count(), 0);
  await search.fill("");
  await page.waitForFunction(() => document.querySelectorAll("tr[data-fri-mads-release-id]").length === 5);
  await assertFirstReleaseGeometry(page, 390);
  await page.locator("[data-podcast-episode-overview-back]").tap();
  await profileButton.waitFor({ state: "visible" });
  await profileButton.tap();
  await page.locator("tr[data-fri-mads-release-id]").first().waitFor({ state: "visible" });
  await assertFirstReleaseGeometry(page, 390);
  const mobileContent = page.locator("[data-podcast-detail-content]");
  await mobileContent.evaluate((node) => node.scrollTo({ top: node.scrollHeight, behavior: "auto" }));
  assert.ok(await mobileContent.evaluate((node) => node.scrollTop > 0), "mobile episode workspace can be scrolled by touch gesture");
  await mobileContent.evaluate((node) => node.scrollTo({ top: 0, behavior: "auto" }));
  const link = page.locator("tr[data-fri-mads-release-id] .podcast-detail-sheet__episode-source").first();
  await search.focus();
  for (let tab = 0; tab < 8 && !(await link.evaluate((node) => node === document.activeElement)); tab += 1) {
    await page.keyboard.press("Tab");
  }
  assert.equal(await link.evaluate((node) => node === document.activeElement), true, "keyboard navigation reaches the official link");
  const linkFocus = await link.evaluate((node) => ({ outlineStyle: getComputedStyle(node).outlineStyle, outlineWidth: getComputedStyle(node).outlineWidth }));
  assert.ok(linkFocus.outlineStyle !== "none" && Number.parseFloat(linkFocus.outlineWidth) > 0, `keyboard focus is visible on the official link: ${JSON.stringify(linkFocus)}`);
  const linkTarget = await link.getAttribute("href");
  const popupPromise = context.waitForEvent("page");
  await link.tap();
  const popup = await popupPromise;
  await popup.close();
  assert.deepEqual(externalLinks, [linkTarget], "external article navigation is observed and aborted before any article is fetched");
  await page.locator("[data-podcast-episode-overview-back]").focus();
  await page.keyboard.press("Enter");
  await profileButton.waitFor({ state: "visible" });

  const ordinaryPage = await context.newPage();
  ordinaryPage.on("pageerror", (error) => errors.push(error.message));
  await ordinaryPage.goto(`${origin}/?podcast=${encodeURIComponent("borgenudenfilter")}#forside`, { waitUntil: "domcontentloaded" });
  await ordinaryPage.waitForFunction(() => document.querySelector("#podcastDetailSheet:not(.is-hidden) [data-podcast-detail-content]"), { timeout: 30000 });
  const ordinaryEntry = ordinaryPage.locator("[data-podcast-episodes-open]");
  await ordinaryEntry.waitFor({ state: "visible" });
  assert.equal((await ordinaryEntry.innerText()).trim(), "Vurder episoder", "BorgenUdenFilter keeps its rating-oriented profile action");
  await ordinaryEntry.click();
  await ordinaryPage.locator("[data-podcast-episode-overview] thead th").first().waitFor({ state: "attached" });
  assert.equal(await ordinaryPage.locator("[data-podcast-episode-overview] thead th").count(), 4);
  for (const width of [320, 375, 390, 768]) {
    await ordinaryPage.setViewportSize({ width, height: 844 });
    const bounds = await ordinaryPage.evaluate(() => {
      const wrap = document.querySelector(".podcast-detail-sheet__episode-table-wrap");
      const row = document.querySelector("[data-podcast-episode-overview] tbody tr:not(.podcast-detail-sheet__episode-table-state-row)");
      return { viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, tableHeaderBottom: document.querySelector("[data-podcast-episode-overview] thead")?.getBoundingClientRect().bottom ?? null, firstRowTop: row?.getBoundingClientRect().top ?? null, wrapTop: wrap?.scrollTop ?? null };
    });
    assert.ok(bounds.body <= bounds.viewport, `BorgenUdenFilter remains overflow-free at ${width}px`);
    geometryResults.push({ podcast: "borgenudenfilter", width, ...bounds });
    await writeFile(`${artifactDir}/geometry-results.json`, `${JSON.stringify(geometryResults, null, 2)}\n`, "utf8");
    if (width === 390) await ordinaryPage.screenshot({ path: `${artifactDir}/borgenudenfilter-mobile-390.png`, fullPage: false });
  }
  assert.deepEqual(errors, [], `actual app routing produced no browser errors: ${JSON.stringify({ errors, failedRequests })}`);
  assert.deepEqual(blockedWrites, [], "the browser test never issued a write request to Supabase or any external service");
  await context.close();

  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await installReadOnlyNetwork(desktopContext);
  const desktopPage = await desktopContext.newPage();
  trackPageErrors(desktopPage);
  desktopContext.on("page", trackPageErrors);
  await desktopPage.goto(`${origin}/?podcast=${encodeURIComponent("fri mads")}#forside`, { waitUntil: "domcontentloaded" });
  await desktopPage.waitForFunction(() => document.querySelector("#podcastDetailSheet:not(.is-hidden) [data-podcast-detail-content]"), { timeout: 30000 });
  await desktopPage.locator("[data-podcast-episodes-open]").click();
  await desktopPage.locator("tr[data-fri-mads-release-id]").first().waitFor({ state: "visible" });
  for (const width of [1280, 1440]) {
    await desktopPage.setViewportSize({ width, height: 1000 });
    await assertFirstReleaseGeometry(desktopPage, width);
    if (width === 1440) await desktopPage.screenshot({ path: `${artifactDir}/fri-mads-desktop-1440.png`, fullPage: false });
  }
  const borgenDesktop = await desktopContext.newPage();
  trackPageErrors(borgenDesktop);
  await borgenDesktop.goto(`${origin}/?podcast=${encodeURIComponent("borgenudenfilter")}#forside`, { waitUntil: "domcontentloaded" });
  await borgenDesktop.waitForFunction(() => document.querySelector("#podcastDetailSheet:not(.is-hidden) [data-podcast-detail-content]"), { timeout: 30000 });
  assert.equal((await borgenDesktop.locator("[data-podcast-episodes-open]").innerText()).trim(), "Vurder episoder");
  await borgenDesktop.locator("[data-podcast-episodes-open]").click();
  await borgenDesktop.locator("[data-podcast-episode-overview] thead th").first().waitFor({ state: "attached" });
  assert.equal(await borgenDesktop.locator("[data-podcast-episode-overview] thead th").count(), 4,
    "desktop BorgenUdenFilter remains on the shared four-column workspace");
  await borgenDesktop.setViewportSize({ width: 1440, height: 1000 });
  const borgenBounds = await borgenDesktop.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth }));
  assert.ok(borgenBounds.body <= borgenBounds.viewport, "desktop BorgenUdenFilter has no horizontal overflow");
  const borgenGeometry = await borgenDesktop.evaluate(() => ({
    headerBottom: document.querySelector("[data-podcast-episode-overview] thead")?.getBoundingClientRect().bottom ?? null,
    firstRowTop: document.querySelector("[data-podcast-episode-overview] tbody tr:not(.podcast-detail-sheet__episode-table-state-row)")?.getBoundingClientRect().top ?? null,
    toolbarBottom: document.querySelector(".podcast-detail-sheet__episode-overview-toolbar")?.getBoundingClientRect().bottom ?? null,
    windowScrollY: window.scrollY
  }));
  geometryResults.push({ podcast: "borgenudenfilter", width: 1440, ...borgenBounds, ...borgenGeometry });
  await writeFile(`${artifactDir}/geometry-results.json`, `${JSON.stringify(geometryResults, null, 2)}\n`, "utf8");
  await borgenDesktop.screenshot({ path: `${artifactDir}/borgenudenfilter-desktop-1440.png`, fullPage: false });
  assert.deepEqual(errors, [], `actual app routing produced no browser errors: ${JSON.stringify({ errors, failedRequests })}`);
  assert.deepEqual(blockedWrites, [], "the browser test never issued a write request to Supabase or any external service");
  await desktopContext.close();
} finally {
  await browser.close();
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}

console.log(`Fri Mads full-app routing and first-row geometry passed at six widths; screenshots: ${fileURLToPath(pathToFileURL(artifactDir))}`);
