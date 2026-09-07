import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist.`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} must have a complete body.`);
}

const catalog = [
  {
    id: "source",
    podcastId: "i et forhold med",
    title: "I et forhold med",
    topics: [],
    supplementarySimilarities: [
      { title: "det falske match", hostQualifier: null },
      { title: "et farligt match", hostQualifier: null }
    ]
  },
  { id: "same-series", podcastId: "same-series", title: "Samme serie", mainSeries: "Serie" },
  { id: "manual-false", podcastId: "det falske match", title: "Det falske match" },
  { id: "manual-danger", podcastId: "et farligt match", title: "Et farligt match" },
  { id: "stale-love", podcastId: "opskriften pa kærlighed", title: "Opskriften på kærlighed" },
  { id: "stale-swipe", podcastId: "swipe match date", title: "Swipe. Match. Date." },
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `automatic-${index + 1}`,
    podcastId: `automatic-${index + 1}`,
    title: `Automatisk ${index + 1}`
  }))
];
catalog[0].mainSeries = "Serie";

const byRecommendationId = Object.fromEntries(catalog.map((podcast) => [podcast.id, podcast]));
const context = {
  state: { podcasts: catalog, podcastSimilarityPodcastByRecommendationId: byRecommendationId },
  normalizeText: (value) => String(value ?? "").trim(),
  normalizeComparable: (value) => String(value ?? "").trim().toLowerCase(),
  getPodcastId: (podcast) => podcast?.podcastId || "",
  getPodcastKey: (podcast) => podcast?.id || "",
  getPodcastTopicKeys: (podcast) => new Set(podcast?.topics || []),
  hostsMatchComparable: () => false,
  selectPodcastDetailRecommendations: (candidates, limit) => candidates.slice(0, limit)
};
vm.createContext(context);
for (const name of [
  "getCatalogueManualSupplementaryReferences",
  "getCatalogueManualSupplementaryPodcasts",
  "getPodcastDetailDynamicRecommendations"
]) {
  vm.runInContext(extractFunction(name), context);
}

const sourcePodcast = catalog[0];
const staleManualResults = [
  { recommendationId: "manual-false" },
  { recommendationId: "manual-danger" },
  { recommendationId: "stale-love" },
  { recommendationId: "stale-swipe" }
];
const automaticResults = Array.from({ length: 6 }, (_, index) => ({
  recommendationId: `automatic-${index + 1}`
}));
const secondRender = context.getPodcastDetailDynamicRecommendations(sourcePodcast, {
  product: {
    sameSeriesResults: [{ recommendationId: "same-series" }],
    manualSupplementaryResults: staleManualResults,
    automaticSimilarResults: automaticResults
  }
});
const secondRenderIds = Array.from(secondRender, (candidate) => candidate.item.podcast.id);

assert.deepEqual(secondRenderIds.slice(0, 3), [
  "same-series",
  "manual-false",
  "manual-danger"
]);
assert.ok(secondRenderIds.includes("automatic-1"), "Automatic results must fill remaining slots.");
assert.ok(!secondRenderIds.includes("stale-love"));
assert.ok(!secondRenderIds.includes("stale-swipe"));
assert.ok(!secondRenderIds.includes("source"));
assert.equal(new Set(secondRenderIds).size, secondRenderIds.length);

const firstRenderManualIds = Array.from(
  context.getCatalogueManualSupplementaryPodcasts(sourcePodcast),
  (podcast) => podcast.id
);
assert.deepEqual(firstRenderManualIds, ["manual-false", "manual-danger"]);
assert.deepEqual(
  Array.from(
    context.getCatalogueManualSupplementaryPodcasts({
      ...sourcePodcast,
      supplementarySimilarities: null,
      supplementarySimilaritiesRaw: "det falske match; et farligt match"
    }),
    (podcast) => podcast.id
  ),
  firstRenderManualIds,
  "Legacy raw manual links must resolve through the current catalogue too."
);
assert.deepEqual(
  secondRenderIds.filter((id) => ["manual-false", "manual-danger"].includes(id)),
  firstRenderManualIds,
  "The asynchronous product load must retain the live catalogue manual list."
);

const cataloguePayload = JSON.parse(
  await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8")
);
const productPayload = JSON.parse(
  await readFile(new URL("../data/podcast-similarity-product-v1.3.json", import.meta.url), "utf8")
);
const liveCatalog = cataloguePayload.rows.map((row) => ({
  id: row["Podcast-ID"],
  podcastId: row["Podcast-ID"],
  title: row.Titel,
  host: row["Vært"],
  mainSeries: row.mainSeries || "",
  genre: row.Genre || "",
  secondaryGenre: row.secondaryGenre || "",
  publisher: row.Udgiver || "",
  ratingValue: 0,
  topics: row.topics || [],
  supplementarySimilarities: row.supplementarySimilarities,
  supplementarySimilaritiesRaw: row.supplementarySimilaritiesRaw
}));
const liveSource = liveCatalog.find((podcast) => podcast.podcastId === "i et forhold med");
const liveProduct = Object.values(productPayload.results).find(
  (result) => result.existingId === "i et forhold med"
);
assert.ok(liveSource && liveProduct, "The live example must exist in both data sources.");
const liveByPodcastId = new Map(liveCatalog.map((podcast) => [podcast.podcastId, podcast]));
context.state.podcasts = liveCatalog;
context.state.podcastSimilarityPodcastByRecommendationId = Object.fromEntries(
  Object.values(productPayload.results)
    .map((result) => [result.recommendationId, liveByPodcastId.get(result.existingId)])
    .filter(([, podcast]) => podcast)
);
const liveSecondRenderIds = Array.from(
  context.getPodcastDetailDynamicRecommendations(liveSource, { product: liveProduct }),
  (candidate) => candidate.item.podcast.podcastId
);
assert.deepEqual(liveSecondRenderIds.slice(0, 2), ["det falske match", "et farligt match"]);
assert.ok(!liveSecondRenderIds.includes("opskriften pa kærlighed"));
assert.ok(!liveSecondRenderIds.includes("swipe match date"));

console.log("Live catalogue manual recommendation test passed.");
