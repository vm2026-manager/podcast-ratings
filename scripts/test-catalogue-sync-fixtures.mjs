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

  const published = JSON.parse(await readFile(path.join(root, "data/podcasts.json"), "utf8"));
  const existingCoverRow = published.rows.find((row) => row["Podcast-ID"] && /^data\/covers\//u.test(row.Billedlink || ""));
  assert.ok(existingCoverRow, "published catalogue has an identified local cover to preserve");
  const existingCoverBytes = await readFile(path.join(root, existingCoverRow.Billedlink));
  const sourceRow = {
    Titel: existingCoverRow.Titel,
    "Podcast-ID": existingCoverRow["Podcast-ID"],
    Billedlink: `data:image/${path.extname(existingCoverRow.Billedlink).slice(1) === "jpg" ? "jpeg" : path.extname(existingCoverRow.Billedlink).slice(1)};base64,${existingCoverBytes.toString("base64")}`
  };
  const [preservedCoverRow] = await slimPodcastRows([sourceRow], stageName, [existingCoverRow]);
  assert.equal(preservedCoverRow.Billedlink, existingCoverRow.Billedlink, "unchanged cover bytes keep the published path despite placement changes");
  assert.deepEqual(await readFile(path.join(stagePath, preservedCoverRow.Billedlink)), existingCoverBytes);

  const changedSourceRow = { ...sourceRow, Billedlink: "data:image/png;base64,Y2hhbmdlZA==" };
  if (path.extname(existingCoverRow.Billedlink) !== ".png") {
    changedSourceRow.Billedlink = `data:image/${path.extname(existingCoverRow.Billedlink).slice(1)};base64,Y2hhbmdlZA==`;
  }
  await assert.rejects(
    slimPodcastRows([changedSourceRow], stageName, [existingCoverRow]),
    /Cover bytes changed without verified source\/variant provenance/u,
    "changed cover bytes cannot silently replace a published variant"
  );
  await assert.rejects(
    slimPodcastRows([sourceRow], stageName, [{ ...existingCoverRow, Billedlink: "data/covers/../unsafe.png" }]),
    /Cannot safely preserve published cover path/u,
    "unsafe published asset paths are rejected"
  );
  await assert.rejects(
    slimPodcastRows([sourceRow, sourceRow], stageName, [existingCoverRow]),
    /Cannot generate duplicate Podcast-ID/u,
    "duplicate candidate Podcast-IDs are rejected"
  );
} finally {
  await rm(stagePath, { recursive: true, force: true });
}

console.log("Catalogue sync fixtures passed: Bryllupsgæsterne, supplementary similarities, and isolated cover staging.");
