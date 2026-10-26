import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const readRepoFile = (name) => readFile(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");
const [desktopCss, movementCss, indexHtml, appJs] = await Promise.all([
  readRepoFile("desktop-home-mockup.css"),
  readRepoFile("ranking-movement.css"),
  readRepoFile("index.html"),
  readRepoFile("app.js")
]);

const standardColumns = "80px minmax(220px, 2.02fr) minmax(105px, 0.95fr) minmax(226px, 1.08fr) minmax(110px, 0.8fr) 82px";
const compactColumns = "80px minmax(190px, 2fr) minmax(90px, 0.82fr) minmax(226px, 1.08fr) minmax(100px, 0.76fr) 74px";
assert.equal(desktopCss.split(`grid-template-columns: ${standardColumns} !important;`).length - 1, 1,
  "standard desktop table header and rows retain their 80px rank track and other columns");
assert.equal(desktopCss.split(`grid-template-columns: ${compactColumns} !important;`).length - 1, 1,
  "compact desktop table header and rows retain their 80px rank track and other columns");
assert.doesNotMatch(desktopCss, /grid-template-columns:\s*94px minmax\(220px, 2\.02fr\)/);
assert.doesNotMatch(desktopCss, /grid-template-columns:\s*94px minmax\(190px, 2fr\)/);

const desktopRule = movementCss.match(/@media\s*\(min-width:\s*1101px\)\s*\{([\s\S]*?)\n\}/)?.[1] || "";
const rankCellRule = desktopRule.match(/\.desktop-ranking-row__rank:has\(\.ranking-movement\),[\s\S]*?\{([^}]*)\}/)?.[1] || "";
assert.match(rankCellRule, /display:\s*grid\s*!important;/,
  "desktop grid uses matching specificity and !important to override inline-flex");
assert.match(rankCellRule, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+26px\s*!important;/);
assert.match(rankCellRule, /column-gap:\s*2px\s*!important;/);
assert.match(rankCellRule, /padding-right:\s*4px\s*!important;/);
assert.doesNotMatch(desktopRule, /flex-wrap|2rem|::after/,
  "desktop rank layout uses no flex wrapping or artificial pseudo-element slot");
