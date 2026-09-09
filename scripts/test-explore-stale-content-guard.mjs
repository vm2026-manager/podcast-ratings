import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("../app.js", import.meta.url));
const app = await readFile(appPath, "utf8");

const exploreStart = app.indexOf("function renderExplorePage() {");
const exploreReadyPath = app.indexOf('if (state.podcastDataStatus !== "ready")', exploreStart);
const exploreReadyMarkup = app.indexOf("const isMobileExplore = isMobileViewport();", exploreStart);
assert.ok(exploreStart >= 0, "Explore renderer must exist");
assert.ok(exploreReadyPath > exploreStart, "Explore must guard its DOM before building cards");
assert.ok(
  exploreReadyPath < exploreReadyMarkup,
  "The ready-state guard must run before catalogue-derived Explore markup is exposed"
);

const refreshStart = app.indexOf("async function refreshPodcastData(");
const refreshStatus = app.indexOf('state.podcastDataStatus = initial || !state.podcasts.length ? "loading" : "refreshing";', refreshStart);
const loadingRender = app.indexOf('if (document.body.classList.contains("page-udforsk"))', refreshStart);
const catalogueRequest = app.indexOf("const [podcastRows", refreshStart);
const readyStatus = app.indexOf('state.podcastDataStatus = "ready";', refreshStart);
const finalRender = app.indexOf("renderAfterPodcastDataRefresh({ initial });", refreshStart);

assert.ok(
  refreshStatus < loadingRender && loadingRender < catalogueRequest,
  "An active Explore refresh must replace old cards with the neutral state before requesting data"
);
assert.ok(
  catalogueRequest < readyStatus && readyStatus < finalRender,
  "The current Explore DOM must be rendered only after the new catalogue is committed as ready"
);

console.log("Explore stale-content guard regression checks passed.");
