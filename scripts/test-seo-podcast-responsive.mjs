import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseline = JSON.parse(await readFile(path.join(root, "scripts/seo-podcast-safety-baseline.json"), "utf8"));
const widths = [320, 375, 390, 768, 1440];
const mimeTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".xml": "application/xml"
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let file = path.resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) throw new Error("Path escaped repository root");
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    response.setHeader("content-type", mimeTypes[path.extname(file)] || "application/octet-stream");
    response.end(await readFile(file));
  } catch {
    response.statusCode = 404;
    response.end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true });
const origin = `http://127.0.0.1:${server.address().port}`;

try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
    const home = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      nav: [...document.querySelectorAll(".site-nav__link")]
        .filter((link) => getComputedStyle(link).display !== "none" && link.getBoundingClientRect().width > 0)
        .map((link) => link.textContent.trim())
    }));
    assert(home.documentWidth <= width + 1 && home.bodyWidth <= width + 1, `homepage overflows at ${width}px: ${JSON.stringify(home)}`);
    assert(["Forside", "Ranglister", "Udforsk"].every((label) => home.nav.includes(label)), `homepage navigation missing at ${width}px`);

    let navFocused = false;
    for (let index = 0; index < 18 && !navFocused; index += 1) {
      await page.keyboard.press("Tab");
      navFocused = await page.evaluate(() => document.activeElement?.matches(".site-nav__link:focus-visible") || false);
    }
    assert(navFocused, `keyboard focus does not reach main navigation at ${width}px`);

    if (width === 1440) {
      await page.locator('.site-nav__link[href="#ranglister"]').first().click();
      const desktopPilotLink = page.locator('a.desktop-ranking-title-link[href="/podcast/kapret/"]');
      await desktopPilotLink.waitFor({ state: "visible" });
      assert.equal(await desktopPilotLink.textContent().then((text) => text.trim()), "Kapret");
    }

    const pagesToCheck = width === 320 ? baseline.podcasts : [baseline.podcasts[0]];
    for (const podcast of pagesToCheck) {
      const response = await page.goto(`${origin}/podcast/${podcast.slug}/`, { waitUntil: "domcontentloaded" });
      assert.equal(response.status(), 200, `${podcast.id} should return HTTP 200 at ${width}px`);
      const layout = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        canonical: document.querySelector('link[rel="canonical"]')?.href,
        heading: document.querySelector("h1")?.textContent.trim()
      }));
      assert(layout.documentWidth <= width + 1 && layout.bodyWidth <= width + 1, `${podcast.id} overflows at ${width}px: ${JSON.stringify(layout)}`);
      assert.equal(layout.canonical, `https://podcastlisten.dk/podcast/${podcast.slug}/`);
      assert(layout.heading, `${podcast.id} has a visible heading`);
      if (width === 320 && podcast === baseline.podcasts[0]) {
        await page.keyboard.press("Tab");
        const focused = await page.evaluate(() => document.activeElement?.matches("a:focus-visible") || false);
        assert(focused, "SEO page links retain visible keyboard focus");
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log(`SEO responsive checks passed: ${baseline.podcasts.length} pages at 320px, representative pages at 375/390/tablet/1440px, navigation, focus and overflow.`);
