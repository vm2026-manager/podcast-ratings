import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inspectSheetSourceDrift } from "./check-sheet-source-drift.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "catalogue-drift-"));
const files = ["podcasts", "featured-reviews", "explore-clusters"];
const published = {
  "podcasts": { generatedAt: "old", rows: [{ "Podcast-ID": "existing", Titel: "A" }] },
  "featured-reviews": [{ Titel: "Review A" }],
  "explore-clusters": { generatedAt: "old", clusters: [] }
};
const candidate = {
  "podcasts": { generatedAt: "new", rows: [{ "Podcast-ID": "existing", Titel: "A" }, { "Podcast-ID": "bryllupsgaesterne", Titel: "Bryllupsgæsterne" }] },
  "featured-reviews": [{ Titel: "Review A" }],
  "explore-clusters": { generatedAt: "new", clusters: [] }
};

try {
  await mkdir(path.join(root, ".sync", "data"), { recursive: true });
  await mkdir(path.join(root, "data"), { recursive: true });
  for (const file of files) {
    await writeFile(path.join(root, "data", `${file}.json`), JSON.stringify(published[file]));
    await writeFile(path.join(root, ".sync", "data", `${file}.json`), JSON.stringify(candidate[file]));
  }
  const result = await inspectSheetSourceDrift({ root, candidateDirectory: ".sync" });
  assert.equal(result.ok, false);
  assert.deepEqual(result.changedFiles, ["data/podcasts.json"]);
  assert.deepEqual(result.changedPodcastIds, ["bryllupsgaesterne"]);

  await writeFile(path.join(root, ".sync", "data", "podcasts.json"), JSON.stringify({ ...published.podcasts, generatedAt: "different timestamp" }));
  const unchanged = await inspectSheetSourceDrift({ root, candidateDirectory: ".sync" });
  assert.equal(unchanged.ok, true, "generated timestamps alone do not look like Sheet edits");

  await writeFile(path.join(root, ".sync", "data", "featured-reviews.json"), JSON.stringify([{ Titel: "Review B" }]));
  const featuredOnly = await inspectSheetSourceDrift({ root, candidateDirectory: ".sync" });
  assert.deepEqual(featuredOnly.changedFiles, ["data/featured-reviews.json"]);

  await writeFile(path.join(root, ".sync", "data", "featured-reviews.json"), JSON.stringify(published["featured-reviews"]));
  await writeFile(path.join(root, ".sync", "data", "explore-clusters.json"), JSON.stringify({ generatedAt: "new", clusters: [{ id: "cluster-a" }] }));
  const clustersOnly = await inspectSheetSourceDrift({ root, candidateDirectory: ".sync" });
  assert.deepEqual(clustersOnly.changedFiles, ["data/explore-clusters.json"]);
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("Google Sheet source drift detection passed.");
