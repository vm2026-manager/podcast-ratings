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

const detailRenderer = extractFunction("renderPodcastDetailSheetContent");
assert.match(detailRenderer, /data-podcast-similarity-product aria-live="polite"/u);
assert.match(detailRenderer, /schedulePodcastDetailSimilarityProduct\(dialog, podcast\);/u);
assert.doesNotMatch(
  detailRenderer,
  /getPodcastSimilarityProductMarkup\(podcast\)/u,
  "full-catalogue recommendation work must not block the first detail render"
);
assert.match(detailRenderer, /getCachedPodcastDetailRecommendations\(podcast\)/u);
assert.match(detailRenderer, /renderPodcastSimilarityProductMarkup\(cachedRecommendations\)/u);
assert.match(detailRenderer, /if \(cachedRecommendations\) hydratePodcastSimilarityProduct/u);

const scheduler = extractFunction("schedulePodcastDetailSimilarityProduct");
assert.match(scheduler, /window\.requestAnimationFrame\(\(\) => \{/u);
assert.match(scheduler, /state\.activePodcastDetailKey !== detailKey/u);
assert.match(scheduler, /dialog\.classList\.contains\("is-hidden"\)/u);

const similarityRefresh = extractFunction("refreshPodcastDetailSimilarityProduct");
assert.match(similarityRefresh, /state\.podcastDetailView !== "detail"/u);

const similarityLoader = extractFunction("loadPodcastSimilarityProductData");
assert.match(similarityLoader, /refreshPodcastDetailSimilarityProduct\(\);/u);
assert.doesNotMatch(
  similarityLoader,
  /refreshOpenPodcastDetailSheet\(\);/u,
  "similarity completion must not rebuild the entire open detail sheet"
);

console.log("Podcast detail first-paint regression checks passed.");
