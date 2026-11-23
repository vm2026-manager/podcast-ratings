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

const borgenIds = ["borgen unplugged", "borgen unplugged 2 0"];
const previousMetadata = process.argv[2] ? readJson(process.argv[2]) : null;
const borgenMetadata = borgenIds.map((id) => {
  const matches = metadata.rows.filter((row) => row.id === id);
  if (matches.length !== 1) fail(`expected one recommendation metadata row for ${id}`);
  const [row] = matches;
  if (product.results[row.recommendationId]?.existingId !== id) {
    fail(`recommendation product points outside ${id}`);
  }
  if (previousMetadata) {
    const previous = previousMetadata.rows.filter((entry) => entry.id === id);
    if (previous.length !== 1 || previous[0].recommendationId !== row.recommendationId) {
      fail(`recommendationId changed for ${id}`);
    }
  }
  return row;
});
if (borgenMetadata[0].title === borgenMetadata[1].title) {
  for (const [index, source] of borgenMetadata.entries()) {
    const target = borgenMetadata[1 - index];
    if (!product.results[source.recommendationId].manualSupplementaryResults.some(
      (candidate) => candidate.existingId === target.id && candidate.recommendationId === target.recommendationId
    )) fail(`missing explicit Borgen recommendation from ${source.id} to ${target.id}`);
  }
}

console.log(JSON.stringify({ catalogue: catalogIds.size, metadata: metadata.rows.length, sourceCount: product.sourceCount }));
