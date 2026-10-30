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
  const proposedGenres = [row.proposedPrimary, row.proposedSecondary, row.proposedTertiary].filter(Boolean);
  assert.equal(new Set(proposedGenres.map((genre) => genre.normalize("NFKC").toLocaleLowerCase("da-DK"))).size, proposedGenres.length, row.podcastId + " proposed genre slots never repeat after case-insensitive canonicalization");
}
const reportById = new Map(report.records.map((row) => [row.podcastId, row]));
const approvedFinanceIds = ["bliv rigere", "børsen investor", "aktieuniverset", "millionærklubben", "store penge", "børssnak", "børsen brænder", "børsen morgenbriefing", "det der tæller", "finansministeriet forklarer", "makropuls howden", "boraghi og pengedoktoren", "morgennyheder", "lyn analyse", "den lyse side", "big picture", "sorte tal"];
assert.deepEqual([reportById.get("genialos").proposedPrimary, reportById.get("genialos").proposedSecondary, reportById.get("genialos").proposedTertiary].filter(Boolean), ["Viden"], "Genialos replaces Snakke with one Viden position and does not duplicate its existing secondary genre");
assert.ok(reportById.get("genialos").proposedTopics.includes("Snakke"), "Genialos keeps its replaced historical label searchable as a topic");
assert.equal(reportById.get("se og hor lige her").status, "Ingen ændring foreslået", "prior review holds the historical Sladder label");
assert.equal(reportById.get("se og hor lige her").proposedPrimary, "Sladder");
assert.ok(reportById.get("se og hor lige her").currentTopics.some((topic) => topic.toLocaleLowerCase("da-DK") === "sladder"));
for (const id of ["i selskab med q", "shop21 dk bitcoin samfund frihed", "darligt nyt fra østfronten"]) {
  assert.notEqual(reportById.get(id).status, "Afventer redaktionel godkendelse", id + " is already completed and is not proposed again");
  assert.match(reportById.get(id).priorAuditDisposition, /Previously approved and completed/u);
}
for (const id of approvedFinanceIds) {
  const row = reportById.get(id);
  assert.ok(row, id + " is present in the current catalogue");
  assert.notEqual(row.status, "Afventer redaktionel godkendelse", id + " was approved and published in the separate Finance batch");
  assert.equal(row.currentPrimary, "Finans", id + " keeps the published primary genre");
  assert.match(row.priorDecisionSource, /issue #383 and merged PR #388/u);
}
assert.equal(summary.historicalAuditReconciliation.earlierAuditProposalCount, 136);
assert.equal(summary.historicalAuditReconciliation.pendingEarlierAuditAfterThreeCompleted, 133);
assert.equal(summary.historicalAuditReconciliation.completedDecisionsNamedInIssue376.length, 3);
assert.deepEqual(summary.historicalAuditReconciliation.separateApprovedFinanceBatchIssue383Pr388.sort(), approvedFinanceIds.slice().sort());
assert.match(summary.historicalAuditReconciliation.overlapBetweenFinanceBatchAnd136RowList, /Unresolved/u);
assert.equal(summary.historicalAuditReconciliation.currentMachineProposalCountBeforeHistoricalHold, 27);
assert.equal(summary.historicalAuditReconciliation.currentMachineProposalCountAfterHistoricalHold, summary.proposals.total);
assert.ok(summary.historicalAuditReconciliation.limitation.includes("not versioned"));
assert.ok(report.reconciliationRows.some((row) => row["Podcast-ID"] === "se og hor lige her" && row.Kategori.includes("historisk label")));
assert.equal(summary.reviewCategories.wellSupportedChanges, 0, "without reverified publisher evidence, no automated change is labeled well-supported");
assert.equal(summary.reviewCategories.uncertainChanges, summary.proposals.total);
assert.equal(summary.blockedReviewGroups.reduce((sum, group) => sum + group.count, 0), summary.proposals.blocked);
assert.ok(summary.blockedReviewGroups.every((group) => group.assessment.includes("not proof of misclassification")));
assert.equal(Object.values(summary.priorManualReviewCategoryCounts).reduce((sum, count) => sum + count, 0), 9);
assert.equal(summary.priorManualReviewCategoryCounts["Muligt genremismatch — kildeverifikation kræves"] + summary.priorManualReviewCategoryCounts["Muligt genremismatch — satire/underholdning skal afstemmes"] + summary.priorManualReviewCategoryCounts["Muligt genremismatch — True Crime-outlier skal verificeres"], 5);
assert.equal(summary.blockedReviewGroups.reduce((sum, group) => sum + group.priorManualReviewCount, 0), 1, "historical manual flags are separated from the 158 evidence-blocked records");
for (const row of report.records) {
  assert.equal(Object.hasOwn(row, "Vuring (1-10)"), false);
  assert.equal(Object.hasOwn(row, "userRatings"), false);
  assert.equal(Object.hasOwn(row, "bookmarks"), false);
  assert.equal(Object.hasOwn(row, "episodeIds"), false);
}
const csv = await readFile(path.join(outputDirectory, "full-catalogue.csv"), "utf8");
assert.equal((csv.match(/\r\n/gu) || []).length, summary.rows + 1);
assert.match(await readFile(path.join(outputDirectory, "catalogue-quality-report.md"), "utf8"), /Ark1 række 1339, Krig/u);
assert.match(await readFile(path.join(outputDirectory, "catalogue-quality-report.md"), "utf8"), /Afstemning mod issue #376/u);
assert.ok((await readFile(path.join(outputDirectory, "historical-audit-reconciliation.csv"), "utf8")).includes("darligt nyt fra østfronten"));
assert.ok((await readFile(path.join(outputDirectory, "blocked-review-groups.csv"), "utf8")).includes("Insufficient evidence"));
assert.ok((await readFile(path.join(outputDirectory, "technical-metadata-review.csv"), "utf8")).includes("Podcast-ID"));
await rm(outputDirectory, { recursive: true, force: true });
console.log("Full read-only catalogue quality report passed identity, coverage, source-class, privacy, and intake assertions.");
