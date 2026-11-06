import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const app = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists in app.js`);
  const signatureStart = app.indexOf("(", start);
  let parentheses = 0;
  let signatureEnd = signatureStart;
  for (; signatureEnd < app.length; signatureEnd += 1) {
    if (app[signatureEnd] === "(") parentheses += 1;
    if (app[signatureEnd] === ")" && --parentheses === 0) break;
  }
  const bodyStart = app.indexOf("{", signatureEnd + 1);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const movementLoader = extractFunction("loadRankingMovementSnapshot");
const gridRenderer = extractFunction("renderPodcastGrid");
assert.match(movementLoader, /refreshVisibleRankingMovement\(\)/,
  "late ranking history refreshes badges without rerendering the grid");
assert.doesNotMatch(movementLoader, /renderPodcastGrid\(\)/,
  "ranking-history completion never clears and rebuilds the grid");
assert.doesNotMatch(gridRenderer, /podcastGrid\.innerHTML\s*=\s*["']{2}/,
  "ready mobile ranking renders no longer empty the grid");
assert.match(gridRenderer, /reconcileMobileRankingCards\(/,
  "ready mobile ranking renders reconcile existing keyed cards");

const browserEngines = [{ engine: "Chromium", browserType: chromium }];
if (existsSync(webkit.executablePath())) {
  browserEngines.push({ engine: "WebKit", browserType: webkit });
} else {
  console.log("WebKit browser regression skipped: Playwright WebKit is not installed in this environment.");
}

for (const { engine, browserType } of browserEngines) {
  const browser = await browserType.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: engine === "Chromium",
      hasTouch: engine === "Chromium"
    });
  const functions = [
    "normalizeRankingMovementForComparison",
    "syncRankingMovementBadge",
    "captureRankingScrollAnchor",
    "restoreRankingScrollAnchor",
    "reconcileMobileRankingCards",
    "refreshVisibleRankingMovement",
    "loadNextMobileRankingBatch"
  ].map(extractFunction).join("\n");

  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>
    *{box-sizing:border-box} html,body{margin:0;min-height:100%;font:16px Arial} body{overflow-x:hidden}
    #podcastGrid{width:100%;display:flex;flex-direction:column;align-items:stretch}
    .podcast-card{height:116px;min-height:116px;margin:0;padding:12px;border:1px solid #aaa;display:grid;grid-template-columns:44px 1fr;gap:12px}
    .podcast-card__placement{display:flex;gap:4px;align-items:center}.podcast-card__body{min-width:0}
    .podcast-card__title{display:block}.podcast-card__media{height:64px;background:#ddd}
  </style></head><body class="page-ranglister"><main id="podcastGrid" aria-busy="false"></main><p id="resultsText"></p><button id="bottom">Gå til bunden</button><button id="top">Gå til toppen</button></body></html>`);

  for (const width of [320, 375, 390, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(({ functions }) => {
      const podcasts = Array.from({ length: 100 }, (_, index) => ({
        id: `podcast-${index + 1}`,
        key: `podcast-${index + 1}`,
        title: `Podcast ${index + 1}`
      }));
      const state = {
        visibleCount: 20,
        mobileRankingBatchLoading: false,
        mobileRankingObserverToken: 0,
        mobileRankingTailMode: false,
        rankingMovementByKey: new Map(),
        rankingMovementSnapshotValid: false,
        rankingMovementPeriodLabel: ""
      };
      const elements = {
        podcastGrid: document.getElementById("podcastGrid"),
        resultsText: document.getElementById("resultsText"),
        loadMoreButton: { disabled: false, textContent: "" }
      };
      const isRankingRoute = () => true;
      const isMobileRankingRoute = () => innerWidth < 1101;
      const getPodcastKey = (podcast) => podcast.key;
      const getRankingMovementKey = (podcast) => podcast.key;
      const getRankingMovementId = (podcast) => state.rankingMovementSnapshotValid
        ? `ranking-movement-${podcast.key}` : "";
      const getRankingMovementMarkup = (podcast) => {
        if (!state.rankingMovementSnapshotValid || !state.rankingMovementByKey.has(podcast.key)) return "";
        const delta = state.rankingMovementByKey.get(podcast.key);
        const kind = delta > 0 ? "up" : delta < 0 ? "down" : "steady";
        const label = delta > 0 ? `Steget ${delta} placering` : delta < 0 ? `Faldet ${Math.abs(delta)} placering` : "Uændret placering";
        return `<span id="ranking-movement-${podcast.key}" class="ranking-movement ranking-movement--${kind}" aria-label="${label}" title="${label}">${delta > 0 ? "▲" : delta < 0 ? "▼" : "–"}${delta ? ` ${Math.abs(delta)}` : ""}</span>`;
      };
      const getRankingPresentationPodcasts = () => podcasts;
      const getMobileRankingCardCount = () => elements.podcastGrid.querySelectorAll(":scope > .podcast-card").length;
      const getRankingBatchSize = () => 20;
      const getResultsText = (total, count) => `${count} af ${total}`;
      const setRankingResultsText = (text) => { elements.resultsText.textContent = text; };
      const updateLoadMoreUi = () => {};
      const disconnectMobileRankingObserver = () => {};
      const setupMobileRankingAutoLoad = () => {};
      const observedCards = [];
      const observePodcastRatingControl = (podcast, card) => { if (podcast && card) observedCards.push(podcast.key); };
      const makeCard = (podcast, rank) => {
        const card = document.createElement("article");
        card.className = "podcast-card";
        card.dataset.key = podcast.key;
        card.dataset.displayRank = String(rank);
        card.innerHTML = `<div class="podcast-card__placement"><span class="placement-value">#${rank}</span>${getRankingMovementMarkup(podcast)}<span class="placement-label">placering</span></div><div class="podcast-card__body"><button data-action="open-details" class="podcast-card__title">${podcast.title}</button><div class="podcast-card__media"></div></div>`;
        return card;
      };
      const appendRankingBatchItems = (items, start) => {
        const fragment = document.createDocumentFragment();
        items.forEach((podcast, offset) => fragment.append(makeCard(podcast, start + offset + 1)));
        elements.podcastGrid.append(fragment);
        return true;
      };
      const renderPodcastGrid = () => {
        const desired = podcasts.slice(0, state.visibleCount).map((podcast, index) => makeCard(podcast, index + 1));
        window.__api.reconcileMobileRankingCards(desired, podcasts.slice(0, state.visibleCount));
      };
      const getResultsTextMock = getResultsText;
      const getRankingPresentationPodcastsMock = getRankingPresentationPodcasts;
      const getMobileRankingCardCountMock = getMobileRankingCardCount;
      const getRankingBatchSizeMock = getRankingBatchSize;
      const appendRankingBatchItemsMock = appendRankingBatchItems;
      const disconnectMobileRankingObserverMock = disconnectMobileRankingObserver;
      const updateLoadMoreUiMock = updateLoadMoreUi;
      const setupMobileRankingAutoLoadMock = setupMobileRankingAutoLoad;
      const renderPodcastGridMock = renderPodcastGrid;
      const source = functions;
      const getFunctions = new Function(
        "state", "elements", "isRankingRoute", "isMobileRankingRoute", "getPodcastKey",
        "getRankingMovementKey", "getRankingMovementId", "getRankingMovementMarkup",
        "getRankingPresentationPodcasts", "getMobileRankingCardCount", "getRankingBatchSize",
        "getResultsText", "setRankingResultsText", "updateLoadMoreUi", "disconnectMobileRankingObserver",
        "setupMobileRankingAutoLoad", "appendRankingBatchItems", "renderPodcastGrid", "observePodcastRatingControl",
        `${source}; return { reconcileMobileRankingCards, refreshVisibleRankingMovement, loadNextMobileRankingBatch };`
      );
      const api = getFunctions(
        state, elements, isRankingRoute, isMobileRankingRoute, getPodcastKey,
        getRankingMovementKey, getRankingMovementId, getRankingMovementMarkup,
        getRankingPresentationPodcastsMock, getMobileRankingCardCountMock, getRankingBatchSizeMock,
        getResultsTextMock, setRankingResultsText, updateLoadMoreUiMock, disconnectMobileRankingObserverMock,
        setupMobileRankingAutoLoadMock, appendRankingBatchItemsMock, renderPodcastGridMock, observePodcastRatingControl
      );
      const create = (podcast, rank) => makeCard(podcast, rank);
      const initial = podcasts.slice(0, 20).map((podcast, index) => create(podcast, index + 1));
      api.reconcileMobileRankingCards(initial, podcasts.slice(0, 20));
      window.__rankingTest = { state, elements, podcasts, api, observedCards };
      window.__api = api;
      window.__apiState = state;
    }, { functions });

    const baselineReset = await page.evaluate(() => {
      const { elements, api, podcasts } = window.__rankingTest;
      elements.podcastGrid.querySelector('[data-key="podcast-20"]').scrollIntoView();
      const before = window.scrollY;
      elements.podcastGrid.innerHTML = "";
      const after = window.scrollY;
      api.reconcileMobileRankingCards(
        podcasts.slice(0, 20).map((podcast, index) => {
          const card = document.createElement("article");
          card.className = "podcast-card";
          card.dataset.key = podcast.key;
          card.innerHTML = `<div class="podcast-card__placement"><span class="placement-value">#${index + 1}</span><span class="placement-label">placering</span></div><div class="podcast-card__body"><button data-action="open-details" class="podcast-card__title">${podcast.title}</button><div class="podcast-card__media"></div></div>`;
          return card;
        }),
        podcasts.slice(0, 20)
      );
      return { before, after };
    });
    assert.ok(baselineReset.before > 0, `baseline clear is tested from a scrolled position at ${width}px`);
    assert.ok(baselineReset.after < baselineReset.before,
      `clearing all cards reproduces the scroll reset at ${width}px (before ${baselineReset.before}, after ${baselineReset.after})`);

    // Capture the actual DOM identities and scroll anchor before a delayed history response.
    await page.evaluate(async () => {
      const card = document.querySelector('[data-key="podcast-25"]');
      card?.scrollIntoView();
      const grid = document.getElementById("podcastGrid");
      const visible = [...grid.querySelectorAll(":scope > .podcast-card")];
      window.__before = {
        scrollY: window.scrollY,
        firstVisible: visible.find((item) => item.getBoundingClientRect().bottom > 0)?.dataset.key,
        ids: visible.map((item) => item.dataset.key)
      };
    });

    const session = engine === "Chromium" ? await page.context().newCDPSession(page) : null;
    if (session) await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    await page.evaluate(() => {
      const grid = document.getElementById("podcastGrid");
      const stableCard = grid.querySelector('[data-key="podcast-20"]');
      const anchor = [...grid.querySelectorAll(":scope > .podcast-card")]
        .find((card) => card.getBoundingClientRect().bottom > 0);
      window.__movementPromise = new Promise((resolve) => setTimeout(() => {
        const scrollYBefore = window.scrollY;
        const anchorTopBefore = anchor?.getBoundingClientRect().top;
        window.__apiState.rankingMovementByKey = new Map([["podcast-20", 2]]);
        window.__apiState.rankingMovementSnapshotValid = true;
        window.__apiState.rankingMovementPeriodLabel = "siden 7 dage";
        window.__api.refreshVisibleRankingMovement();
        const stableBadge = stableCard.querySelector(".ranking-movement");
        window.__apiState.rankingMovementByKey.set("podcast-20", 3);
        window.__api.refreshVisibleRankingMovement();
        window.__movement = {
          scrollY: window.scrollY,
          scrollYBefore,
          anchorTopBefore,
          anchorTopAfter: anchor?.getBoundingClientRect().top,
          cardSame: stableCard === grid.querySelector('[data-key="podcast-20"]'),
          badgeSame: stableBadge === stableCard.querySelector(".ranking-movement"),
          badgeText: stableBadge?.textContent
        };
        resolve();
      }, 250));
    });
    for (let swipe = 0; swipe < 4; swipe += 1) {
      if (session) {
        await session.send("Input.synthesizeScrollGesture", {
          x: Math.min(width - 20, 180), y: 700, yDistance: -560, speed: 1100, gestureSourceType: "touch"
        });
      } else {
        await page.mouse.wheel(0, 560);
      }
    }
    await page.evaluate(() => window.__movementPromise);
    const movement = await page.evaluate(() => window.__movement);
    assert.ok(movement, `movement history refreshed at ${width}px`);
    assert.equal(movement.cardSame, true, `podcast card DOM survives history response at ${width}px`);
    assert.equal(movement.badgeSame, true, `movement badge DOM survives history response at ${width}px`);
    assert.equal(movement.scrollY, movement.scrollYBefore, `history badge update does not move the active scroll at ${width}px`);
    assert.ok(Math.abs(movement.anchorTopAfter - movement.anchorTopBefore) < 1,
      `the first visible podcast stays at the same viewport position when history resolves at ${width}px`);

    // Load batches beyond #20, #40 and #60, including a forced count mismatch that takes the old fallback.
    await page.evaluate(() => {
      const { api, state, elements } = window.__rankingTest;
      state.rankingMovementSnapshotValid = false;
      state.visibleCount = 20;
      const focused = elements.podcastGrid.querySelector('[data-key="podcast-5"] [data-action]');
      focused.focus();
      elements.podcastGrid.querySelector('[data-key="podcast-20"]').scrollIntoView();
      api.loadNextMobileRankingBatch({ trigger: "observer", token: state.mobileRankingObserverToken });
      elements.podcastGrid.querySelector('[data-key="podcast-40"]').scrollIntoView();
      api.loadNextMobileRankingBatch({ trigger: "observer", token: state.mobileRankingObserverToken });
      elements.podcastGrid.querySelector('[data-key="podcast-60"]').scrollIntoView();
      api.loadNextMobileRankingBatch({ trigger: "observer", token: state.mobileRankingObserverToken });
      window.__staleObserverAccepted = api.loadNextMobileRankingBatch({ trigger: "observer", token: state.mobileRankingObserverToken - 1 });
    });

    // Exercise the mismatched-count fallback while the viewport is over #25.
    await page.evaluate(() => {
      const { api, state, elements } = window.__rankingTest;
      const target = elements.podcastGrid.querySelector('[data-key="podcast-25"]');
      target.scrollIntoView();
      const topBefore = target.getBoundingClientRect().top;
      elements.podcastGrid.querySelector('[data-key="podcast-1"]')?.remove();
      api.loadNextMobileRankingBatch({ trigger: "observer", token: state.mobileRankingObserverToken });
      window.__fallbackTopDelta = elements.podcastGrid.querySelector('[data-key="podcast-25"]').getBoundingClientRect().top - topBefore;
    });

    const checks = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("#podcastGrid > .podcast-card")];
      const ids = cards.map((card) => card.dataset.key);
      const tops = cards.map((card) => card.getBoundingClientRect().top + window.scrollY);
      const active = document.activeElement;
      const anchor = cards.find((card) => card.dataset.key === "podcast-25");
      return {
        count: cards.length,
        unique: new Set(ids).size,
        ordered: ids.every((id, index) => id === `podcast-${index + 1}`),
        scrollY: window.scrollY,
        anchorTop: anchor?.getBoundingClientRect().top,
        activePodcast: active.closest(".podcast-card")?.dataset.key,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        noGaps: tops.slice(1).every((top, index) => Math.abs(top - tops[index] - 116) < 1)
      };
    });
    assert.equal(checks.count, 100, `four 20-card appends and one mismatch repair retain the whole visible list at ${width}px`);
    assert.equal(checks.unique, 100, `no duplicate podcast IDs at ${width}px`);
    assert.equal(checks.ordered, true, `no rank skips at ${width}px`);
    assert.equal(checks.noGaps, true, `no empty card gaps at ${width}px`);
    assert.equal(checks.horizontalOverflow, false, `no horizontal overflow at ${width}px`);
    assert.equal(checks.activePodcast, "podcast-5", `keyboard focus stays on the same podcast through reconciliation at ${width}px`);
    const fallbackTopDelta = await page.evaluate(() => window.__fallbackTopDelta);
    assert.ok(Math.abs(fallbackTopDelta) < 1, `mismatched batch repair keeps podcast #25 anchored at ${width}px`);
    assert.equal(await page.evaluate(() => window.__staleObserverAccepted), false, `stale IntersectionObserver callback is ignored at ${width}px`);

    const viewportAnchor = await page.evaluate(() => {
      const target = document.querySelector('[data-key="podcast-25"]');
      target.scrollIntoView();
      const top = target.getBoundingClientRect().top;
      return { top, key: target.dataset.key };
    });
    await page.setViewportSize({ width, height: 700 });
    const shorterViewportAnchor = await page.evaluate(() => {
      const card = document.querySelector('[data-key="podcast-25"]');
      return { top: card.getBoundingClientRect().top, key: card.dataset.key };
    });
    await page.setViewportSize({ width, height: 844 });
    assert.equal(shorterViewportAnchor.key, viewportAnchor.key, `viewport height change keeps the anchored podcast identity at ${width}px`);
    assert.ok(Math.abs(shorterViewportAnchor.top - viewportAnchor.top) < 1,
      `viewport height change keeps the podcast at the same relative position at ${width}px`);

    await page.evaluate(() => {
      const { api } = window.__rankingTest;
      const cards = [...document.querySelectorAll("#podcastGrid > .podcast-card")];
      api.reconcileMobileRankingCards(cards.slice(0, 10).map((card) => card.cloneNode(true)), window.__rankingTest.podcasts.slice(0, 10));
      window.__filteredCount = document.querySelectorAll("#podcastGrid > .podcast-card").length;
      api.reconcileMobileRankingCards(cards.map((card) => card.cloneNode(true)), window.__rankingTest.podcasts);
      document.querySelector('[data-key="podcast-100"]').scrollIntoView();
      window.__bottomReached = document.querySelector('[data-key="podcast-100"]').getBoundingClientRect().top < innerHeight;
      window.scrollTo(0, 0);
      window.__topReached = window.scrollY === 0;
    });
    const navigation = await page.evaluate(() => ({ filtered: window.__filteredCount, bottom: window.__bottomReached, top: window.__topReached }));
    assert.equal(navigation.filtered, 10, `filter reconciliation removes cards outside the selected result at ${width}px`);
    assert.equal(navigation.bottom, true, `Gå til bunden target remains reachable at ${width}px`);
    assert.equal(navigation.top, true, `Gå til toppen remains reachable at ${width}px`);
    await session?.detach();
    }
  } finally {
    await browser.close();
  }
}

const engineSummary = browserEngines.map(({ engine }) => engine === "Chromium"
  ? "Chromium touch gesture emulation"
  : "WebKit wheel scroll").join(" and ");
console.log(`Mobile ranking scroll regression passed in ${engineSummary} across 320/375/390/430/768px and desktop 1280/1440px viewports.`);
