import { readFile } from "node:fs/promises";
import { appendVerifiedDrRows, assertProductionWriteGate, ORIGINAL_SHEET_ID, SheetsApiClient } from "./google-sheets-append.mjs";
import { VERIFIED_DR_SERIES_METADATA } from "./verified-dr-series-metadata.mjs";

const write = process.argv.includes("--write");
if (write) assertProductionWriteGate();

const registryPaths = ["data/auto-discovered-bakspejl.json", "data/auto-discovered-djaevlen.json"];
const registries = await Promise.all(registryPaths.map(async (path) => JSON.parse(await readFile(path, "utf8"))));
const catalogue = JSON.parse(await readFile("data/podcasts.json", "utf8"));
const candidates = registries.flatMap((registry) => registry.records || [])
  .filter((record) => VERIFIED_DR_SERIES_METADATA[record.podcast_id])
  .map((record) => {
    const metadata = VERIFIED_DR_SERIES_METADATA[record.podcast_id];
    const existing = catalogue.rows.find((row) => row["Podcast-ID"] === record.podcast_id);
    return {
      Titel: record.title,
      "Podcast-ID": record.podcast_id,
      Hovedserie: record.hovedserie,
      Billedlink: record.cover || existing?.Billedlink || "",
      Link: metadata.sourceUrl,
      Kilde: metadata.sourceUrl,
      needs_editorial_review: metadata.needsEditorialReview
    };
  });

if (!write) {
  if (process.env.GOOGLE_ACCESS_TOKEN && process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    if (process.env.GOOGLE_SHEETS_SPREADSHEET_ID !== ORIGINAL_SHEET_ID) {
      throw new Error("Unexpected Google Sheet ID; read-only preflight refused");
    }
    const client = new SheetsApiClient({ accessToken: process.env.GOOGLE_ACCESS_TOKEN });
    const result = await appendVerifiedDrRows({ client, candidates, dryRun: true });
    console.log(JSON.stringify({ mode: "dry-run", productionWrites: false, sheetPreflight: "passed", ...result }));
  } else {
    console.log(JSON.stringify({ mode: "dry-run", productionWrites: false, sheetPreflight: "skipped-no-approved-credentials", verifiedCandidates: candidates.length }));
  }
} else {
  const client = new SheetsApiClient({ accessToken: process.env.GOOGLE_ACCESS_TOKEN });
  const result = await appendVerifiedDrRows({ client, candidates, dryRun: false });
  console.log(JSON.stringify({ mode: "append", ...result }));
}
