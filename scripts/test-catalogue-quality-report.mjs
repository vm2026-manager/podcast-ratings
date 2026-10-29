import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_GENRES } from "./catalogue-intake.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "catalogue-quality-report-"));
const protectedPaths = ["data/podcasts.json", "data/podcast-episodes.json", "data/auto-discovered-bakspejl.json", "data/auto-discovered-djaevlen.json"];
const beforeHashes = new Map(await Promise.all(protectedPaths.map(async (relative) => {
  const bytes = await readFile(path.join(root, relative));
  return [relative, createHash("sha256").update(bytes).digest("hex")];
})));
const run = spawnSync(process.execPath, ["scripts/catalogue-quality-audit.mjs", outputDirectory], { cwd: root, encoding: "utf8" });
assert.equal(run.status, 0, run.stderr || run.stdout);
for (const [relative, expectedHash] of beforeHashes) {
  const bytes = await readFile(path.join(root, relative));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedHash, relative + " is read-only during report generation");
}
const report = JSON.parse(await readFile(path.join(outputDirectory, "catalogue-quality-report.json"), "utf8"));
const summary = report.summary;
const catalogue = JSON.parse(await readFile(path.join(root, "data/podcasts.json"), "utf8"));
const autoSources = [
  JSON.parse(await readFile(path.join(root, "data/auto-discovered-bakspejl.json"), "utf8")),
  JSON.parse(await readFile(path.join(root, "data/auto-discovered-djaevlen.json"), "utf8"))
];
const autoIds = new Set(autoSources.flatMap((source) => (source.records || []).map((record) => record.podcast_id)));
assert.equal(summary.rows, catalogue.rows.length, "the report count follows the current catalogue");
assert.equal(summary.uniquePodcastIds, catalogue.rows.length);
assert.equal(summary.missingPodcastIds, 0);
assert.equal(summary.duplicatePodcastIds, 0);
assert.equal(summary.uniqueCatalogueIds, catalogue.rows.length);
assert.equal(summary.missingCatalogueIds, 0);
assert.equal(summary.duplicateCatalogueIds, 0);
assert.equal(summary.crossFieldIdentityConflicts, 0);
assert.deepEqual(summary.canonicalGenres, CANONICAL_GENRES);
assert.equal(report.records.length, summary.rows, "the report contains one row per catalogue record");
assert.equal(new Set(report.records.map((row) => row.podcastId)).size, summary.rows, "the report uses unique Podcast-ID values");
assert.equal(summary.sourceOwnershipCounts["DR-auto"], catalogue.rows.filter((row) => autoIds.has(row["Podcast-ID"])).length);
assert.equal(summary.sourceOwnershipCounts["Historisk bevaret identitet"], 1);
assert.ok(report.records.some((row) => row.podcastId === "flashback politiken" && row.sourceClass === "Historisk bevaret identitet"));
assert.equal(report.records.filter((row) => row.currentPrimary === "Krig").length, catalogue.rows.filter((row) => row.Genre === "Krig").length);
assert.ok(report.records.some((row) => row.legacySearchPreservation.toLocaleLowerCase("da-DK") === "sladder"));
assert.ok(report.records.every((row) => [row.currentPrimary, row.currentSecondary, row.currentTertiary].filter(Boolean).length <= 3 || row.genreIssues.includes("more-than-three-genres")));
for (const row of report.records) {
  assert.equal(Object.hasOwn(row, "Vuring (1-10)"), false);
  assert.equal(Object.hasOwn(row, "userRatings"), false);
  assert.equal(Object.hasOwn(row, "bookmarks"), false);
  assert.equal(Object.hasOwn(row, "episodeIds"), false);
}
const csv = await readFile(path.join(outputDirectory, "full-catalogue.csv"), "utf8");
assert.equal((csv.match(/\r\n/gu) || []).length, summary.rows + 1);
assert.match(await readFile(path.join(outputDirectory, "catalogue-quality-report.md"), "utf8"), /Ark1 række 1339, Krig/u);
await rm(outputDirectory, { recursive: true, force: true });
console.log("Full read-only catalogue quality report passed identity, coverage, source-class, privacy, and intake assertions.");
