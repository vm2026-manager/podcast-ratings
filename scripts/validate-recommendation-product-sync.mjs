import fs from "node:fs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function fail(message) {
  throw new Error(`Recommendation product invariant failed: ${message}`);
}

const podcastPayload = readJson("data/podcasts.json");
const podcasts = podcastPayload.rows;
const metadata = readJson("data/recommendation-metadata.json");
const product = readJson("data/podcast-similarity-product-v1.3.json");
const catalogIds = new Set(podcasts.map((podcast) => podcast["Podcast-ID"]));

if (catalogIds.size !== podcasts.length) fail("catalogue Podcast-ID values are not unique");
if (metadata.rows.length !== podcasts.length) {
  fail(`metadata rows ${metadata.rows.length} != catalogue rows ${podcasts.length}`);
}
if (product.sourceCount !== catalogIds.size) fail(`sourceCount ${product.sourceCount} != ${catalogIds.size}`);

const sources = Object.values(product.results || {});
if (sources.length !== catalogIds.size) fail(`result sources ${sources.length} != ${catalogIds.size}`);
for (const source of sources) {
  const sourceId = source.existingId;
  if (!catalogIds.has(sourceId)) fail(`stale result source ${sourceId}`);
  for (const field of ["sameSeriesResults", "manualSupplementaryResults", "automaticSimilarResults", "combinedSimilarResults"]) {
    const seen = new Set();
    for (const candidate of source[field] || []) {
      const id = candidate.existingId;
      if (!catalogIds.has(id)) fail(`${sourceId} has unknown ${field} reference ${id}`);
      if (id === sourceId) fail(`${sourceId} has self-reference in ${field}`);
      if (seen.has(id)) fail(`${sourceId} has duplicate ${field} reference ${id}`);
      seen.add(id);
    }
  }
}

console.log(JSON.stringify({ catalogue: catalogIds.size, metadata: metadata.rows.length, sourceCount: product.sourceCount }));
