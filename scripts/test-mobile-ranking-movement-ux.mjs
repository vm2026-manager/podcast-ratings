import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const readRepoFile = (name) => readFile(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");
const [app, movementCss, mobileCss, styleCss, desktopCss] = await Promise.all([
  readRepoFile("app.js"),
  readRepoFile("ranking-movement.css"),
  readRepoFile("mobile-home-ranking-polish.css"),
  readRepoFile("style.css"),
  readRepoFile("desktop-home-mockup.css")
]);

function contrastRatio(foreground, background) {
  const luminance = (color) => {
    const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const buttonOffsetRule = styleCss.match(/html body\.page-ranglister \.ranking-scroll-bottom-button:not\(\.ranking-scroll-bottom-button--top\)\s*\{([^}]*)\}/)?.[1] || "";
assert.match(buttonOffsetRule, /bottom:\s*calc\(var\(--mobile-nav-height\)\s*\+\s*5px\)/,
  "bottom shortcut offset uses the nav height, which already includes the safe area, plus a 5px gap");
assert.doesNotMatch(buttonOffsetRule, /safe-area-inset-bottom/,
  "safe area is not added a second time to the bottom shortcut offset");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  let depth = 0;
  for (let index = start; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const state = {
  rankingMovementByKey: new Map([["up", 1], ["down", -2], ["steady", 0]]),
  rankingMovementPeriodLabel: "siden 20. oktober",
  rankingMovementSnapshotValid: true
};
const getMarkup = new Function(
  "state", "isRankingMovementEligible", "getRankingMovementKey", "getRankingMovementId", "escapeHtml",
  `${extractFunction("getRankingMovementMarkup")}; return getRankingMovementMarkup;`
)(state, () => true, (podcast) => podcast.key, (podcast) => `ranking-movement-${podcast.key}`, (value) => String(value));

for (const [key, text, klass, aria] of [
  ["up", "▲ 1", "ranking-movement--up", "Steget 1 placering siden 20. oktober"],
  ["down", "▼ 2", "ranking-movement--down", "Faldet 2 placeringer siden 20. oktober"],
  ["steady", "–", "ranking-movement--steady", "Uændret placering siden 20. oktober"]
]) {
  const markup = getMarkup({ key });
  assert.match(markup, new RegExp(`class="[^"]*${klass}`));
  assert.match(markup, new RegExp(`aria-label="${aria}"`));
  assert.match(markup, new RegExp(`>${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</span>`));
}
assert.equal(getMarkup({ key: "no-movement-data" }), "", "podcasts without movement data do not gain a marker");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>
    * { box-sizing: border-box; }
    :root { --mobile-nav-height: 76px; --accent: #ff751e; --accent-deep: #ff4f12; }
    body { margin: 0; min-height: 2400px; font: 800 14px/1.2 Manrope, Arial, sans-serif; }
    .site-nav { position: fixed; z-index: 100; inset: auto 0 0; height: var(--mobile-nav-height); background: #fff; }
    .ranking-list-panel { width: 100%; }
    .podcast-card { position: relative; display: grid; grid-template-columns: 60px 78px minmax(0,1fr) 30px; column-gap: 6px; width: calc(100vw - 24px); height: 92px; margin: 12px; padding: 6px; border: 1px solid #ddd; }
    .podcast-card__media { grid-column: 2; width: 78px; height: 78px; background: #49627a; }
    .podcast-card__placement { position: absolute; top: 18px; left: 18px; }
    .podcast-card--review { border-color: #d77; }
  </style></head><body class="page-ranglister">
    <main class="ranking-list-panel">
      <article class="podcast-card" data-kind="up"><div class="podcast-card__placement"><span class="placement-value placement-value--with-movement">#11</span><span class="ranking-movement ranking-movement--up" aria-label="Steget 1 placering siden 20. oktober" title="Steget 1 placering siden 20. oktober">▲ 1</span><span class="placement-label">placering</span></div><div class="podcast-card__media"></div></article>
      <article class="podcast-card" data-kind="down"><div class="podcast-card__placement"><span class="placement-value placement-value--with-movement">#12</span><span class="ranking-movement ranking-movement--down" aria-label="Faldet 2 placeringer siden 20. oktober" title="Faldet 2 placeringer siden 20. oktober">▼ 2</span><span class="placement-label">placering</span></div><div class="podcast-card__media"></div></article>
      <article class="podcast-card" data-kind="steady"><div class="podcast-card__placement"><span class="placement-value placement-value--with-movement">#13</span><span class="ranking-movement ranking-movement--steady" aria-label="Uændret placering siden 20. oktober" title="Uændret placering siden 20. oktober">–</span><span class="placement-label">placering</span></div><div class="podcast-card__media"></div></article>
      <article class="podcast-card" data-kind="long"><div class="podcast-card__placement"><span class="placement-value placement-value--with-movement">#1300</span><span class="ranking-movement ranking-movement--down" aria-label="Faldet 2 placeringer siden 20. oktober">▼ 2</span><span class="placement-label">placering</span></div><div class="podcast-card__media"></div></article>
      <article class="podcast-card podcast-card--review" data-kind="review"><div class="podcast-card__placement"><span class="placement-value placement-value--with-movement">#1000</span><span class="ranking-movement ranking-movement--up" aria-label="Steget 1 placering siden 20. oktober">▲ 1</span><span class="placement-label">placering</span></div><div class="podcast-card__media"></div></article>
      <article class="podcast-card" data-kind="none"><div class="podcast-card__placement"><span class="placement-value">#1001</span><span class="placement-label">placering</span></div><div class="podcast-card__media"></div></article>
      <article class="podcast-card" data-kind="unranked"><div class="podcast-card__placement podcast-card__placement--unranked"><span class="placement-value">#---</span><span class="placement-label">placering</span></div><div class="podcast-card__media"></div></article>
    </main>
    <button class="ranking-scroll-bottom-button is-visible" aria-label="Gå til bunden"><span class="ranking-scroll-bottom-button__copy"><strong>Gå til bunden</strong></span></button>
    <button class="ranking-scroll-bottom-button ranking-scroll-bottom-button--top is-visible" aria-label="Gå til toppen"><span class="ranking-scroll-bottom-button__copy"><strong>Gå til toppen</strong></span></button>
    <nav class="site-nav"></nav>
  </body></html>`);
  await page.addStyleTag({ content: styleCss });
  await page.addStyleTag({ content: mobileCss });
  await page.addStyleTag({ content: desktopCss });
  await page.addStyleTag({ content: movementCss });

  const results = [];
  for (const width of [320, 375, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const measured = await page.locator(".podcast-card").evaluateAll((cards) => cards.map((card) => {
      const wrapper = card.querySelector(".podcast-card__placement");
      const badge = card.querySelector(".placement-value");
      const movement = card.querySelector(".ranking-movement");
      const cover = card.querySelector(".podcast-card__media");
      const rect = (element) => element ? element.getBoundingClientRect().toJSON() : null;
      const style = (element) => element ? getComputedStyle(element) : null;
      return {
        kind: card.dataset.kind,
        rank: badge.textContent,
        wrapper: rect(wrapper), badge: rect(badge), movement: rect(movement), cover: rect(cover),
        wrapperBg: style(wrapper)?.backgroundColor,
        badgeBg: style(badge)?.backgroundImage,
        badgeColor: style(badge)?.color,
        movementColor: style(movement)?.color,
        movementBg: style(movement)?.backgroundColor,
        fontSize: style(movement)?.fontSize,
        aria: movement?.getAttribute("aria-label") || null
      };
    }));
    for (const row of measured) {
      assert.ok(row.wrapper.width <= 60.5, `placement width stays within 60px at ${width}px (${row.kind})`);
      assert.ok(row.wrapper.right <= row.cover.left + 0.5, `placement does not overlap cover at ${width}px (${row.kind})`);
      assert.equal(row.rank, row.kind === "up" ? "#11" : row.kind === "down" ? "#12" : row.kind === "steady" ? "#13" : row.kind === "long" ? "#1300" : row.kind === "review" ? "#1000" : row.kind === "none" ? "#1001" : "#---");
      if (row.movement) {
        assert.ok(row.movement.top >= row.badge.bottom - 0.5, `movement sits below rank badge at ${width}px (${row.kind})`);
        assert.ok(row.movement.bottom <= row.wrapper.bottom + 0.5, `movement remains within the placement column at ${width}px (${row.kind})`);
        assert.equal(row.wrapperBg, "rgba(0, 0, 0, 0)", `movement wrapper stays transparent at ${width}px (${row.kind})`);
        assert.match(row.badgeBg, /linear-gradient/, `rank text retains its orange background at ${width}px (${row.kind})`);
        assert.equal(row.badgeColor, "rgb(255, 255, 255)");
        assert.equal(row.movementBg, "rgb(243, 238, 231)");
        assert.ok(Number.parseFloat(row.fontSize) >= 10.5, `movement text remains readable at ${width}px (${row.kind})`);
        assert.ok(row.aria, `movement keeps its accessible description at ${width}px (${row.kind})`);
        assert.ok(contrastRatio(row.movementColor, row.movementBg) >= 4.5,
          `movement color meets WCAG AA contrast at ${width}px (${row.kind})`);
        assert.ok(row.movement.width < row.cover.left - row.wrapper.left, `movement pill stays clear of cover at ${width}px (${row.kind})`);
      }
      if (row.kind === "none" || row.kind === "unranked") assert.equal(row.movement, null, `${row.kind} card has no fabricated movement data`);
    }

    const controls = await page.evaluate(() => {
      const bottom = document.querySelector(".ranking-scroll-bottom-button:not(.ranking-scroll-bottom-button--top)");
      const top = document.querySelector(".ranking-scroll-bottom-button--top");
      const nav = document.querySelector(".site-nav");
      const b = bottom.getBoundingClientRect(), t = top.getBoundingClientRect(), n = nav.getBoundingClientRect();
      return { bottomGap: n.top - b.bottom, bottomTop: b.top, bottomHeight: b.height, navTop: n.top, topTop: t.top,
        hiddenPointerEvents: getComputedStyle(bottom).pointerEvents };
    });
    assert.ok(Math.abs(controls.bottomGap - 5) <= 1, `bottom shortcut sits 5px above nav at ${width}px (actual ${controls.bottomGap}px)`);
    assert.ok(Math.abs(controls.topTop - 16) <= 1, `go-to-top remains at its existing top position at ${width}px`);
    results.push({ width, rows: measured.length, bottomGap: controls.bottomGap });
  }

  const top = await page.locator(".ranking-scroll-bottom-button--top").boundingBox();
  await page.locator(".ranking-scroll-bottom-button:not(.ranking-scroll-bottom-button--top)").evaluate((button) => {
    button.classList.remove("is-visible");
  });
  const hiddenPointerEvents = await page.locator(".ranking-scroll-bottom-button:not(.ranking-scroll-bottom-button--top)").evaluate((button) => getComputedStyle(button).pointerEvents);
  assert.equal(hiddenPointerEvents, "none", "hidden bottom control cannot intercept touch or swipe gestures");
  await page.locator(".ranking-scroll-bottom-button:not(.ranking-scroll-bottom-button--top)").evaluate((button) => button.classList.add("is-visible"));
  assert.equal((await page.locator(".ranking-scroll-bottom-button--top").boundingBox()).y, top.y, "go-to-top geometry does not change with bottom-button visibility");

  await page.setViewportSize({ width: 1280, height: 900 });
  assert.ok((await page.locator(".ranking-scroll-bottom-button--top").boundingBox()).y < 20, "desktop go-to-top remains top-anchored");
  assert.match(await page.locator(".podcast-card[data-kind=up] .podcast-card__placement").evaluate((el) => getComputedStyle(el).backgroundImage), /linear-gradient/,
    "desktop retains its existing orange placement container");
  assert.equal(await page.locator(".podcast-card[data-kind=up] .placement-value").evaluate((el) => getComputedStyle(el).backgroundImage), "none",
    "mobile-only badge background is absent on desktop");

  const touchPage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await touchPage.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>
    * { box-sizing: border-box; }
    :root { --mobile-nav-height: 76px; }
    body { margin: 0; min-height: 2400px; }
    .site-nav { position: fixed; z-index: 100; inset: auto 0 0; height: var(--mobile-nav-height); background: #fff; }
  </style></head><body class="page-ranglister">
    <main style="height: 2400px"></main>
    <button class="ranking-scroll-bottom-button is-visible" aria-label="Gå til bunden">Gå til bunden</button>
    <nav class="site-nav"></nav>
  </body></html>`);
  await touchPage.addStyleTag({ content: styleCss });
  await touchPage.addStyleTag({ content: desktopCss });
  await touchPage.evaluate(() => {
    window.bottomShortcutClicks = 0;
    window.scrollTo(0, 400);
    document.querySelector(".ranking-scroll-bottom-button").addEventListener("click", () => {
      window.bottomShortcutClicks += 1;
    });
  });
  const buttonBox = await touchPage.locator(".ranking-scroll-bottom-button").boundingBox();
  const touch = await touchPage.context().newCDPSession(touchPage);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: buttonBox.x + buttonBox.width / 2, y: buttonBox.y + buttonBox.height / 2, id: 1, radiusX: 2, radiusY: 2, force: 1 }]
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: buttonBox.x + buttonBox.width / 2, y: buttonBox.y + buttonBox.height / 2 - 130, id: 1, radiusX: 2, radiusY: 2, force: 1 }]
  });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await touchPage.waitForTimeout(100);
  const swipe = await touchPage.evaluate(() => ({ scrollY: window.scrollY, clicks: window.bottomShortcutClicks, height: document.documentElement.scrollHeight, overflow: getComputedStyle(document.documentElement).overflowY }));
  assert.ok(swipe.scrollY > 400, `swiping over the visible bottom shortcut still scrolls the list (${JSON.stringify(swipe)})`);
  assert.equal(swipe.clicks, 0, "a swipe across the bottom shortcut does not activate it");
  await touch.detach();
  await touchPage.close();
  console.log(`Mobile ranking movement geometry and bottom shortcut passed at ${results.map((result) => `${result.width}px`).join(", ")}; desktop controls remain scoped.`);
} finally {
  await browser.close();
}
