import assert from "node:assert/strict";
import { access, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSupplementarySimilarities, slimPodcastRows } from "./sync-sheet-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stageName = `.catalogue-sync-fixture-${process.pid}`;
const stagePath = path.join(root, stageName);
const rows = [{
  Titel: "Bryllupsgæsterne",
  "Podcast-ID": "bryllupsgaesterne",
  Vært: "Third Ear",
  Udgiver: "Third Ear",
  Link: "https://example.test/bryllupsgasterne",
  Billedlink: "data:image/png;base64,aGVsbG8=",
  "Supplerende ligheder": "Bakspejl; Forbrydelse og straf"
}];

try {
  await mkdir(stagePath, { recursive: true });
  const [podcast] = await slimPodcastRows(rows, stageName);
  assert.equal(podcast.Titel, "Bryllupsgæsterne");
  assert.equal(podcast["Podcast-ID"], "bryllupsgaesterne");
  assert.ok(podcast.catalogue_id, "new catalogue row receives a stable catalogue identity");
  assert.match(podcast.Billedlink, /^data\/covers\//u);
  assert.deepEqual(podcast.supplementarySimilarities, parseSupplementarySimilarities(rows[0]["Supplerende ligheder"]));
  await access(path.join(stagePath, podcast.Billedlink));
  await assert.rejects(access(path.join(root, podcast.Billedlink)));

  const stagedBytes = await readFile(path.join(stagePath, podcast.Billedlink));
  assert.equal(stagedBytes.toString("utf8"), "hello");
} finally {
  await rm(stagePath, { recursive: true, force: true });
}

console.log("Catalogue sync fixtures passed: Bryllupsgæsterne, supplementary similarities, and isolated cover staging.");
