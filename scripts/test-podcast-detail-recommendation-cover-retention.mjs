import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const next = app.indexOf("\nfunction ", start + 1);
  return app.slice(start, next === -1 ? app.length : next);
}

const renderer = extractFunction("renderPodcastDetailSimilarityProduct");
const cardUpdater = extractFunction("updatePodcastSimilarityProductCard");
const cardHydrator = extractFunction("hydratePodcastSimilarityProductCard");
const hydrator = extractFunction("hydratePodcastSimilarityProduct");

// Product completion remains a component refresh; it must not rebuild detail
// content, and a populated recommendation row must not be wholesale replaced.
assert.doesNotMatch(renderer, /outerHTML|renderPodcastDetailSheetContent/u);
assert.match(renderer, /if \(!track\)[\s\S]*container\.replaceWith\(replacement\)/u);
assert.match(renderer, /existingCardsByPodcastKey/u);
assert.match(renderer, /card\.dataset\.podcastSimilarityPodcastKey/u);
assert.match(renderer, /existingCardsByPodcastKey\.get\(podcastKey\)/u);
assert.match(renderer, /track\.insertBefore\(card, track\.children\[index\] \|\| null\)/u);
assert.match(renderer, /existingCardsByPodcastKey\.forEach\(\(card\) => card\.remove\(\)\)/u);

// The retained card only receives metadata/copy updates. Its cover/img node,
// including a loaded local source, stays intact.
assert.match(cardUpdater, /copy\.replaceChildren/u);
assert.doesNotMatch(cardUpdater, /card\.replaceWith|card\.innerHTML|related-cover/u);

// New cards alone are hydrated. Per-node markers prevent duplicate card click
// and scroll-control listeners when later reconciliation runs occur.
assert.match(renderer, /else \{\s*card = createPodcastSimilarityProductCard[\s\S]*hydratePodcastSimilarityProductCard\(card\)/u);
assert.match(cardHydrator, /podcastSimilarityHydrated === "true"/u);
assert.match(cardHydrator, /setImage\(cover, getPodcastImageSources\(candidatePodcast\), candidatePodcast\.title\)/u);
assert.match(hydrator, /button\.dataset\.podcastSimilarityHydrated === "true"/u);

console.log("Podcast detail recommendation cover-retention regression checks passed.");
