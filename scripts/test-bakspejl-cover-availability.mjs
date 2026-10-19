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
const autoRegistry = await readJson("data/auto-discovered-bakspejl.json");
const autoRecords = new Map();
for (const record of autoRegistry.records || []) {
  const id = String(record.podcast_id || "");
  assert.ok(id && !autoRecords.has(id), `Duplicate auto-discovered Bakspejl ID: ${id}`);
  autoRecords.set(id, record);
}

// Only exact, verified DR auto-discoveries may use their official cover URL
// instead of a manually registered local Bakspejl cover.
function hasVerifiedDrAutoCover(row) {
  const id = String(row["Podcast-ID"] || "").trim();
  if (!/^bakspejl-auto-v1-[a-f0-9]{8}$/u.test(id)) return false;
  const record = autoRecords.get(id);
  if (!record || row.Titel !== record.title || record.hovedserie !== "Bakspejl" ||
      row.Hovedserie !== "Bakspejl" || row.Udgiver !== "DR" ||
      record.publisher !== "DR" || row.Billedlink !== record.cover) return false;
  try {
    const url = new URL(row.Billedlink);
    return url.protocol === "https:" && url.hostname === "api.dr.dk" &&
      url.pathname.startsWith("/podcasts/v1/images/urn:dr:podcast:image:") &&
      !url.search && !url.hash;
  } catch {
    return false;
  }
}

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
  if (!entry) {
    assert.ok(hasVerifiedDrAutoCover(row), `${title}: missing a manifest entry or verified DR auto-cover.`);
    continue;
  }
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

// Regression coverage for every identity and trust boundary in the fallback.
for (const record of autoRegistry.records || []) {
  const accepted = {
    Titel: record.title,
    "Podcast-ID": record.podcast_id,
    Hovedserie: "Bakspejl",
    Udgiver: "DR",
    Billedlink: record.cover
  };
  assert.ok(hasVerifiedDrAutoCover(accepted), `${record.title}: verified DR cover rejected.`);
  for (const forged of [
    { ...accepted, "Podcast-ID": "bakspejl-auto-v1-00000000" },
    { ...accepted, "Podcast-ID": "manual-podcast-id" },
    { ...accepted, Titel: "Another title" },
    { ...accepted, Hovedserie: "Djævlen i detaljen" },
    { ...accepted, Udgiver: "Other" },
    { ...accepted, Billedlink: "https://example.com/fake.jpg" },
    { ...accepted, Billedlink: "http://api.dr.dk/podcasts/v1/images/urn:dr:podcast:image:test.jpg" },
    { ...accepted, Billedlink: `${record.cover}?redirect=https://example.com/fake.jpg` },
    { ...accepted, Billedlink: `${record.cover}#untrusted` },
    { ...accepted, Billedlink: "" }
  ]) {
    assert.equal(hasVerifiedDrAutoCover(forged), false, `${record.title}: unsafe auto-cover fallback.`);
  }
}

console.log(`Bakspejl local-cover availability passed for ${bakspejlRows.length} current catalogue rows.`);
