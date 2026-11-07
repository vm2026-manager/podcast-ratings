import { readFile } from "node:fs/promises";
import { appendDrCandidatesToStaging, assertStagingWriteGate, StagingSheetsApiClient } from "./google-sheets-staging.mjs";
import { VERIFIED_DR_SERIES_METADATA } from "./verified-dr-series-metadata.mjs";
import { TYRAN_BASELINE } from "./tyran-auto-discovery.mjs";

const write = process.argv.includes("--write");
if (write) assertStagingWriteGate();

const registryPaths = ["data/auto-discovered-bakspejl.json", "data/auto-discovered-djaevlen.json"];
const registries = await Promise.all(registryPaths.map(async (path) => JSON.parse(await readFile(path, "utf8"))));
const allRecords = registries.flatMap((registry) => registry.records || []);
const drCandidates = allRecords.filter((record) => VERIFIED_DR_SERIES_METADATA[record.podcast_id] ||
  (record.source_episode_guid && record.source_url && record.source_description));
const tyranRegistry = JSON.parse(await readFile("data/auto-discovered-tyran.json", "utf8"));
if (tyranRegistry.version !== 1 || !Array.isArray(tyranRegistry.records) || tyranRegistry.baseline_published_at !== TYRAN_BASELINE) {
  throw new Error("Tyran staging requires the exact verified registry version and baseline");
}
const tyranCandidates = tyranRegistry.records;
const candidates = [...drCandidates, ...tyranCandidates];
const skippedWithoutOfficialFullEpisodeSource = allRecords.length - drCandidates.length;

if (!write) {
  if (process.env.GOOGLE_ACCESS_TOKEN && process.env.GOOGLE_DR_STAGING_SHEET_ID) {
    const client = new StagingSheetsApiClient({
      accessToken: process.env.GOOGLE_ACCESS_TOKEN,
      spreadsheetId: process.env.GOOGLE_DR_STAGING_SHEET_ID
    });
    const result = await appendDrCandidatesToStaging({ client, candidates, dryRun: true, allowHostUpdates: false });
    console.log(JSON.stringify({ mode: "dry-run", productionWrites: false, stagingPreflight: "passed", skippedWithoutOfficialFullEpisodeSource, ...result }));
  } else {
    console.log(JSON.stringify({ mode: "dry-run", productionWrites: false, stagingPreflight: "skipped-no-staging-credentials", candidates: candidates.length, skippedWithoutOfficialFullEpisodeSource }));
  }
} else {
  const client = new StagingSheetsApiClient({
    accessToken: process.env.GOOGLE_ACCESS_TOKEN,
    spreadsheetId: process.env.GOOGLE_DR_STAGING_SHEET_ID
  });
  const result = await appendDrCandidatesToStaging({ client, candidates, dryRun: false, allowHostUpdates: false });
  console.log(JSON.stringify({ mode: "staging-append", productionWrites: false, skippedWithoutOfficialFullEpisodeSource, ...result }));
}
