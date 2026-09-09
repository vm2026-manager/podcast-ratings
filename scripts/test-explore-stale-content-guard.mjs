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

const initialRenderState = new Function(
  "state",
  "isLoggedIn",
  `${extractFunction("getExploreInitialRenderState")}\nreturn getExploreInitialRenderState;`
)({}, () => true);

const snapshot = {
  podcastDataStatus: "ready",
  authReady: true,
  personalizationUserStateStatus: "ready",
  communityStatsStatus: "ready",
  podcastSimilarityProductStatus: "loading",
  exploreClustersStatus: "loading"
};

// Reproduces production: the catalogue and user signals are ready, but the
// product/cluster inputs which select the lead recommendation are not.
assert.equal(initialRenderState({ stateSnapshot: snapshot }), "loading");
snapshot.podcastSimilarityProductStatus = "ready";
assert.equal(initialRenderState({ stateSnapshot: snapshot }), "loading");
snapshot.exploreClustersStatus = "ready";
assert.equal(initialRenderState({ stateSnapshot: snapshot }), "ready");

// Optional failures are settled and may render the best valid fallback.
snapshot.podcastSimilarityProductStatus = "error";
assert.equal(initialRenderState({ stateSnapshot: snapshot }), "ready");

const exploreStart = app.indexOf("function renderExplorePage() {");
const readinessGuard = app.indexOf("const initialRenderState = getExploreInitialRenderState();", exploreStart);
const normalMarkup = app.indexOf("const isMobileExplore = isMobileViewport();", exploreStart);
assert.ok(
  readinessGuard > exploreStart && readinessGuard < normalMarkup,
  "Explore must apply the readiness result before building personalized sections"
);

console.log("Explore personalization readiness regression checks passed.");
