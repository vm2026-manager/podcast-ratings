import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCurrentProduct } from "./build-current-podcast-similarity-product-v1.3.mjs";

const podcastPayload = JSON.parse(
  fs.readFileSync("data/podcasts.json", "utf8").replace(/^\uFEFF/, "")
);
const committedProduct = JSON.parse(
  fs.readFileSync("data/podcast-similarity-product-v1.3.json", "utf8").replace(/^\uFEFF/, "")
);
const rebuiltProduct = buildCurrentProduct();
const catalogIds = new Set(podcastPayload.rows.map((podcast) => podcast["Podcast-ID"]));

assert.equal(rebuiltProduct.sourceCount, catalogIds.size);
assert.equal(Object.keys(rebuiltProduct.results).length, catalogIds.size);
assert.ok(
  Object.values(rebuiltProduct.results).some((row) => row.existingId === "fjernsynsklubben"),
  "fjernsynsklubben must be present in the generated product"
);
assert.deepEqual(
  committedProduct,
  rebuiltProduct,
  "the committed product must exactly match a rebuild from the current catalogue"
);

console.log("Current-catalogue similarity product tests passed.");
