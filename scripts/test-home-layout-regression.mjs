import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedGenres = ["True Crime", "Historie", "Krig", "Politik", "Finans", "Samfund", "Sport", "Dokumentar", "Viden", "Underholdning"];
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
  for (const width of [320, 375, 390, 430, 1101, 1280, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`http://127.0.0.1:${server.address().port}/#forside`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelectorAll("#pageIntroPanel .home-genres__grid .home-genres-card").length === 10);
    const layout = await page.evaluate(() => {
      const root = document.querySelector("#pageIntroPanel");
      const genres = root.querySelector(".home-genres");
      const grid = genres.querySelector(".home-genres__grid");
      const rect = (element) => {
        const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
        return { left, right, top, bottom, width, height };
      };
      const cards = [...grid.querySelectorAll(".home-genres-card")];
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
        panel: rect(root),
        genres: rect(genres),
        genreOverflowY: getComputedStyle(genres).overflowY,
        grid: rect(grid),
        gridScrollHeight: grid.scrollHeight,
        quick: quick.map((element) => ({ label: element.innerText.trim(), ...rect(element), clippedBy: clipping(element) })),
        cards: cards.map((element) => ({ label: element.querySelector(".home-genres-card__genre")?.textContent.trim(), labelWidth: element.querySelector(".home-genres-card__genre")?.clientWidth, labelScrollWidth: element.querySelector(".home-genres-card__genre")?.scrollWidth, genre: element.dataset.genre, ...rect(element), clippedBy: clipping(element) }))
      };
    });
    assert.ok(layout.pageWidth <= width, `Home page has horizontal overflow at ${width}px: ${JSON.stringify(layout)}`);
    assert.deepEqual(layout.cards.map((card) => card.label), expectedGenres, `Home genre labels at ${width}px`);
    assert.ok(layout.cards.every((card) => card.width > 0 && card.height > 0 && card.clippedBy.length === 0), `A genre card is clipped at ${width}px: ${JSON.stringify(layout.cards)}`);
    assert.ok(layout.cards.every((card) => card.right <= width + 1), `A genre card extends outside the viewport at ${width}px`);
    assert.ok(layout.cards.every((card) => card.labelWidth > 0 && card.labelScrollWidth <= card.labelWidth + 1), `A genre label is clipped at ${width}px: ${JSON.stringify(layout.cards.filter((card) => card.labelScrollWidth > card.labelWidth + 1))}`);
    assert.ok(layout.quick.length === 2 && layout.quick.every((card) => card.width > 0 && card.height > 0 && card.clippedBy.length === 0), `Quick cards are clipped or missing at ${width}px`);
    assert.ok(Math.abs(layout.quick[0].top - layout.quick[1].top) <= 1 && Math.abs(layout.quick[0].bottom - layout.quick[1].bottom) <= 1, `Top podcasts and Mine gemte are misaligned at ${width}px`);
    if (width >= 1101) {
      assert.ok(Math.abs(layout.genres.top - layout.quick[0].top) <= 1, `Top i genrer is not aligned with the quick cards at ${width}px`);
      assert.ok(Math.abs(layout.genres.left - layout.quick[1].right - 14) <= 1, `The cards do not have a consistent gap at ${width}px`);
      assert.equal(layout.genreOverflowY, "visible", `The desktop genre panel clips vertically at ${width}px`);
      assert.ok(layout.gridScrollHeight <= layout.grid.height + 1, `The desktop genre grid has clipped rows at ${width}px`);
    }
    for (let index = 0; index < layout.cards.length; index += 1) {
      for (let other = index + 1; other < layout.cards.length; other += 1) {
        const left = layout.cards[index];
        const right = layout.cards[other];
        assert.ok(left.bottom <= right.top || right.bottom <= left.top || left.right <= right.left || right.right <= left.left, `Home genre cards overlap at ${width}px`);
      }
    }
    console.log(`${width}px: ${layout.cards.length} visible genres in ${layout.columns} columns`);
  }

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`http://127.0.0.1:${server.address().port}/#forside`, { waitUntil: "domcontentloaded" });
  const financeCard = page.locator('#pageIntroPanel .home-genres-card[data-genre="Finans"]');
  await financeCard.waitFor({ state: "visible" });
  assert.equal(await financeCard.getAttribute("role"), "link");
  assert.equal(await financeCard.getAttribute("tabindex"), "0", "Genre card is keyboard focusable");
  await page.locator('#pageIntroPanel .home-genres-card[data-genre="Krig"]').click();
  await page.waitForFunction(() => state.activeFilter?.type === "genre" && state.activeFilter.value === "Krig");
  await page.goto(`http://127.0.0.1:${server.address().port}/#forside`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("#pageIntroPanel .home-genres-card").length === 10);
  const keyboardFinanceCard = page.locator('#pageIntroPanel .home-genres-card[data-genre="Finans"]');
  assert.equal(await keyboardFinanceCard.getAttribute("role"), "link");
  assert.equal(await keyboardFinanceCard.getAttribute("tabindex"), "0", "Genre card is keyboard focusable");
  await keyboardFinanceCard.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => state.activeFilter?.type === "genre" && state.activeFilter.value === "Finans");
  console.log("Home layout regression checks passed.");
} finally {
  await browser.close();
  server.close();
}
