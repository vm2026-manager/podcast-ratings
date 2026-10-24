import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("../app.js", import.meta.url));
const app = await readFile(appPath, "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const next = app.indexOf("\nfunction ", start + 1);
  return app.slice(start, next === -1 ? app.length : next);
}

function makeRouteWarmup(hash) {
  const warmedRoutes = [];
  const warmRouteAssets = (route) => warmedRoutes.push(route);
  const window = {
    location: { hash },
    requestIdleCallback(callback) { callback(); },
    setTimeout(callback) { callback(); }
  };
  const schedule = new Function(
    "state",
    "window",
    "warmRouteAssets",
    `let backgroundRouteWarmupScheduled = false;\n${extractFunction("scheduleBackgroundRouteWarmup")}\nreturn scheduleBackgroundRouteWarmup;`
  )({ podcasts: [{ podcastId: "existing-catalogue-entry" }] }, window, warmRouteAssets);
  schedule();
  return warmedRoutes;
}

assert.deepEqual(
  makeRouteWarmup("#forside"),
  ["forside", "ranglister", "profil"],
  "background route warming on the homepage must not request Explore recommendations"
);
assert.deepEqual(
  makeRouteWarmup("#udforsk"),
  ["forside", "ranglister", "udforsk", "profil"],
  "Explore recommendations can still warm when Explore is the active route"
);

async function personalizationWarmupsFor(hash) {
  let warmups = 0;
  const window = { location: { hash } };
  const startup = new Function(
    "state",
    "window",
    "initialPodcastStartup",
    "warmExploreRouteAssets",
    `let initialExplorePersonalizationStartup = null;\n${extractFunction("startInitialExplorePersonalization")}\nreturn startInitialExplorePersonalization;`
  )(
    { authUser: { id: "signed-in-user" }, podcastDataStatus: "ready" },
    window,
    Promise.resolve(true),
    () => { warmups += 1; }
  );
  await startup();
  return warmups;
}

assert.equal(await personalizationWarmupsFor("#forside"), 0, "signed-in homepage startup must not fetch Explore assets");
assert.equal(await personalizationWarmupsFor("#udforsk"), 1, "authenticated Explore still warms its recommendation assets");

assert.match(extractFunction("renderExplorePage"), /loadPodcastSimilarityProductData\(\);/u);
assert.match(extractFunction("renderExplorePage"), /loadExploreClusterIntegration\(\);/u);
assert.match(extractFunction("getPodcastSimilarityProductMarkup"), /loadPodcastSimilarityProductData\(\);/u);
assert.match(extractFunction("getDisplayGroupRecommendations"), /loadPodcastSimilarityProductData\(\);/u);

const loader = extractFunction("loadPodcastSimilarityProductData");
assert.match(loader, /if \(state\.podcastSimilarityProductPromise\)/u);
assert.match(loader, /return state\.podcastSimilarityProductPromise;/u);
assert.match(loader, /podcastDetailRecommendationCache\.clear\(\)/u);

console.log("Homepage similarity lazy-load regressions passed.");
