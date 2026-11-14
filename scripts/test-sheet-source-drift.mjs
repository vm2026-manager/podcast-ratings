import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inspectSheetSourceDrift } from "./check-sheet-source-drift.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "catalogue-drift-"));
const files = ["podcasts", "featured-reviews", "explore-clusters"];
const podcast = {
  "Podcast-ID": "politik for viderekomne med søs og huxi",
  catalogue_id: "catalogue-v1-047662a4",
  Titel: "Politik for viderekomne med Søs & Huxi",
  Genre: "Politik",
  "Kort beskrivelse": "Kort beskrivelse",
  "Vuring (1-10)": "8,5",
  Link: "https://podimo.com/dk/shows/politik-for-viderekomne-med-sos-huxi",
  Feed: "https://open.podimo.com/podcast/3520dd9b-1787-4183-b091-aaa5ebd74a5b",
  Billedlink: "https://example.test/cover.jpg",
  episodeFeedVerification: {
    version: 1,
    status: "review_required",
    podcast_id: "politik for viderekomne med søs og huxi",
    catalogue_id: "catalogue-v1-047662a4",
    feed_url: "https://open.podimo.com/podcast/3520dd9b-1787-4183-b091-aaa5ebd74a5b",
    official_url: "https://podimo.com/dk/shows/politik-for-viderekomne-med-sos-huxi",
    publisher: "Podimo",
    reason: "special_source_requires_adapter"
  }
};
const published = {
  podcasts: { generatedAt: "old", rows: [podcast] },
  "featured-reviews": [{ Titel: "Review A" }],
  "explore-clusters": { generatedAt: "old", clusters: [] }
};

try {
  await mkdir(path.join(root, ".sync", "data"), { recursive: true });
  await mkdir(path.join(root, "data"), { recursive: true });
  const writePayload = async (directory, name, payload) => {
    const dataDirectory = directory === "data" ? path.join(root, directory) : path.join(root, directory, "data");
    return writeFile(path.join(dataDirectory, `${name}.json`), JSON.stringify(payload));
  };
  const writeAll = async (directory, payloads) => {
    for (const file of files) await writePayload(directory, file, payloads[file]);
  };
  const asCandidate = (rows = [podcast], reviews = published["featured-reviews"], clusters = published["explore-clusters"]) => ({
    podcasts: { generatedAt: "new", rows },
    "featured-reviews": reviews,
    "explore-clusters": { ...clusters, generatedAt: "new" }
  });
  const inspect = () => inspectSheetSourceDrift({ root, candidateDirectory: ".sync" });

  await writeAll("data", published);
  await writeAll(".sync", asCandidate([{
    ...podcast,
    episodeFeedVerification: { ...podcast.episodeFeedVerification, reason: "different_pipeline_result", retry_after: "2026-11-14T00:00:00Z" }
  }]));
  const verificationOnly = await inspect();
  assert.equal(verificationOnly.ok, true, "derived feed-verification differences do not look like Sheet edits");
  assert.deepEqual(verificationOnly.changedFiles, []);
  assert.deepEqual(verificationOnly.changedPodcastIds, []);
  assert.equal(podcast.catalogue_id, "catalogue-v1-047662a4", "the published catalogue identity fixture remains exact");

  for (const [field, value] of [
    ["Titel", "Changed title"],
    ["Genre", "Changed genre"],
    ["Kort beskrivelse", "Changed description"],
    ["Vuring (1-10)", "9,0"],
    ["Link", "https://example.test/new-official-link"],
    ["Feed", "https://example.test/new-feed.xml"],
    ["Billedlink", "https://example.test/new-cover.jpg"]
  ]) {
    await writeAll(".sync", asCandidate([{ ...podcast, [field]: value }]));
    const changed = await inspect();
    assert.deepEqual(changed.changedFiles, ["data/podcasts.json"], `${field} changes must remain visible`);
    assert.deepEqual(changed.changedPodcastIds, [podcast["Podcast-ID"]], `${field} changes must identify the exact Podcast-ID`);
  }

  await writeAll(".sync", asCandidate([podcast, { "Podcast-ID": "new podcast", catalogue_id: "catalogue-new", Titel: "New row" }]));
  const added = await inspect();
  assert.deepEqual(added.changedPodcastIds, ["new podcast"]);
  await writeAll(".sync", asCandidate([]));
  const deleted = await inspect();
  assert.deepEqual(deleted.changedPodcastIds, [podcast["Podcast-ID"]]);

  await writeAll(".sync", asCandidate([{ ...podcast, "Podcast-ID": "changed identity" }]));
  const changedId = await inspect();
  assert.deepEqual(changedId.changedPodcastIds, ["changed identity", podcast["Podcast-ID"]].sort());

  await writeAll("data", {
    ...published,
    podcasts: { generatedAt: "old", rows: [podcast, { ...podcast, Titel: "Duplicate identity row" }] }
  });
  await writeAll(".sync", asCandidate([
    podcast,
    { ...podcast, Titel: "Duplicate identity row changed", episodeFeedVerification: undefined }
  ]));
  const duplicateId = await inspect();
  assert.equal(duplicateId.ok, false, "duplicate Podcast-ID rows must not be hidden by the diagnostic map");
  assert.deepEqual(duplicateId.changedPodcastIds, [podcast["Podcast-ID"]]);

  await writeAll("data", published);
  await writeAll(".sync", asCandidate([podcast, { ...podcast, "Podcast-ID": podcast["Podcast-ID"].toUpperCase(), catalogue_id: "catalogue-case-collision" }]));
  const normalizedCollision = await inspect();
  assert.deepEqual(normalizedCollision.changedPodcastIds, [podcast["Podcast-ID"].toUpperCase()]);

  await writeAll(".sync", asCandidate());
  await writePayload(".sync", "featured-reviews", [{ Titel: "Review B" }]);
  const featuredOnly = await inspect();
  assert.deepEqual(featuredOnly.changedFiles, ["data/featured-reviews.json"]);
  assert.deepEqual(featuredOnly.changedPodcastIds, []);

  await writePayload(".sync", "featured-reviews", published["featured-reviews"]);
  await writePayload(".sync", "explore-clusters", { generatedAt: "new", clusters: [{ id: "cluster-a" }] });
  const clustersOnly = await inspect();
  assert.deepEqual(clustersOnly.changedFiles, ["data/explore-clusters.json"]);

  await writeFile(path.join(root, ".sync", "data", "podcasts.json"), "{");
  await assert.rejects(inspect(), SyntaxError, "malformed candidate JSON must fail closed");
  await rm(path.join(root, ".sync", "data", "podcasts.json"));
  await assert.rejects(inspect(), /ENOENT/u, "missing candidate JSON must fail closed");
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("Google Sheet source drift detection passed.");
