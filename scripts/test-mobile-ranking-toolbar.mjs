import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const readRepoFile = (name) => readFile(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");
const [index, app, styleCss, desktopCss, mobileCss, movementCss] = await Promise.all([
  readRepoFile("index.html"),
  readRepoFile("app.js"),
  readRepoFile("style.css"),
  readRepoFile("desktop-home-mockup.css"),
  readRepoFile("mobile-layout-regressions.css"),
  readRepoFile("ranking-movement.css")
]);

assert.match(index, /mobile-layout-regressions\.css\?v=20261030-mobile-ranking-toolbar-v1/,
  "the mobile layout stylesheet cache version is updated");
assert.match(index, /<section class="ranking-toolbar" aria-live="polite">[\s\S]*?<div class="ranking-toolbar__results">[\s\S]*?<p id="resultsText">/,
  "the live results announcement stays in the ranking toolbar DOM");
assert.match(index, /<section\s+id="podcastGrid"[\s\S]*?class="podcast-grid"/,
  "ranking errors continue to render inside podcastGrid");
assert.match(app, /elements\.mobileSortToggle\.addEventListener\("click",\s*\(\)\s*=>\s*\{\s*state\.sortTouched = true;\s*state\.sort =\s*state\.sort === "placement-asc" \? "placement-desc" : "placement-asc";/,
  "the existing mobile sort click handler and sort transition remain intact");
assert.match(app, /isAscending \? "Sorter efter laveste placering f\\u00f8rst" : "Sorter efter h\\u00f8jeste placering f\\u00f8rst"/,
  "the existing mobile sort accessibility label remains intact");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent(`<!doctype html><html lang="da"><head>
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <style>* { box-sizing: border-box; } body { margin: 0; min-height: 1800px; }</style>
  </head><body class="page-ranglister">
    <main class="page-shell">
      <nav aria-label="Hovednavigation"><a href="#podcastGrid">Gå til podcastlisten</a></nav>
      <section class="ranking-list-panel" aria-labelledby="rankingListHeading">
        <section class="ranking-toolbar" aria-live="polite">
          <h2 id="rankingListHeading">Rangliste over podcasts</h2>
          <div class="ranking-toolbar__results"><p id="resultsText">Viser 20 af 2.400 podcasts · 7 med placeringsændringer</p></div>
          <button id="mobileSortToggle" class="mobile-sort-toggle" type="button" aria-label="Sorter efter laveste placering først">⇅ Lavest</button>
        </section>
        <section id="podcastGrid" class="podcast-grid" aria-label="Podcastoversigt" aria-busy="false">
          <div class="empty-state">Podcastlisten kunne ikke indlæses. Prøv igen senere.</div>
          ${"<article class=\"podcast-card\"><h3>Podcastkort</h3></article>".repeat(24)}
        </section>
      </section>
    </main>
    <script>
      const toggle = document.getElementById("mobileSortToggle");
      toggle.addEventListener("click", () => {
        const lowest = toggle.textContent.includes("Lavest");
        toggle.textContent = lowest ? "⇅ Højest" : "⇅ Lavest";
        toggle.setAttribute("aria-label", lowest ? "Sorter efter højeste placering først" : "Sorter efter laveste placering først");
      });
    </script>
  </body></html>`);

  // Match the stylesheet order in index.html; later movement and desktop rules
  // are included so the test catches cascade regressions from those files.
  for (const css of [styleCss, desktopCss, mobileCss, movementCss]) {
    await page.addStyleTag({ content: css });
  }

  for (const width of [320, 375, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("#resultsText").evaluate((element) => {
      element.textContent = "Viser 20 af 2.400 podcasts · 7 med placeringsændringer";
      const button = document.getElementById("mobileSortToggle");
      button.textContent = "⇅ Lavest";
      button.setAttribute("aria-label", "Sorter efter laveste placering først");
    });
    const metrics = await page.evaluate(() => {
      const toolbar = document.querySelector(".ranking-toolbar");
      const results = document.querySelector(".ranking-toolbar__results");
      const button = document.getElementById("mobileSortToggle");
      const grid = document.getElementById("podcastGrid");
      const rect = (element) => element.getBoundingClientRect().toJSON();
      const resultsStyle = getComputedStyle(results);
      const buttonStyle = getComputedStyle(button);
      return {
        toolbar: rect(toolbar), results: rect(results), button: rect(button),
        grid: rect(grid), pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        resultsStyle: { display: resultsStyle.display, position: resultsStyle.position,
          width: resultsStyle.width, height: resultsStyle.height, overflow: resultsStyle.overflow,
          clipPath: resultsStyle.clipPath },
        buttonStyle: { color: buttonStyle.color, backgroundColor: buttonStyle.backgroundColor,
          fontSize: buttonStyle.fontSize, borderRadius: buttonStyle.borderRadius,
          height: buttonStyle.height },
        live: toolbar.getAttribute("aria-live"), text: document.getElementById("resultsText").textContent,
        error: grid.querySelector(".empty-state")?.textContent
      };
    });

    assert.equal(metrics.pageWidth, metrics.viewportWidth, `no horizontal overflow at ${width}px`);
    assert.equal(metrics.live, "polite", `live announcement remains enabled at ${width}px`);
    assert.match(metrics.resultsStyle.position, /absolute/, `results remain in the DOM but are visually clipped at ${width}px`);
    assert.equal(metrics.resultsStyle.width, "1px");
    assert.equal(metrics.resultsStyle.height, "1px");
    assert.equal(metrics.resultsStyle.overflow, "hidden");
    assert.equal(metrics.resultsStyle.clipPath, "inset(50%)");
    assert.notEqual(metrics.resultsStyle.display, "none", `results are not removed from accessibility at ${width}px`);
    assert.match(metrics.error, /kunne ikke indlæses/, `error remains visible in podcastGrid at ${width}px`);
    assert.equal(await page.getByRole("button", { name: "Sorter efter laveste placering først" }).count(), 1,
      `mobile sort keeps its accessible label at ${width}px`);
    assert.match(await page.locator("body").ariaSnapshot(), /Viser 20 af 2\.400 podcasts/,
      `the clipped summary remains in the accessibility tree at ${width}px`);

    const toolbarHeight = metrics.toolbar.height;
    const buttonX = metrics.button.x;
    const buttonDesign = metrics.buttonStyle;
    const summaryTexts = [
      "Viser 20 af 2.400 podcasts · 7 med placeringsændringer",
      "Viser 20 af 2 podcasts"
    ];
    const measuredXs = [];
    for (const text of summaryTexts) {
      await page.locator("#resultsText").evaluate((element, value) => { element.textContent = value; }, text);
      for (let state = 0; state < 2; state += 1) {
        const box = await page.locator("#mobileSortToggle").boundingBox();
        measuredXs.push(box.x);
        assert.equal((await page.locator(".ranking-toolbar").boundingBox()).height, toolbarHeight,
          `result text length does not change toolbar height at ${width}px`);
        assert.deepEqual(await page.locator("#mobileSortToggle").evaluate((button) => {
          const style = getComputedStyle(button);
          return { color: style.color, backgroundColor: style.backgroundColor,
            fontSize: style.fontSize, borderRadius: style.borderRadius, height: style.height };
        }), buttonDesign, `sort button design remains unchanged at ${width}px`);
        await page.locator("#mobileSortToggle").click();
      }
    }
    assert.ok(measuredXs.every((x) => Math.abs(x - buttonX) < 0.1),
      `sort button stays on the same left edge for both labels and result lengths at ${width}px`);

    await page.locator("#mobileSortToggle").focus();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "mobileSortToggle",
      `sort control remains keyboard focusable at ${width}px`);
    await page.keyboard.press("Space");
    assert.equal(await page.getByRole("button", { name: "Sorter efter højeste placering først" }).count(), 1,
      `keyboard activation toggles sort at ${width}px`);
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("href")), "#podcastGrid",
      `navigation remains keyboard reachable at ${width}px`);
    await page.getByRole("link", { name: "Gå til podcastlisten" }).click();
    assert.equal(new URL(page.url()).hash, "#podcastGrid", `in-page navigation works at ${width}px`);
    assert.ok(await page.evaluate(() => window.scrollY > 0), `list navigation scrolls at ${width}px`);
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  for (const width of [1101, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("#resultsText").evaluate((element) => {
      element.textContent = "Viser 20 af 2.400 podcasts · 7 med placeringsændringer";
    });
    const desktop = await page.evaluate(() => {
      const results = document.querySelector(".ranking-toolbar__results");
      const button = document.querySelector("#mobileSortToggle");
      return { results: results.getBoundingClientRect().toJSON(),
        display: getComputedStyle(results).display, position: getComputedStyle(results).position,
        text: document.querySelector("#resultsText").textContent,
        buttonDisplay: getComputedStyle(button).display,
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth };
    });
    assert.notEqual(desktop.display, "none", `desktop results stay visible at ${width}px`);
    assert.notEqual(desktop.position, "absolute", `desktop results do not use mobile clipping at ${width}px`);
    assert.ok(desktop.results.width > 1, `desktop results retain visible width at ${width}px`);
    assert.match(desktop.text, /Viser 20 af 2\.400 podcasts/);
    assert.equal(desktop.pageWidth, desktop.viewportWidth, `desktop layout has no horizontal overflow at ${width}px`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.classList.add("force-desktop-view");
    document.body.classList.add("force-desktop-view");
  });
  const forced = await page.evaluate(() => {
    const results = document.querySelector(".ranking-toolbar__results");
    return { results: results.getBoundingClientRect().toJSON(), display: getComputedStyle(results).display,
      position: getComputedStyle(results).position, clipPath: getComputedStyle(results).clipPath };
  });
  assert.notEqual(forced.display, "none", "force-desktop-view keeps result text rendered");
  assert.notEqual(forced.position, "absolute", "force-desktop-view does not inherit mobile clipping");
  assert.notEqual(forced.clipPath, "inset(50%)", "force-desktop-view is excluded from the mobile clip rule");
  assert.ok(forced.results.width > 1, "force-desktop-view keeps the result summary visibly measurable");
} finally {
  await browser.close();
}

console.log("Mobile ranking toolbar regression passed at 320, 375, 390, 430, 768, 1101, 1280, 1440 and force-desktop-view.");
