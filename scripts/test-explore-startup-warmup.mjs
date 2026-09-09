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

const warmExploreRouteAssets = extractFunction("warmExploreRouteAssets");
assert.match(warmExploreRouteAssets, /loadPodcastSimilarityProductData\(\);/u);
assert.match(warmExploreRouteAssets, /loadExploreClusterIntegration\(\);/u);

const similarityLoader = extractFunction("loadPodcastSimilarityProductData");
assert.match(similarityLoader, /if \(state\.podcastSimilarityProductPromise\)/u);
assert.match(similarityLoader, /return state\.podcastSimilarityProductPromise;/u);

const clusterLoader = extractFunction("loadExploreClusterIntegration");
assert.match(clusterLoader, /if \(state\.exploreClustersPromise\) return state\.exploreClustersPromise;/u);

const warmRouteAssets = extractFunction("warmRouteAssets");
assert.match(warmRouteAssets, /if \(route === "udforsk"\) warmExploreRouteAssets\(\);/u);

const refreshSupabaseState = extractFunction("refreshSupabaseState");
assert.match(
  refreshSupabaseState,
  /await Promise\.all\(\[fetchCommunityStats\(\), fetchUserState\(\)\]\);/u,
  "independent Supabase reads must run in parallel"
);

const startup = extractFunction("startInitialExplorePersonalization");
assert.match(startup, /\.then\(\(\) => initialPodcastStartup\)/u);
assert.match(startup, /warmExploreRouteAssets\(\);/u);
assert.match(startup, /refreshSupabaseState\(\),/u);

assert.doesNotMatch(app, /EXPLORE-TRACE|exploreDebug|traceExplore/u, "temporary Explore diagnostics must be removed");

console.log("Explore startup warmup regression checks passed.");
