import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
const marker = "function getExploreProductSimilarityItems(";
const start = source.indexOf(marker);
assert.notEqual(start, -1, "Recommendation selection helper must exist.");

let depth = 0;
let end = -1;
const bodyStart = source.indexOf("{", source.indexOf("\n) {", start));
assert.notEqual(bodyStart, -1, "Recommendation selection helper must have a body.");
for (let index = bodyStart; index < source.length; index += 1) {
  if (source[index] === "{") depth += 1;
  if (source[index] === "}") depth -= 1;
  if (depth === 0) {
    end = index + 1;
    break;
  }
}
assert.notEqual(end, -1, "Recommendation selection helper must be complete.");

const podcasts = new Map(
  [
    ["source", "I et forhold med"],
    ["same-series", "Samme serie"],
    ["manual-false", "Det falske match"],
    ["manual-danger", "Et farligt match"],
    ["automatic-love", "Opskriften på kærlighed"],
    ["automatic-swipe", "Swipe. Match. Date."]
  ].map(([id, title]) => [id, { id, title }])
);

const context = {
  state: {
    podcastSimilarityProductStatus: "ready",
    userRatingsByKey: {},
    podcastSimilarityPodcastByRecommendationId: Object.fromEntries(podcasts)
  },
  getValidatedPodcastSimilarityProduct: () => ({
    product: {
      sameSeriesResults: [{ recommendationId: "same-series" }],
      manualSupplementaryResults: [
        { recommendationId: "manual-false" },
        { recommendationId: "manual-danger" }
      ],
      automaticSimilarResults: [
        { recommendationId: "manual-false" },
        { recommendationId: "automatic-love" },
        { recommendationId: "automatic-swipe" }
      ]
    }
  }),
  getPodcastKey: (podcast) => podcast?.id || "",
  matchesExploreFilters: () => true,
  getExplorePodcastStats: () => ({})
};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}; globalThis.selectItems = getExploreProductSimilarityItems;`, context);

const selected = context.selectItems(
  { podcast: podcasts.get("source") },
  { limit: 5 }
);
assert.deepEqual(
  Array.from(selected, (item) => item.podcast.id),
  ["same-series", "manual-false", "manual-danger", "automatic-love", "automatic-swipe"]
);
assert.ok(!selected.some((item) => item.podcast.id === "source"));
assert.equal(new Set(selected.map((item) => item.podcast.id)).size, selected.length);

const productPayload = JSON.parse(
  await readFile(new URL("../data/podcast-similarity-product-v1.3.json", import.meta.url), "utf8")
);
const relationshipSource = Object.values(productPayload.results).find(
  (result) => result.title === "I et forhold med"
);
assert.ok(relationshipSource, "I et forhold med must be present in the product data.");

const realCandidates = [
  ...relationshipSource.sameSeriesResults,
  ...relationshipSource.manualSupplementaryResults,
  ...relationshipSource.automaticSimilarResults
];
context.state.podcastSimilarityPodcastByRecommendationId = Object.fromEntries([
  [
    relationshipSource.recommendationId,
    { id: relationshipSource.recommendationId, title: relationshipSource.title }
  ],
  ...realCandidates.map((candidate) => [
    candidate.recommendationId,
    { id: candidate.recommendationId, title: candidate.title }
  ])
]);
context.getValidatedPodcastSimilarityProduct = () => ({ product: relationshipSource });

const relationshipSelection = context.selectItems(
  {
    podcast: context.state.podcastSimilarityPodcastByRecommendationId[
      relationshipSource.recommendationId
    ]
  },
  { limit: 4 }
);
const relationshipTitles = Array.from(relationshipSelection, (item) => item.podcast.title);
assert.ok(relationshipTitles.includes("Det falske match"));
assert.ok(relationshipTitles.includes("Et farligt match"));
assert.ok(
  relationshipTitles.indexOf("Det falske match") < relationshipTitles.indexOf("Operation Romeo") ||
    !relationshipTitles.includes("Operation Romeo")
);
assert.ok(
  relationshipTitles.indexOf("Et farligt match") < relationshipTitles.indexOf("Operation Romeo") ||
    !relationshipTitles.includes("Operation Romeo")
);

console.log("Recommendation priority test passed.");
