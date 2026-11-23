import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCurrentProduct } from "./build-current-podcast-similarity-product-v1.3.mjs";
import { findJsonDifference } from "./json-semantic-equality.mjs";
import { buildRecommendationData } from "./build-recommendation-metadata.mjs";
import { buildSimilarityCatalog, buildSimilarityResultsForCatalog } from "./podcast-similarity-engine-v1.1.mjs";
import { buildProductOutput } from "./build-podcast-similarity-product-v1.3.mjs";

const podcastPayload = JSON.parse(
  fs.readFileSync("data/podcasts.json", "utf8").replace(/^\uFEFF/, "")
);
const committedProduct = JSON.parse(
  fs.readFileSync("data/podcast-similarity-product-v1.3.json", "utf8").replace(/^\uFEFF/, "")
);
const rebuiltProduct = buildCurrentProduct();
const catalogIds = new Set(podcastPayload.rows.map((podcast) => podcast["Podcast-ID"]));
const narkobetjentenGroup = JSON.parse(
  fs.readFileSync("data/podcast-display-groups.json", "utf8")
).groups.find((group) => group.id === "narkobetjenten");
const narkobetjentenIds = new Set(narkobetjentenGroup.memberLegacyKeys);

function compareManualAuditRows(left, right) {
  if (left.sourceRecommendationId < right.sourceRecommendationId) return -1;
  if (left.sourceRecommendationId > right.sourceRecommendationId) return 1;
  return left.position - right.position;
}

assert.equal(rebuiltProduct.sourceCount, catalogIds.size);
assert.equal(Object.keys(rebuiltProduct.results).length, catalogIds.size);
assert.ok(
  Object.values(rebuiltProduct.results).some((row) => row.existingId === "fjernsynsklubben"),
  "fjernsynsklubben must be present in the generated product"
);
assert.ok(catalogIds.has("narkobetjenten pa gaden sæson 1"));
const mainSeriesResults = Object.values(rebuiltProduct.results).filter((result) =>
  narkobetjentenIds.has(result.existingId)
);
assert.ok(mainSeriesResults.length > 0, "the Narkobetjenten seasons remain in the catalogue");
for (const result of mainSeriesResults) {
  for (const section of ["manualSupplementaryResults", "automaticSimilarResults", "sameSeriesResults"]) {
    assert.ok(
      !(result[section] || []).some((candidate) => narkobetjentenIds.has(candidate.existingId)),
      `${result.existingId} cannot recommend an individual main-series season in ${section}`
    );
  }
}
assert.ok(
  Object.values(rebuiltProduct.results).some(
    (result) => result.existingId === "narkobetjenten pa gaden sæson 1"
  ),
  "Narkobetjenten på gaden keeps its distinct catalogue identity"
);
// The audit is a set of source/position records. localeCompare can order ASCII IDs
// differently across ICU versions, so canonicalize only this unordered outer list.
// Each record, its position, and every other product field still compare exactly.
committedProduct.manualReferenceAudit.sort(compareManualAuditRows);
rebuiltProduct.manualReferenceAudit.sort(compareManualAuditRows);
const mismatchPath = findJsonDifference(committedProduct, rebuiltProduct);
assert.equal(
  mismatchPath,
  null,
  mismatchPath
    ? `the committed product must exactly match a rebuild from the current catalogue; first difference: ${mismatchPath}`
    : "the committed product must exactly match a rebuild from the current catalogue"
);

const borgenIds = ["borgen unplugged", "borgen unplugged 2 0"];
const publishedMetadata = JSON.parse(fs.readFileSync("data/recommendation-metadata.json", "utf8"));
const renamedBorgen = {
  rows: borgenIds.map((id) => ({
    ...podcastPayload.rows.find((row) => row["Podcast-ID"] === id),
    Titel: "Borgen Unplugged",
    ...(id === borgenIds[0] ? { Uaktuel: "x" } : {})
  }))
};
const readConfig = (name) => JSON.parse(fs.readFileSync(`config/${name}.json`, "utf8"));
const { payload: borgenMetadata } = buildRecommendationData(
  renamedBorgen,
  readConfig("recommendation-topic-aliases"),
  readConfig("recommendation-genre-mapping"),
  { existingMetadata: publishedMetadata }
);
assert.deepEqual(borgenMetadata.rows.map((row) => row.id), borgenIds);
assert.deepEqual(
  borgenMetadata.rows.map((row) => row.recommendationId),
  borgenIds.map((id) => publishedMetadata.rows.find((row) => row.id === id).recommendationId)
);

const similarityConfig = readConfig("podcast-similarity-engine-v1.1");
const borgenProduct = buildProductOutput(
  renamedBorgen,
  borgenMetadata,
  buildSimilarityResultsForCatalog(buildSimilarityCatalog(borgenMetadata, renamedBorgen), similarityConfig),
  similarityConfig,
  readConfig("podcast-similarity-product-v1.3")
);
for (const [index, source] of borgenMetadata.rows.entries()) {
  const target = borgenMetadata.rows[1 - index];
  const result = borgenProduct.results[source.recommendationId];
  assert.equal(result.existingId, source.id);
  assert.deepEqual(result.manualSupplementaryResults, []);
  assert.ok(borgenProduct.manualReferenceAudit.some((reference) =>
    reference.sourceRecommendationId === source.recommendationId &&
    reference.resolvedRecommendationId === target.recommendationId &&
    reference.status === "resolved_podcast_id"
  ));
}

for (const result of Object.values(rebuiltProduct.results)) {
  for (const section of [
    "manualSupplementaryResults", "automaticSimilarResults", "sameSeriesResults", "combinedSimilarResults", "similarResults"
  ]) {
    if (result.existingId === borgenIds[0]) assert.deepEqual(result[section], []);
    assert.ok(result[section].every((candidate) => candidate.existingId !== borgenIds[0]), section);
  }
}

console.log("Current-catalogue similarity product tests passed.");
