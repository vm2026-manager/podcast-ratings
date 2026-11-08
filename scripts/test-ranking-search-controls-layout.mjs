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

  const layoutAt = async (width) => {
    await page.setViewportSize({ width, height: 844 });
    return page.evaluate(() => {
      const strip = document.querySelector(".ranking-search-strip");
      const search = strip.querySelector(".search-field");
      const filterBar = strip.querySelector(".ranking-mobile-filter-bar");
      const filter = strip.querySelector("#rankingMobileFilterToggle");
      const popular = strip.querySelector("#popularNowToggle");
      const rect = (element) => element.getBoundingClientRect();
      return {
        viewportWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        strip: rect(strip), search: rect(search), filterBar: rect(filterBar), filter: rect(filter), popular: rect(popular),
        filterDisplay: getComputedStyle(filterBar).display,
        popularPressed: popular.getAttribute("aria-pressed")
      };
    });
  };

  for (const width of [320, 375, 390, 768]) {
    const layout = await layoutAt(width);
    assert.equal(layout.scrollWidth, layout.viewportWidth, `no horizontal overflow at ${width}px`);
    assert.ok(Math.abs(layout.search.width - layout.strip.width) < 1, `search field keeps full strip width at ${width}px`);
    assert.notEqual(layout.filterDisplay, "none", `filter button is visible at ${width}px`);
    assert.ok(Math.abs(layout.filter.top - layout.popular.top) < 1, `filter and popular buttons share a row at ${width}px`);
    assert.ok(layout.filter.left < layout.popular.left, `filters stay left of popular at ${width}px`);

    const toggle = page.locator("#rankingMobileFilterToggle");
    await toggle.focus();
    await page.keyboard.press("Enter");
    assert.equal(await toggle.getAttribute("aria-expanded"), "true", `keyboard opens filters at ${width}px`);
    await toggle.tap();
    assert.equal(await toggle.getAttribute("aria-expanded"), "false", `touch closes filters at ${width}px`);

    const popular = page.locator("#popularNowToggle");
    await popular.focus();
    await page.keyboard.press("Enter");
    assert.equal(await popular.getAttribute("aria-pressed"), "true", `keyboard activates popular mode at ${width}px`);
    await popular.tap();
    assert.equal(await popular.getAttribute("aria-pressed"), "false", `touch deactivates popular mode at ${width}px`);
  }

  for (const width of [900, 1280, 1440]) {
    const layout = await layoutAt(width);
    assert.equal(layout.scrollWidth, layout.viewportWidth, `no horizontal overflow at ${width}px`);
    if (width >= 1280) {
      assert.equal(layout.filterDisplay, "none", `mobile filter control stays hidden on desktop at ${width}px`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.classList.add("force-desktop-view"); document.body.classList.add("force-desktop-view"); });
  const forced = await layoutAt(390);
  assert.equal(forced.scrollWidth, forced.viewportWidth, "force-desktop-view has no horizontal overflow at mobile viewport width");
  assert.deepEqual(errors, [], "control interactions produce no uncaught browser errors");
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log("Ranking search controls layout regression passed at 320, 375, 390, 768, 900, 1280, 1440 and force-desktop-view.");
