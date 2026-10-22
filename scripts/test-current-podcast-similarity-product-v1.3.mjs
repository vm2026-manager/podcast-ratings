import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCurrentProduct } from "./build-current-podcast-similarity-product-v1.3.mjs";
import { findJsonDifference } from "./json-semantic-equality.mjs";

const podcastPayload = JSON.parse(
  fs.readFileSync("data/podcasts.json", "utf8").replace(/^\uFEFF/, "")
);
const committedProduct = JSON.parse(
  fs.readFileSync("data/podcast-similarity-product-v1.3.json", "utf8").replace(/^\uFEFF/, "")
);
const rebuiltProduct = buildCurrentProduct();
const catalogIds = new Set(podcastPayload.rows.map((podcast) => podcast["Podcast-ID"]));

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

console.log("Current-catalogue similarity product tests passed.");
