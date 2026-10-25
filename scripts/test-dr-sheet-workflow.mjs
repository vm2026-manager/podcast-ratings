import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/sync-sheet-data.yml", import.meta.url), "utf8");
const writer = await readFile(new URL("./google-sheets-staging.mjs", import.meta.url), "utf8");
const cli = await readFile(new URL("./append-dr-series-to-staging.mjs", import.meta.url), "utf8");
const ownerGate = await readFile(new URL("../apps-script/append-dr-staging-to-ark1/Code.gs", import.meta.url), "utf8");

assert.match(workflow, /name: Sync Podcastlisten catalogue/u);
assert.match(workflow, /stage-verified-dr-series:[\s\S]*?needs: sync-sheet-data/u);
assert.match(workflow, /group: stage-verified-dr-series-only[\s\S]*?cancel-in-progress: false/u);
assert.match(workflow, /id-token: write/u);
assert.match(workflow, /google-github-actions\/auth@v2/u);
assert.match(workflow, /GOOGLE_DR_STAGING_SHEET_ID/u);
assert.match(workflow, /GOOGLE_DR_STAGING_WRITE_ENABLED/u);
assert.doesNotMatch(workflow, /GOOGLE_SHEETS_SPREADSHEET_ID|GOOGLE_SHEETS_WRITE_ENABLED|GOOGLE_SHEETS_BACKUP_VERIFIED|append-dr-series-to-sheet|append-verified-dr-series-ark1/u);
assert.doesNotMatch(workflow, /pull_request_target/u);
assert.doesNotMatch(cli, /ORIGINAL_SHEET_ID|GOOGLE_SHEETS_SPREADSHEET_ID/u);
assert.doesNotMatch(writer, /spreadsheets\/values\/.+ORIGINAL/u);
assert.match(writer, /original-sheet writes are forbidden/u);
assert.match(writer, /valueInputOption=RAW/u);
assert.match(ownerGate, /LockService\.getDocumentLock\(\)/u);
assert.match(ownerGate, /getSheetId\(\) !== TARGET_TAB_ID_/u);
assert.match(ownerGate, /BACKUP_RESTORE_TEST_VERIFIED/u);
assert.match(ownerGate, /APPEND_ENABLED/u);
assert.match(ownerGate, /assertOldCellsUnchanged_/u);
assert.match(ownerGate, /prompt\(/u);
assert.doesNotMatch(ownerGate, /deleteRow|clearContents/u);

console.log("DR staging trust boundary and owner-gate tests passed");
