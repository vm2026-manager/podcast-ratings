import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyManualCatalogueMetadataOverrides, loadManualCatalogueMetadataRegistry } from "./manual-catalogue-metadata.mjs";
import { partitionSheetPodcastRows, validateCatalogueIntake } from "./catalogue-intake.mjs";
import { createCatalogueId, preserveCatalogueIdsByPodcastId } from "./sync-sheet-data.mjs";
import { validatePodcastIdentityContinuity } from "./podcast-identity-integrity.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const published = JSON.parse(readFileSync(path.join(root, "data/podcasts.json"), "utf8")).rows
  .filter((row) => row["Podcast-ID"] !== "krigen i bosnien");
const registry = loadManualCatalogueMetadataRegistry(root);
const bosnia = registry.overrides.find((entry) => entry.podcastId === "krigen i bosnien");
assert.ok(bosnia, "the exact Bosnien ID has one explicit metadata override");
assert.equal(registry.overrides.filter((entry) => entry.podcastId === "krigen i bosnien").length, 1);
assert.equal(createHash("sha256").update(readFileSync(path.join(root, bosnia.sourcePath))).digest("hex"), bosnia.sourceSha256);

const candidate = {
  "Podcast-ID": "krigen i bosnien",
  Titel: "Krigen i Bosnien",
  "Vært": "Frederik Gabrielsson",
  Udgiver: "Politiken",
  Hovedserie: "Flashback",
  Genre: "Historie",
  "Kort beskrivelse": "Politikens journalist Nils Thorsen oplever Bosnienkrigen på nærmeste hold.",
  "Billedlink": "",
  Link: "",
  Feed: "",
  "Adgang": "Betaling",
  "Kilde": "Politiken / Flashback",
  "Tjekket dato": "2026-11-11",
  Episoder: "Krigen i Bosnien (1:2): Flugten fra Sarajevo; Krigen i Bosnien (2:2): Rygtet om en dødslejr"
};
const sheetRows = [candidate];
const enriched = applyManualCatalogueMetadataOverrides({ sheetRows, publishedRows: published, registry, root });
assert.equal(candidate.Link, "", "the override does not mutate its Sheet source row");
assert.equal(candidate.Billedlink, "", "the override does not mutate its Sheet source row");
assert.equal(enriched.length, 1);
assert.equal(enriched[0].Link, "https://politiken.dk/podcast/Flashback/");
assert.equal(enriched[0].Billedlink, bosnia.sourcePath);
assert.equal(enriched[0]["Podcast-ID"], "krigen i bosnien");
assert.equal(enriched[0].Titel, candidate.Titel);
assert.equal(enriched[0].Vært, candidate.Vært);
assert.equal(enriched[0].Udgiver, candidate.Udgiver);
assert.equal(enriched[0].Hovedserie, "Flashback");
assert.equal(enriched[0].Adgang, "Betaling");
assert.equal(enriched[0].Episoder, candidate.Episoder);

const partition = partitionSheetPodcastRows(enriched, published);
assert.equal(partition.intakeRows.filter((row) => row.declaredPodcastId === bosnia.podcastId).length, 0, "the enriched row passes normal new-catalogue partitioning");
assert.equal(partition.publishableRows.filter((row) => row["Podcast-ID"] === bosnia.podcastId).length, 1);
const intakeValidation = validateCatalogueIntake({
  publishedRows: published,
  candidateRows: [...published, ...partition.publishableRows],
  intakeCandidates: partition.intakeRows
});
assert.equal(intakeValidation.ok, true, JSON.stringify(intakeValidation.errors));

const linkSource = published.filter((row) => row["Podcast-ID"] === "flashback politiken");
assert.equal(linkSource.length, 1);
assert.equal(linkSource[0].Link, bosnia.metadata.Link, "the assigned link is the existing Flashback parent link");
const flashbackIds = new Set(published.map((row) => row["Podcast-ID"]));
for (const id of ["flashback politiken", "tsunamien i 2004", "em i 1992"]) assert.ok(flashbackIds.has(id));
assert.equal(published.filter((row) => row["Podcast-ID"] === bosnia.podcastId).length, 0, "the new ID is not already published");

const makeMismatch = (field, value) => {
  const rows = [{ ...candidate, [field]: value }];
  assert.throws(() => applyManualCatalogueMetadataOverrides({ sheetRows: rows, publishedRows: published, registry, root }), /identity conflict/u, `${field} mismatch blocks metadata enrichment`);
};
makeMismatch("Titel", "Krigen i Bosnia");
makeMismatch("Vært", "En anden vært");
makeMismatch("Udgiver", "En anden udgiver");
makeMismatch("Hovedserie", "En anden serie");

