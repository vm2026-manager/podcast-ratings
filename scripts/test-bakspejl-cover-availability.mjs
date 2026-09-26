import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (relativePath) => JSON.parse(
  await readFile(path.join(root, relativePath), "utf8")
);
const localPathExists = (relativePath) => (
  typeof relativePath === "string"
  && relativePath.length > 0
  && existsSync(path.join(root, relativePath))
);

const catalogue = await readJson("data/podcasts.json");
const manifest = await readJson("data/podcast-cover-manifest.json");
const bakspejlRows = (catalogue.rows || []).filter((row) => row.Hovedserie === "Bakspejl");
const entriesBySignature = new Map(
  (manifest.podcasts || []).map((entry) => [
    `${entry.title}\u0000${entry.host}\u0000${entry.publisher}`,
    entry
  ])
);

assert.ok(bakspejlRows.length > 0, "Current catalogue must contain Bakspejl entries.");

for (const row of bakspejlRows) {
  const title = String(row.Titel || "");
  const entry = entriesBySignature.get(`${title}\u0000${String(row["Vært"] || "")}\u0000${String(row.Udgiver || "")}`);
  assert.ok(entry, `${title}: missing a manifest entry.`);
  assert.equal(entry.title, title, `${title}: display identity changed.`);
  if (entry.podcastId !== undefined) {
    assert.equal(entry.podcastId, row["Podcast-ID"], `${title}: canonical Podcast-ID changed.`);
  }
  assert.equal(entry.mainSeries, "Bakspejl", `${title}: series identity changed.`);
  assert.equal(entry.needsPlaceholder, false, `${title}: must not use an initials placeholder.`);
  assert.notEqual(entry.status, "needs_placeholder", `${title}: must have a local cover.`);
  assert.equal(entry.sourceKind, "manual-series", `${title}: must use the registered local Bakspejl source.`);
  assert.equal(entry.manualSeriesOverride, true, `${title}: must register the shared-series override.`);
  assert.ok(localPathExists(entry.manualSeriesSourcePath), `${title}: manual series source is missing.`);
  assert.ok(localPathExists(entry.original?.path), `${title}: localized original is missing.`);
  assert.ok(Object.keys(entry.variants || {}).length > 0, `${title}: must have local variants.`);
  assert.ok(localPathExists(entry.variants?.["480"]?.path), `${title}: local 480px variant is missing.`);
  for (const width of ["800", "1400"]) {
    if (entry.variants?.[width]) {
      assert.ok(localPathExists(entry.variants[width].path), `${title}: local ${width}px variant is missing.`);
    }
  }
}

for (const title of [
  "Katynskovens hemmelighed",
  "Monsteret i Tjernobyl",
  "Den jyske Vietnamveteran"
]) {
  assert.ok(bakspejlRows.some((row) => row.Titel === title), `${title}: required regression case is absent.`);
}

if (bakspejlRows.some((row) => row.Titel === "LA Riots")) {
  assert.ok(
    [...entriesBySignature.values()].some((entry) => entry.title === "LA Riots"),
    "LA Riots: current Bakspejl entry is absent from the manifest."
  );
}

const danishRow = bakspejlRows.find((row) => row.Titel === "Grænsevagten, der væltede Berlinmuren");
if (danishRow) {
  const entry = entriesBySignature.get(`${danishRow.Titel}\u0000${danishRow["Vært"]}\u0000${danishRow.Udgiver}`);
  assert.equal(entry?.title, danishRow.Titel, "ÆØÅ/æøå display identity must be preserved.");
}

console.log(`Bakspejl local-cover availability passed for ${bakspejlRows.length} current catalogue rows.`);
