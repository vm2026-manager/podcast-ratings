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

const recommendations = extractFunction("getPodcastDetailRecommendations");
assert.match(recommendations, /podcastDetailRecommendationCache\.get\(podcastKey\)/u);
assert.match(recommendations, /podcastDetailRecommendationCache\.set\(podcastKey, completedRecommendations\)/u);
assert.match(recommendations, /selectPodcastDetailRecommendations\(/u);

const canonical = extractFunction("getPodcastDetailCanonicalGroupKey");
assert.match(canonical, /podcastDetailCanonicalGroupKeyByPodcastKey\[podcastKey\]/u);

const publicItem = extractFunction("resolvePublicPodcastDisplayItem");
assert.match(publicItem, /podcastDetailPublicItemByPodcastKey\[podcastKey\]/u);

const lookupRebuild = extractFunction("rebuildPodcastDetailRecommendationLookups");
assert.match(lookupRebuild, /podcastDetailRecommendationCache\.clear\(\)/u);
assert.match(lookupRebuild, /podcastDetailDisplayGroupByPodcastKey/u);
assert.match(lookupRebuild, /podcastDetailPublicItemByPodcastKey/u);

const productLoader = extractFunction("loadPodcastSimilarityProductData");
assert.match(productLoader, /podcastDetailRecommendationCache\.clear\(\)/u);

const catalogueRefresh = extractFunction("applyPodcastDataRefresh");
assert.match(catalogueRefresh, /rebuildPodcastDetailRecommendationLookups\(\);/u);

console.log("Podcast detail similarity cache regression checks passed.");
