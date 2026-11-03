import { readFile } from "node:fs/promises";
import {
  appendRadioIIIIToStaging, assertStagingWriteGate, RADIO_IIII_STAGING_HEADERS,
  RADIO_IIII_STAGING_TAB, StagingSheetsApiClient
} from "./google-sheets-staging.mjs";

const write = process.argv.includes("--write");
if (write) assertStagingWriteGate();
const registry = JSON.parse(await readFile("data/auto-discovered-radio-iiii.json", "utf8"));
const candidates = registry.records || [];
if (!write && (!process.env.GOOGLE_ACCESS_TOKEN || !process.env.GOOGLE_DR_STAGING_SHEET_ID)) {
  console.log(JSON.stringify({ mode: "dry-run", productionWrites: false, stagingPreflight: "skipped-no-staging-credentials", candidates: candidates.length }));
} else {
  const client = new StagingSheetsApiClient({
    accessToken: process.env.GOOGLE_ACCESS_TOKEN,
    spreadsheetId: process.env.GOOGLE_DR_STAGING_SHEET_ID,
    tab: RADIO_IIII_STAGING_TAB,
    headers: RADIO_IIII_STAGING_HEADERS
  });
  const result = await appendRadioIIIIToStaging({ client, candidates, dryRun: !write });
  console.log(JSON.stringify({
    mode: write ? "staging-append" : "dry-run",
    productionWrites: false,
    stagingTab: RADIO_IIII_STAGING_TAB,
    candidateCount: candidates.length,
    checkedColumns: RADIO_IIII_STAGING_HEADERS.length,
    ...result
  }));
}