assert.match(desktopRule, /desktop-ranking-row__number[\s\S]*?text-align:\s*right/);
assert.match(desktopRule, /desktop-ranking-row__number[\s\S]*?justify-self:\s*end/);
assert.match(desktopRule, /desktop-ranking-row__number[\s\S]*?white-space:\s*nowrap\s*!important/);
assert.match(desktopRule, /desktop-ranking-row__rank--wide-number/);
assert.match(desktopRule, /ranking-movement[\s\S]*?overflow-wrap:\s*anywhere/);
assert.match(movementCss, /\.ranking-movement\s*\{[^}]*color:\s*#187342;/);
assert.match(movementCss, /\.ranking-movement--steady\s*\{[^}]*color:\s*#74685e;/);
assert.match(movementCss, /\.ranking-movement--down\s*\{[^}]*color:\s*#b4232d;/);
assert.match(appJs, /if\s*\(delta\s*===\s*0\)[\s\S]*?ranking-movement--steady/);
assert.match(appJs, /gain\s*\?\s*"ranking-movement--up"\s*:\s*"ranking-movement--down"/);
assert.match(appJs, /desktop-ranking-row__number[\s\S]{0,260}getRankingMovementMarkup\(podcast\)/,
  "desktop row keeps the separate number span and existing movement markup together");
assert.match(appJs, /rankDigits\s*>=\s*4/,
  "four-digit ranks receive controlled full-width number layout");
assert.match(indexHtml, /ranking-movement\.css\?v=20261026-mobile-movement-badge-v1/);
assert.match(desktopCss, /\.desktop-ranking-row__podcast\s*\{[^}]*grid-template-columns:\s*58px minmax\(0, 1fr\)/);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const liveArg = process.argv.indexOf("--live");
  if (liveArg >= 0) {
    const url = process.argv[liveArg + 1] || "https://podcastlisten.dk/#ranglister";
    await verifyLive(page, url);
  } else {
    await verifyMock(page, desktopCss, movementCss);
  }
} finally {
  await browser.close();
}

async function verifyMock(page, desktop, movement) {
  await page.setContent(`<!doctype html><html><head><style>
    * { box-sizing: border-box; }
    body { margin: 0; font: 900 21.12px/1 Manrope, Arial, sans-serif; }
    .desktop-ranking-table { width: 100%; }
    .desktop-ranking-row { display:grid; grid-template-columns:80px minmax(220px, 2.02fr) minmax(105px, .95fr) minmax(226px, 1.08fr) minmax(110px, .8fr) 82px; width:100%; height:72px; }
    .desktop-ranking-row__rank { width:80px; padding: 20px 4px 0 0; }
    .desktop-ranking-row__podcast { display:grid; grid-template-columns:58px minmax(0,1fr); gap:14px; padding-top:7px; }
    .desktop-ranking-row__cover { width:58px; height:58px; background:#ddd; }
  </style></head><body class="page-ranglister"><main class="desktop-ranking-table"></main></body></html>`);
  await page.addStyleTag({ content: desktop });
  await page.addStyleTag({ content: movement });
  const samples = [
    { rank: 7, marker: "" }, { rank: 9, marker: "—", kind: "steady" }, { rank: 10, marker: "▲18", kind: "up" },
    { rank: 11, marker: "▼11", kind: "down" }, { rank: 12, marker: "—", kind: "steady" },
    { rank: 13, marker: "", kind: "" }, { rank: 14, marker: "▲18", kind: "up" },
    { rank: 99, marker: "▼11", kind: "down" }, { rank: 173, marker: "▲18", kind: "up" },
    { rank: 1000, marker: "▼11", kind: "down" }
  ];
  for (const width of [1101, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator(".desktop-ranking-table").evaluate((root, cases) => {
      root.replaceChildren(...cases.map(({ rank, marker, kind }) => {
        const row = document.createElement("article");
        row.className = "desktop-ranking-row";
        const rankCell = document.createElement("span");
        rankCell.className = `desktop-ranking-row__rank${String(rank).length >= 4 ? " desktop-ranking-row__rank--wide-number" : ""}`;
        rankCell.setAttribute("role", "cell");
        const number = document.createElement("span");
        number.className = "desktop-ranking-row__number";
        number.textContent = `#${rank}`;
        rankCell.append(number);
        if (marker) {
          const indicator = document.createElement("span");
          indicator.className = `ranking-movement${kind === "down" ? " ranking-movement--down" : kind === "steady" ? " ranking-movement--steady" : ""}`;
          indicator.textContent = marker;
          indicator.setAttribute("aria-label", `Ranking ${marker}`);
          rankCell.append(indicator);
        }
        const podcast = document.createElement("div");
        podcast.className = "desktop-ranking-row__podcast";
        const cover = document.createElement("button");
        cover.className = "desktop-ranking-row__cover";
        podcast.append(cover);
        row.append(rankCell, podcast);
        return row;
      }));
    }, samples);
    const measurements = await measureRows(page);
    assert.ok(measurements.every((row) => row.number && row.cover), "each mock row has a measurable number and cover");
    const targets = measurements.filter((row) => [10, 11, 12, 13, 14].includes(row.rank));
    const rightEdges = targets.map((row) => row.number.right);
    assert.ok(Math.max(...rightEdges) - Math.min(...rightEdges) <= 2,
      `#10–#14 visible digit right edges align within 2px at ${width}px: ${rightEdges.join(", ")}`);
    for (const row of measurements) {
      assert.ok(row.number.right <= row.cover.left, `#${row.rank} number must not overlap its cover at ${width}px`);
      assert.ok(!row.markerRect || row.markerRect.right <= row.cover.left,
        `#${row.rank} movement marker must not overlap its cover at ${width}px`);
      assert.equal(row.digitLines, 1, `#${row.rank} digits must remain on one line at ${width}px`);
      assert.ok(row.row.right <= width, `#${row.rank} row must not create horizontal viewport overflow at ${width}px`);
      if (row.rank === 1000 && row.markerRect) {
        assert.ok(row.markerRect.top >= row.number.bottom - 1, "the #1000 movement may wrap under its unbroken number");
      }
    }
  }
  console.log("Desktop rank grid Playwright/Chromium geometry regression passed for mock rows at 1101, 1280 and 1440px.");
}

async function measureRows(page) {
  return page.locator(".desktop-ranking-row").evaluateAll((rows) => rows.map((row) => {
    const number = row.querySelector(".desktop-ranking-row__number");
    const marker = row.querySelector(".ranking-movement");
    const cover = row.querySelector(".desktop-ranking-row__cover");
    const rect = (element) => element ? element.getBoundingClientRect().toJSON() : null;
    const range = document.createRange();
    range.selectNodeContents(number);
    const digitRects = [...range.getClientRects()];
    return {
      rank: Number(number.textContent.replace(/\D/g, "")),
      number: rect(number), markerRect: rect(marker), cover: rect(cover),
      row: rect(row), digitLines: digitRects.length
    };
  }));
}

async function verifyLive(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".desktop-ranking-row__number", { timeout: 60000 });
  await page.waitForFunction(() => {
    const ranks = [...document.querySelectorAll(".desktop-ranking-row__number")].map((element) => element.textContent.trim());
    return ["#10", "#11", "#12", "#13", "#14"].every((rank) => ranks.includes(rank));
  }, { timeout: 60000 });
  for (const width of [1101, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const measurements = (await measureRows(page)).filter((row) => [10, 11, 12, 13, 14].includes(row.rank));
    assert.equal(measurements.length, 5, `live DOM includes #10–#14 at ${width}px`);
    assert.ok(measurements.every((row) => row.digitLines === 1 && row.number.right <= row.cover.left),
      `live #10–#14 numbers are unbroken and do not overlap covers at ${width}px`);
    assert.ok(measurements.every((row) => !row.markerRect || row.markerRect.right <= row.cover.left),
      `live #10–#14 movement markers do not overlap covers at ${width}px`);
    const edges = measurements.map((row) => row.number.right);
    assert.ok(Math.max(...edges) - Math.min(...edges) <= 2,
      `live #10–#14 visible right edges align within 2px at ${width}px: ${edges.join(", ")}`);
    console.log(`LIVE ${width}px #10–#14 number right edges: ${edges.map((edge) => edge.toFixed(2)).join(", " )}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator(".desktop-ranking-row__number", { hasText: /^#10$/ }).scrollIntoViewIfNeeded();
  const screenshotRows = await page.locator(".desktop-ranking-row").evaluateAll((rows) => rows
    .filter((row) => {
      const rankText = row.querySelector(".desktop-ranking-row__number")?.textContent || "";
      return [10, 11, 12, 13, 14].includes(Number(rankText.replace(/\D/g, "")));
    })
    .map((row) => row.getBoundingClientRect().toJSON()));
  const clipTop = Math.max(0, Math.min(...screenshotRows.map((rect) => rect.top)));
  const clipBottom = Math.min(1000, Math.max(...screenshotRows.map((rect) => rect.bottom)));
  assert.ok(clipBottom > clipTop, "live screenshot clip contains dynamic rows #10–#14");
  const screenshotPath = process.argv.includes("--screenshot")
    ? process.argv[process.argv.indexOf("--screenshot") + 1]
    : `${process.env.TEMP || process.env.TMP || "."}/podcastlisten-live-ranking-grid.png`;
  await page.screenshot({ path: screenshotPath, clip: { x: 0, y: clipTop, width: 1440, height: clipBottom - clipTop } });
  console.log(`LIVE ranking screenshot: ${screenshotPath}`);
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const mobile = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      cards: document.querySelectorAll(".podcast-card__placement").length,
      desktopRows: [...document.querySelectorAll(".desktop-ranking-row")].filter((row) => getComputedStyle(row).display !== "none").length
    }));
    assert.ok(mobile.cards > 0, `mobile ranking badges render at ${width}px`);
    assert.equal(mobile.desktopRows, 0, `desktop ranking rows remain hidden at ${width}px`);
    assert.ok(mobile.scroll <= mobile.viewport + 1, `mobile page has no horizontal overflow at ${width}px`);
    console.log(`LIVE mobile ${width}px viewport/scroll: ${mobile.viewport}/${mobile.scroll}`);
  }
  console.log(`Live desktop and mobile ranking geometry passed for ${url}`);
}