const wrongId = [{ ...candidate, "Podcast-ID": "krigen bosnien" }];
const wrongIdOutput = applyManualCatalogueMetadataOverrides({ sheetRows: wrongId, publishedRows: published, registry, root });
assert.equal(wrongIdOutput[0].Link, "", "no title/fuzzy lookup applies the registered metadata to a different ID");
assert.equal(wrongIdOutput[0].Billedlink, "");
assert.equal(partitionSheetPodcastRows(wrongIdOutput, published).intakeRows.length, 1, "the wrong ID remains blocked in normal intake");
const titleCollisionPublished = [...published, { ...candidate, "Podcast-ID": "other bosnien id", catalogue_id: "catalogue-v1-other-bosnien" }];
const titleCollision = partitionSheetPodcastRows(wrongIdOutput, titleCollisionPublished).intakeRows[0];
assert.ok(titleCollision.issues.some((issue) => issue.code === "exact-title-matches-published-record"), "exact title collision remains blocked without ID matching");

const badChecksumRegistry = structuredClone(registry);
badChecksumRegistry.overrides[0].sourceSha256 = "0".repeat(64);
assert.throws(() => applyManualCatalogueMetadataOverrides({ sheetRows: [candidate], publishedRows: published, registry: badChecksumRegistry, root }), /outside the explicitly approved|checksum mismatch/u);
assert.throws(() => applyManualCatalogueMetadataOverrides({ sheetRows: [candidate], publishedRows: published, registry, root: path.join(root, ".missing-test-root") }), /ENOENT/u);
const badLinkSourceRegistry = structuredClone(registry);
badLinkSourceRegistry.overrides[0].metadata.Link = "https://example.test/unverified/episode";
assert.throws(() => applyManualCatalogueMetadataOverrides({ sheetRows: [candidate], publishedRows: published, registry: badLinkSourceRegistry, root }), /verified Flashback parent/u);
const duplicateIdRows = [candidate, { ...candidate }];
assert.throws(() => applyManualCatalogueMetadataOverrides({ sheetRows: duplicateIdRows, publishedRows: published, registry, root }), /Duplicate exact Podcast-ID/u);
const publishedCollision = [...published, { ...candidate, Titel: "Different programme", catalogue_id: "catalogue-v1-collision" }];
assert.throws(() => applyManualCatalogueMetadataOverrides({ sheetRows: [candidate], publishedRows: publishedCollision, registry, root }), /collides with a published identity/u);

const otherIncomplete = { "Podcast-ID": "another new id", Titel: "Another new show", Udgiver: "Example", Genre: "Historie", "Kort beskrivelse": "Description", Link: "", Feed: "", Billedlink: "" };
const mixed = applyManualCatalogueMetadataOverrides({ sheetRows: [candidate, otherIncomplete], publishedRows: published, registry, root });
const mixedPartition = partitionSheetPodcastRows(mixed, published);
assert.equal(mixedPartition.publishableRows.filter((row) => row["Podcast-ID"] === bosnia.podcastId).length, 1);
assert.equal(mixedPartition.intakeRows.filter((row) => row.declaredPodcastId === "another new id").length, 1, "no general exception is added for other incomplete rows");

const duplicateCatalogueIds = new Set(published.map((row) => row.catalogue_id));
assert.equal(duplicateCatalogueIds.size, published.length);
const generatedCatalogueId = createCatalogueId({ title: candidate.Titel, host: candidate.Vært, publisher: candidate.Udgiver, link: enriched[0].Link, feed: "" });
assert.match(generatedCatalogueId, /^catalogue-v1-[a-f0-9]{8}$/u);
assert.equal(duplicateCatalogueIds.has(generatedCatalogueId), false, "Bosnien receives a unique catalogue_id");
assert.equal(createCatalogueId({ title: candidate.Titel, host: candidate.Vært, publisher: candidate.Udgiver, link: enriched[0].Link, feed: "" }), generatedCatalogueId, "repeat sync generates the same catalogue_id");
const firstPublish = { ...enriched[0], catalogue_id: generatedCatalogueId };
const laterApprovedSheetRow = { ...firstPublish, Link: "https://politiken.dk/podcast/Flashback/", Billedlink: "https://example.test/approved-cover.jpg" };
const laterSheetPriority = applyManualCatalogueMetadataOverrides({ sheetRows: [laterApprovedSheetRow], publishedRows: published, registry, root });
assert.equal(laterSheetPriority[0].Link, laterApprovedSheetRow.Link, "a complete Sheet link takes priority over the local fill");
assert.equal(laterSheetPriority[0].Billedlink, laterApprovedSheetRow.Billedlink, "a complete Sheet image takes priority over the local fill");
const laterWithStableIdentity = preserveCatalogueIdsByPodcastId([laterApprovedSheetRow], [firstPublish]);
assert.equal(laterWithStableIdentity[0].Billedlink, laterApprovedSheetRow.Billedlink, "a complete Sheet image takes priority over the local fill");
assert.equal(laterWithStableIdentity[0].catalogue_id, generatedCatalogueId, "the existing catalogue identity remains stable");

const integrity = validatePodcastIdentityContinuity({ previousRows: published, candidateRows: [...published, firstPublish], minimumCandidateRows: 1000 });
assert.equal(integrity.ok, true, JSON.stringify(integrity.errors));
assert.equal(integrity.totals.newlyUnresolvedRatedPodcastKeys, 0);
console.log("Manual Bosnien metadata override exact identity, source, normal intake, Flashback, collision, priority, and ID continuity PASS.");
